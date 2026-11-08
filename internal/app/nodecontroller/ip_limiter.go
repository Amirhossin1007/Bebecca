package nodecontroller

import (
	"context"
	"fmt"
	"net/netip"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/logging"
	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/rebeccapanel/rebecca/internal/app/online"
)

const (
	ipBlockTTLSeconds      = uint32(2 * 60)
	onlineIPWriteBatchSize = 500
)

// ponytail: Rebecca runs one master writer; split this into a dedicated DB
// writer only if multiple master processes become supported.
var onlineIPWriteMu sync.Mutex

const onlineIPDBRefreshInterval = 10 * time.Second

var onlineIPClock = func() time.Time { return time.Now().UTC() }

type onlineIPWriteTracker struct {
	mu      sync.Mutex
	written map[int64]map[onlineIPSampleKey]time.Time
}

var onlineIPWrites = &onlineIPWriteTracker{written: map[int64]map[onlineIPSampleKey]time.Time{}}

func (t *onlineIPWriteTracker) due(nodeID int64, samples []OnlineIPSample, now time.Time) []OnlineIPSample {
	t.mu.Lock()
	defer t.mu.Unlock()
	written := t.written[nodeID]
	if written == nil {
		written = map[onlineIPSampleKey]time.Time{}
		t.written[nodeID] = written
	}
	for key, last := range written {
		if now.Sub(last) > 2*online.ActiveWindow {
			delete(written, key)
		}
	}
	due := make([]OnlineIPSample, 0, len(samples))
	for _, sample := range samples {
		key := onlineIPSampleKey{userID: sample.UserID, protocol: sample.Protocol, ip: sample.IP}
		if last, ok := written[key]; ok && now.Sub(last) < onlineIPDBRefreshInterval {
			continue
		}
		written[key] = now
		due = append(due, sample)
	}
	return due
}

func (t *onlineIPWriteTracker) forget(nodeID int64, samples []OnlineIPSample) {
	t.mu.Lock()
	defer t.mu.Unlock()
	written := t.written[nodeID]
	for _, sample := range samples {
		delete(written, onlineIPSampleKey{userID: sample.UserID, protocol: sample.Protocol, ip: sample.IP})
	}
}

type OnlineIPSample struct {
	UserID     int64
	Protocol   string
	IP         string
	LastSeenAt time.Time
}

type onlineIPSampleKey struct {
	userID   int64
	protocol string
	ip       string
}

type UserOnlineIPRecord struct {
	NodeID            int64     `json:"node_id"`
	NodeName          string    `json:"node_name"`
	NodeNames         []string  `json:"node_names,omitempty"`
	UserID            int64     `json:"user_id"`
	Username          string    `json:"username,omitempty"`
	UserStatus        string    `json:"user_status,omitempty"`
	UsedTraffic       int64     `json:"used_traffic"`
	DataLimit         int64     `json:"data_limit"`
	Expire            int64     `json:"expire"`
	ServiceName       string    `json:"service_name,omitempty"`
	Protocol          string    `json:"protocol"`
	Protocols         []string  `json:"protocols,omitempty"`
	InboundTag        string    `json:"inbound_tag,omitempty"`
	InboundTags       []string  `json:"inbound_tags,omitempty"`
	SessionID         string    `json:"session_id,omitempty"`
	IP                string    `json:"ip,omitempty"`
	AssignedIP        string    `json:"assigned_ip,omitempty"`
	AssignedIPs       []string  `json:"assigned_ips,omitempty"`
	Connections       int       `json:"connections"`
	OperatorShortName string    `json:"operator_short_name,omitempty"`
	OperatorOwner     string    `json:"operator_owner,omitempty"`
	LastSeenAt        time.Time `json:"last_seen_at"`
}

type limiterEndpoint struct {
	NodeID      int64
	UserID      int64
	Limit       int64
	Protocol    string
	IP          string
	AssignedIP  string
	SessionID   string
	FirstSeenAt time.Time
	LastSeenAt  time.Time
}

type limiterDevice struct {
	key       string
	isVPN     bool
	ip        string
	firstSeen time.Time
	nodes     map[int64]struct{}
}

var ipLimitUnsupportedLogAt sync.Map

type ipBlockHold struct {
	userUID   string
	ip        string
	expiresAt time.Time
	nodes     map[int64]struct{}
}

var ipBlockHolds = struct {
	sync.Mutex
	items map[string]*ipBlockHold
}{items: map[string]*ipBlockHold{}}

func onlineIPActiveCutoff() time.Time {
	return online.Cutoff(time.Now())
}

func onlineIPSamplesFromBatch(items []*nodev1.OnlineUserIP) []OnlineIPSample {
	result := make([]OnlineIPSample, 0, len(items))
	observedAt := time.Now().UTC()
	for _, item := range items {
		if item == nil {
			continue
		}
		userID, _, ok := parseUserUsageSampleUID(item.GetUid())
		if !ok {
			continue
		}
		for _, ip := range item.GetIps() {
			if ip == nil {
				continue
			}
			addr := strings.TrimSpace(ip.GetIp())
			if !usableOnlineIP(addr) {
				continue
			}
			result = append(result, OnlineIPSample{
				UserID:     userID,
				Protocol:   "xray",
				IP:         addr,
				LastSeenAt: observedAt,
			})
		}
	}
	return result
}

func usableOnlineIP(value string) bool {
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil {
		return false
	}
	return !addr.IsLoopback() && !addr.IsUnspecified() && !addr.IsMulticast()
}

func normalizedOnlineIPSamples(samples []OnlineIPSample) []OnlineIPSample {
	latest := make(map[onlineIPSampleKey]OnlineIPSample, len(samples))
	for _, sample := range samples {
		addr, ok := normalizedUsableIP(sample.IP)
		if sample.UserID <= 0 || !ok {
			continue
		}
		protocol := normalizedOnlineProtocol(sample.Protocol)
		if protocol == "" {
			protocol = "xray"
		}
		if sample.LastSeenAt.IsZero() {
			sample.LastSeenAt = time.Now().UTC()
		}
		sample.Protocol = protocol
		sample.IP = addr
		key := onlineIPSampleKey{userID: sample.UserID, protocol: protocol, ip: addr}
		if current, exists := latest[key]; !exists || sample.LastSeenAt.After(current.LastSeenAt) {
			latest[key] = sample
		}
	}

	result := make([]OnlineIPSample, 0, len(latest))
	for _, sample := range latest {
		result = append(result, sample)
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].UserID != result[j].UserID {
			return result[i].UserID < result[j].UserID
		}
		if result[i].Protocol != result[j].Protocol {
			return result[i].Protocol < result[j].Protocol
		}
		return result[i].IP < result[j].IP
	})
	return result
}

func (r Repository) StoreNodeOnlineIPs(ctx context.Context, nodeID int64, samples []OnlineIPSample) error {
	if nodeID <= 0 {
		return nil
	}
	if ok, err := r.tableExists(ctx, "user_online_ips"); err != nil || !ok {
		return err
	}
	now := onlineIPClock()
	due := onlineIPWrites.due(nodeID, normalizedOnlineIPSamples(samples), now)
	if err := r.writeOnlineIPRows(ctx, nodeID, due, now); err != nil {
		onlineIPWrites.forget(nodeID, due)
		return err
	}
	return nil
}

func (r Repository) writeOnlineIPRows(ctx context.Context, nodeID int64, rows []OnlineIPSample, now time.Time) error {
	batchSize := onlineIPWriteBatchSize
	if r.dialect == "sqlite" {
		batchSize = 100
	}
	onlineIPWriteMu.Lock()
	defer onlineIPWriteMu.Unlock()

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for start := 0; start < len(rows); start += batchSize {
		end := min(start+batchSize, len(rows))
		var query strings.Builder
		query.WriteString("INSERT INTO user_online_ips (node_id, user_id, protocol, ip, first_seen_at, last_seen_at) VALUES ")
		args := make([]any, 0, (end-start)*6)
		for index, sample := range rows[start:end] {
			if index > 0 {
				query.WriteByte(',')
			}
			query.WriteString("(?, ?, ?, ?, ?, ?)")
			seenAt := r.timeArg(sample.LastSeenAt.UTC())
			args = append(args, nodeID, sample.UserID, sample.Protocol, sample.IP, seenAt, seenAt)
		}
		if r.dialect == "mysql" || r.dialect == "mariadb" {
			query.WriteString(" ON DUPLICATE KEY UPDATE last_seen_at = GREATEST(last_seen_at, VALUES(last_seen_at))")
		} else {
			query.WriteString(" ON CONFLICT(node_id, user_id, protocol, ip) DO UPDATE SET last_seen_at = CASE WHEN excluded.last_seen_at > user_online_ips.last_seen_at THEN excluded.last_seen_at ELSE user_online_ips.last_seen_at END")
		}
		if _, err := tx.ExecContext(ctx, query.String(), args...); err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM user_online_ips WHERE node_id = ? AND last_seen_at < ?`,
		nodeID,
		r.timeArg(now.Add(-online.ActiveWindow*2)),
	); err != nil {
		return err
	}
	return tx.Commit()
}

func (r Repository) UserOnlineIPs(ctx context.Context, userID int64, cutoff time.Time) ([]UserOnlineIPRecord, error) {
	if userID <= 0 {
		return nil, nil
	}
	result := []UserOnlineIPRecord{}
	if ok, err := r.tableExists(ctx, "user_online_ips"); err == nil && ok {
		rows, err := r.db.QueryContext(ctx, `
SELECT uoi.node_id, COALESCE(n.name, ''), uoi.user_id, uoi.protocol, uoi.ip, uoi.last_seen_at
FROM user_online_ips uoi
LEFT JOIN nodes n ON n.id = uoi.node_id
WHERE uoi.user_id = ? AND uoi.last_seen_at >= ?
  AND (n.id IS NULL OR LOWER(COALESCE(n.status, '')) <> 'deleted')
ORDER BY uoi.last_seen_at DESC, uoi.node_id, uoi.protocol, uoi.ip`,
			userID,
			r.timeArg(cutoff.UTC()),
		)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item UserOnlineIPRecord
			var seen any
			if err := rows.Scan(&item.NodeID, &item.NodeName, &item.UserID, &item.Protocol, &item.IP, &seen); err != nil {
				rows.Close()
				return nil, err
			}
			if parsed := usageDBTime(seen); parsed != nil {
				item.LastSeenAt = *parsed
			}
			result = append(result, item)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	if ok, err := r.tableExists(ctx, "vpn_user_sessions"); err == nil && ok {
		hasClientIP, _ := r.tableHasColumn(ctx, "vpn_user_sessions", "client_ip")
		clientExpr := "''"
		if hasClientIP {
			clientExpr = "COALESCE(vus.client_ip, '')"
		}
		rows, err := r.db.QueryContext(ctx, `
SELECT vus.node_id, COALESCE(n.name, ''), vus.user_id, vus.protocol, COALESCE(vus.inbound_tag, ''), vus.session_id, COALESCE(vus.assigned_ip, ''), `+clientExpr+`, vus.last_seen_at
FROM vpn_user_sessions vus
LEFT JOIN nodes n ON n.id = vus.node_id
WHERE vus.user_id = ? AND vus.ended_at IS NULL AND vus.last_seen_at >= ?
  AND (n.id IS NULL OR LOWER(COALESCE(n.status, '')) <> 'deleted')
ORDER BY vus.last_seen_at DESC, vus.node_id, vus.protocol, vus.session_id`,
			userID,
			r.timeArg(cutoff.UTC()),
		)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item UserOnlineIPRecord
			var seen any
			if err := rows.Scan(&item.NodeID, &item.NodeName, &item.UserID, &item.Protocol, &item.InboundTag, &item.SessionID, &item.AssignedIP, &item.IP, &seen); err != nil {
				rows.Close()
				return nil, err
			}
			if item.IP == "" {
				item.IP = item.AssignedIP
			}
			if parsed := usageDBTime(seen); parsed != nil {
				item.LastSeenAt = *parsed
			}
			result = append(result, item)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].LastSeenAt.After(result[j].LastSeenAt)
	})
	return result, nil
}

func (c Controller) UserOnlineIPs(ctx context.Context, userID int64) ([]UserOnlineIPRecord, error) {
	records, err := c.repo.UserOnlineIPs(ctx, userID, onlineIPActiveCutoff())
	if err != nil {
		return nil, err
	}
	return collapseUserOnlineIPs(visibleOnlineAccessRecords(records)), nil
}

func (c Controller) OnlineAccessRecords(ctx context.Context, query OnlineAccessQuery) ([]UserOnlineIPRecord, error) {
	return c.repo.OnlineAccessRecords(ctx, query)
}

func (c Controller) OnlineAccessUserTotal(ctx context.Context, query OnlineAccessQuery) (int64, error) {
	return c.repo.OnlineAccessUserTotal(ctx, query)
}

const ipBlockApplyRefreshInterval = 60 * time.Second

type ipBlockApplyRecord struct {
	signature string
	appliedAt time.Time
}

var ipBlockApplied = struct {
	sync.Mutex
	byNode map[int64]ipBlockApplyRecord
}{byNode: map[int64]ipBlockApplyRecord{}}

func (c Controller) applyIPLimitBlocks(ctx context.Context, nodes []NodeRow) []string {
	endpoints, err := c.repo.activeLimiterEndpoints(ctx, 0, onlineIPActiveCutoff())
	if err != nil {
		return []string{"IP limiter: " + err.Error()}
	}
	now := onlineIPClock()
	errs := []string{}
	for _, node := range nodes {
		if node.ID <= 0 {
			continue
		}
		blocks := holdIPBlocks(node.ID, xrayIPBlocksForNode(endpoints, node.ID), now)
		if !ipBlockApplyDue(node.ID, blocks, now) {
			continue
		}
		if err := c.applyIPBlocksToNode(ctx, node, blocks); err != nil {
			errs = append(errs, fmt.Sprintf("node %d IP limiter: %s", node.ID, err.Error()))
			continue
		}
		recordIPBlockApply(node.ID, blocks, now)
	}
	return errs
}

func (c Controller) applyIPBlocksToNode(ctx context.Context, node NodeRow, blocks []*nodev1.IPBlockEntry) error {
	rpcCtx, cancel := WithDefaultTimeout(ctx)
	defer cancel()
	client, _, err := c.dial(rpcCtx, node.ID)
	if err != nil {
		return err
	}
	req := &nodev1.IPBlockRequest{
		OperationId: "ip-limit-" + strconv.FormatInt(node.ID, 10) + "-" + strconv.FormatInt(time.Now().UTC().UnixNano(), 10),
		Blocks:      blocks,
	}
	_, err = client.Runtime().ApplyIPBlocks(rpcCtx, req)
	if err == nil {
		return nil
	}
	if status.Code(err) == codes.Unimplemented {
		return nil
	}
	if strings.Contains(strings.ToLower(err.Error()), "supported only for binary") {
		logIPLimitUnsupported(node.ID)
		return nil
	}
	return err
}

func blockSetSignature(blocks []*nodev1.IPBlockEntry) string {
	parts := make([]string, 0, len(blocks))
	for _, block := range blocks {
		parts = append(parts, block.GetUserUid()+"|"+block.GetIp())
	}
	return strings.Join(parts, ",")
}

func ipBlockApplyDue(nodeID int64, blocks []*nodev1.IPBlockEntry, now time.Time) bool {
	signature := blockSetSignature(blocks)
	ipBlockApplied.Lock()
	defer ipBlockApplied.Unlock()
	record, ok := ipBlockApplied.byNode[nodeID]
	if !ok {
		return true
	}
	if record.signature != signature {
		return true
	}
	if signature == "" {
		return false
	}
	return now.Sub(record.appliedAt) >= ipBlockApplyRefreshInterval
}

func recordIPBlockApply(nodeID int64, blocks []*nodev1.IPBlockEntry, now time.Time) {
	ipBlockApplied.Lock()
	defer ipBlockApplied.Unlock()
	ipBlockApplied.byNode[nodeID] = ipBlockApplyRecord{signature: blockSetSignature(blocks), appliedAt: now}
}

func holdIPBlocks(nodeID int64, blocks []*nodev1.IPBlockEntry, now time.Time) []*nodev1.IPBlockEntry {
	ttl := time.Duration(ipBlockTTLSeconds) * time.Second
	ipBlockHolds.Lock()
	defer ipBlockHolds.Unlock()
	for _, block := range blocks {
		key := block.GetUserUid() + "|" + block.GetIp()
		hold := ipBlockHolds.items[key]
		if hold == nil {
			hold = &ipBlockHold{userUID: block.GetUserUid(), ip: block.GetIp(), nodes: map[int64]struct{}{}}
			ipBlockHolds.items[key] = hold
		}
		hold.expiresAt = now.Add(ttl)
		hold.nodes[nodeID] = struct{}{}
	}
	result := append([]*nodev1.IPBlockEntry{}, blocks...)
	fresh := map[string]struct{}{}
	for _, block := range blocks {
		fresh[block.GetUserUid()+"|"+block.GetIp()] = struct{}{}
	}
	for key, hold := range ipBlockHolds.items {
		if !now.Before(hold.expiresAt) {
			delete(ipBlockHolds.items, key)
			continue
		}
		if _, ok := hold.nodes[nodeID]; !ok {
			continue
		}
		if _, ok := fresh[key]; ok {
			continue
		}
		result = append(result, &nodev1.IPBlockEntry{
			Ip:         hold.ip,
			TtlSeconds: ipBlockTTLSeconds,
			UserUid:    hold.userUID,
			Reason:     "device_limit",
		})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].GetUserUid() == result[j].GetUserUid() {
			return result[i].GetIp() < result[j].GetIp()
		}
		return result[i].GetUserUid() < result[j].GetUserUid()
	})
	return result
}

func logIPLimitUnsupported(nodeID int64) {
	if last, ok := ipLimitUnsupportedLogAt.Load(nodeID); ok && time.Since(last.(time.Time)) < 10*time.Minute {
		return
	}
	ipLimitUnsupportedLogAt.Store(nodeID, time.Now())
	logging.Warnf(logging.ComponentNode, "IP limit is exceeded but node %d cannot block Xray source IPs: source IP blocking requires a binary node install", nodeID)
}

func (r Repository) activeLimiterEndpointsForNode(ctx context.Context, nodeID int64, cutoff time.Time) ([]limiterEndpoint, error) {
	return r.activeLimiterEndpoints(ctx, nodeID, cutoff)
}

func (r Repository) activeLimiterEndpoints(ctx context.Context, nodeID int64, cutoff time.Time) ([]limiterEndpoint, error) {
	result := []limiterEndpoint{}
	hasOnlineIPs, err := r.tableExists(ctx, "user_online_ips")
	if err != nil {
		return nil, err
	}
	if !hasOnlineIPs {
		return result, nil
	}
	cutoffArg := r.timeArg(cutoff.UTC())
	scope := ""
	onlineArgs := []any{cutoffArg}
	if nodeID > 0 {
		scope = " AND node_id = ?"
		onlineArgs = append(onlineArgs, nodeID)
	}
	onlineUsers := `SELECT DISTINCT user_id FROM user_online_ips WHERE protocol = 'xray' AND last_seen_at >= ?` + scope
	xrayArgs := append([]any{cutoffArg}, onlineArgs...)
	rows, err := r.db.QueryContext(ctx, `
SELECT uoi.node_id, uoi.user_id, COALESCE(u.ip_limit, 0), uoi.protocol, uoi.ip, uoi.first_seen_at, uoi.last_seen_at
FROM user_online_ips uoi
JOIN users u ON u.id = uoi.user_id
WHERE uoi.protocol = 'xray' AND uoi.last_seen_at >= ? AND COALESCE(u.ip_limit, 0) > 0
  AND uoi.user_id IN (`+onlineUsers+`)`,
		xrayArgs...,
	)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var item limiterEndpoint
		var first, seen any
		if err := rows.Scan(&item.NodeID, &item.UserID, &item.Limit, &item.Protocol, &item.IP, &first, &seen); err != nil {
			rows.Close()
			return nil, err
		}
		if parsed := usageDBTime(first); parsed != nil {
			item.FirstSeenAt = *parsed
		}
		if parsed := usageDBTime(seen); parsed != nil {
			item.LastSeenAt = *parsed
		}
		result = append(result, item)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}

	if ok, err := r.tableExists(ctx, "vpn_user_sessions"); err != nil {
		return nil, err
	} else if ok {
		hasClientIP, _ := r.tableHasColumn(ctx, "vpn_user_sessions", "client_ip")
		clientExpr := "''"
		if hasClientIP {
			clientExpr = "COALESCE(vus.client_ip, '')"
		}
		rows, err := r.db.QueryContext(ctx, `
SELECT vus.node_id, vus.user_id, COALESCE(u.ip_limit, 0), vus.protocol, `+clientExpr+`, COALESCE(vus.assigned_ip, ''), vus.session_id, vus.started_at, vus.last_seen_at
FROM vpn_user_sessions vus
JOIN users u ON u.id = vus.user_id
WHERE vus.ended_at IS NULL AND COALESCE(u.ip_limit, 0) > 0
  AND vus.user_id IN (`+onlineUsers+`)`,
			onlineArgs...,
		)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item limiterEndpoint
			var first, seen any
			if err := rows.Scan(&item.NodeID, &item.UserID, &item.Limit, &item.Protocol, &item.IP, &item.AssignedIP, &item.SessionID, &first, &seen); err != nil {
				rows.Close()
				return nil, err
			}
			if parsed := usageDBTime(first); parsed != nil {
				item.FirstSeenAt = *parsed
			}
			if parsed := usageDBTime(seen); parsed != nil {
				item.LastSeenAt = *parsed
			}
			result = append(result, item)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}
	return result, nil
}

func xrayIPBlocksForLimiterEndpoints(endpoints []limiterEndpoint) []*nodev1.IPBlockEntry {
	return xrayIPBlocks(endpoints, 0)
}

func xrayIPBlocksForNode(endpoints []limiterEndpoint, nodeID int64) []*nodev1.IPBlockEntry {
	return xrayIPBlocks(endpoints, nodeID)
}

func xrayIPBlocks(endpoints []limiterEndpoint, nodeID int64) []*nodev1.IPBlockEntry {
	byUser := map[int64][]limiterEndpoint{}
	limits := map[int64]int64{}
	for _, endpoint := range endpoints {
		if endpoint.UserID <= 0 || endpoint.Limit <= 0 {
			continue
		}
		byUser[endpoint.UserID] = append(byUser[endpoint.UserID], endpoint)
		limits[endpoint.UserID] = endpoint.Limit
	}
	blocks := []*nodev1.IPBlockEntry{}
	for userID, items := range byUser {
		for _, device := range excessLimiterDevices(limits[userID], limiterDevicesForUser(items)) {
			if nodeID > 0 {
				if _, ok := device.nodes[nodeID]; !ok {
					continue
				}
			}
			blocks = append(blocks, &nodev1.IPBlockEntry{
				Ip:         device.ip,
				TtlSeconds: ipBlockTTLSeconds,
				UserUid:    strconv.FormatInt(userID, 10),
				Reason:     "device_limit",
			})
		}
	}
	sort.Slice(blocks, func(i, j int) bool {
		if blocks[i].GetUserUid() == blocks[j].GetUserUid() {
			return blocks[i].GetIp() < blocks[j].GetIp()
		}
		return blocks[i].GetUserUid() < blocks[j].GetUserUid()
	})
	return blocks
}

func limiterDevicesForUser(items []limiterEndpoint) []limiterDevice {
	items = withoutTunneledXrayEndpoints(items)
	byKey := map[string]*limiterDevice{}
	keys := []string{}
	for _, item := range items {
		key := limiterDeviceKey(item)
		if key == "" {
			continue
		}
		device := byKey[key]
		if device == nil {
			device = &limiterDevice{key: key, nodes: map[int64]struct{}{}}
			byKey[key] = device
			keys = append(keys, key)
		}
		seenAt := item.FirstSeenAt
		if seenAt.IsZero() {
			seenAt = item.LastSeenAt
		}
		if device.firstSeen.IsZero() || seenAt.Before(device.firstSeen) {
			device.firstSeen = seenAt
		}
		if strings.EqualFold(normalizedOnlineProtocol(item.Protocol), "xray") {
			if ip, ok := normalizedUsableIP(item.IP); ok {
				device.ip = ip
			}
			device.nodes[item.NodeID] = struct{}{}
		} else {
			device.isVPN = true
		}
	}
	devices := make([]limiterDevice, 0, len(keys))
	for _, key := range keys {
		devices = append(devices, *byKey[key])
	}
	sort.SliceStable(devices, func(i, j int) bool {
		if devices[i].isVPN != devices[j].isVPN {
			return devices[i].isVPN
		}
		if !devices[i].firstSeen.Equal(devices[j].firstSeen) {
			return devices[i].firstSeen.Before(devices[j].firstSeen)
		}
		return devices[i].key < devices[j].key
	})
	return devices
}

func excessLimiterDevices(limit int64, devices []limiterDevice) []limiterDevice {
	result := []limiterDevice{}
	for index, device := range devices {
		if int64(index) < limit || device.isVPN || device.ip == "" {
			continue
		}
		result = append(result, device)
	}
	return result
}

func withoutTunneledXrayEndpoints(items []limiterEndpoint) []limiterEndpoint {
	assigned := map[string]struct{}{}
	for _, item := range items {
		if strings.EqualFold(normalizedOnlineProtocol(item.Protocol), "xray") {
			continue
		}
		if ip, ok := normalizedUsableIP(item.AssignedIP); ok {
			assigned[ip] = struct{}{}
		}
	}
	if len(assigned) == 0 {
		return items
	}
	result := items[:0]
	for _, item := range items {
		if strings.EqualFold(normalizedOnlineProtocol(item.Protocol), "xray") {
			if ip, ok := normalizedUsableIP(item.IP); ok {
				if _, duplicate := assigned[ip]; duplicate {
					continue
				}
			}
		}
		result = append(result, item)
	}
	return result
}

func limiterDeviceKey(item limiterEndpoint) string {
	protocol := normalizedOnlineProtocol(item.Protocol)
	if protocol == "xray" {
		if ip, ok := normalizedUsableIP(item.IP); ok {
			return "client:" + ip
		}
		return ""
	}
	if ip, ok := normalizedUsableIP(item.IP); ok {
		return "client:" + ip
	}
	if ip, ok := normalizedUsableIP(item.AssignedIP); ok {
		return "assigned:" + ip
	}
	if text := strings.TrimSpace(item.SessionID); text != "" {
		return "session:" + text
	}
	return ""
}

func normalizedUsableIP(value string) (string, bool) {
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil || addr.IsLoopback() || addr.IsUnspecified() || addr.IsMulticast() {
		return "", false
	}
	return addr.String(), true
}

func normalizedOnlineProtocol(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "openvpn":
		return "ov"
	case "wireguard":
		return "wg"
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func (r Repository) tableHasColumn(ctx context.Context, table string, column string) (bool, error) {
	var count int
	if r.dialect == "mysql" || r.dialect == "mariadb" {
		err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, table, column).Scan(&count)
		return count > 0, err
	}
	rows, err := r.db.QueryContext(ctx, `PRAGMA table_info(`+table+`)`)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notNull int
		var defaultValue any
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notNull, &defaultValue, &pk); err != nil {
			return false, err
		}
		if strings.EqualFold(name, column) {
			return true, nil
		}
	}
	return false, rows.Err()
}

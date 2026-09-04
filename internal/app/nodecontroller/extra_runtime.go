package nodecontroller

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	userapp "github.com/rebeccapanel/rebecca/internal/app/user"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

type ExtraRuntime struct {
	GeneratedAt     string                 `json:"generated_at"`
	Target          string                 `json:"target,omitempty"`
	SessionCallback RuntimeSessionCallback `json:"session_callback,omitempty"`
	Inbounds        []ExtraRuntimeInbound  `json:"inbounds"`
}

type ExtraRuntimeInbound struct {
	Tag        string             `json:"tag"`
	Protocol   string             `json:"protocol"`
	Listen     string             `json:"listen"`
	Port       int                `json:"port"`
	TunnelTag  string             `json:"tunnel_tag,omitempty"`
	TunnelPort int                `json:"tunnel_port,omitempty"`
	Settings   map[string]any     `json:"settings"`
	Users      []ExtraRuntimeUser `json:"users,omitempty"`
	Peers      []WGRuntimePeer    `json:"peers,omitempty"`
}

type ExtraRuntimeUser struct {
	UserID        int64    `json:"user_id"`
	Username      string   `json:"username"`
	Password      string   `json:"password,omitempty"`
	IPv4Address   string   `json:"ipv4_address,omitempty"`
	IPv4Addresses []string `json:"ipv4_addresses,omitempty"`
	Status        string   `json:"status,omitempty"`
	UsedTraffic   int64    `json:"used_traffic,omitempty"`
	DataLimit     *int64   `json:"data_limit,omitempty"`
	Expire        *int64   `json:"expire,omitempty"`
	DeviceLimit   int64    `json:"device_limit,omitempty"`
}

func (r Repository) extraRuntime(ctx context.Context, nodeID int64, inbounds []map[string]any) (ExtraRuntime, error) {
	target := xrayconfig.NodeTargetID(nodeID)
	runtime := ExtraRuntime{
		GeneratedAt: time.Now().UTC().Format(time.RFC3339Nano),
		Target:      target,
		Inbounds:    []ExtraRuntimeInbound{},
	}
	callback, err := r.RuntimeSessionCallback(ctx, NodeRow{ID: nodeID})
	if err != nil {
		return ExtraRuntime{}, err
	}
	runtime.SessionCallback = callback
	usedPorts := map[int]struct{}{}
	for _, inbound := range inbounds {
		if port := OVIntValue(inbound["port"]); port > 0 {
			usedPorts[port] = struct{}{}
		}
	}
	for _, inbound := range inbounds {
		protocol := strings.ToLower(OVStringValue(inbound["protocol"]))
		if !xrayconfig.IsAuxiliaryInboundProtocol(protocol) && protocol != xrayconfig.SSTPProtocol && protocol != xrayconfig.AWGProtocol && protocol != xrayconfig.GREProtocol {
			continue
		}
		if !OVInboundMatchesTarget(inbound, target) {
			continue
		}
		tag := OVStringValue(inbound["tag"])
		if tag == "" {
			continue
		}
		item := ExtraRuntimeInbound{
			Tag:      tag,
			Protocol: protocol,
			Listen:   firstRuntimeString(inbound["listen"], "0.0.0.0"),
			Port:     OVIntValue(inbound["port"]),
			Settings: OVRuntimeSettings(inbound),
		}
		if protocol == xrayconfig.SSTPProtocol || protocol == xrayconfig.AWGProtocol || protocol == xrayconfig.GREProtocol {
			item.TunnelTag = xrayconfig.RuntimeTunnelTagForProtocol(protocol, tag)
			item.TunnelPort = xrayconfig.RuntimeTunnelPortForInbound(inbound, usedPorts)
			if item.TunnelPort > 0 {
				usedPorts[item.TunnelPort] = struct{}{}
			}
		}
		if protocol == "ssh" || protocol == xrayconfig.SSTPProtocol || protocol == xrayconfig.GREProtocol {
			serviceIDs, err := r.OVServiceIDsForInbound(ctx, tag)
			if err != nil {
				return ExtraRuntime{}, err
			}
			if protocol == "ssh" {
				item.Users, err = r.sshUsersForServices(ctx, serviceIDs)
			} else {
				item.Users, err = r.extraVPNUsersForServices(ctx, protocol, tag, serviceIDs, OVStringValue(item.Settings["ipv4_pool_cidr"]))
			}
			if err != nil {
				return ExtraRuntime{}, err
			}
		}
		if protocol == xrayconfig.AWGProtocol {
			serviceIDs, err := r.OVServiceIDsForInbound(ctx, tag)
			if err != nil {
				return ExtraRuntime{}, err
			}
			item.Peers, err = r.WGUsersForServices(ctx, xrayconfig.AWGProtocol+":"+tag, serviceIDs, OVStringValue(item.Settings["ipv4_pool_cidr"]), OVStringValue(item.Settings["server_address"]))
			if err != nil {
				return ExtraRuntime{}, err
			}
		}
		runtime.Inbounds = append(runtime.Inbounds, item)
	}
	return runtime, nil
}

func (r Repository) extraVPNUsersForServices(ctx context.Context, protocol, inboundTag string, serviceIDs []int64, pool string) ([]ExtraRuntimeUser, error) {
	if len(serviceIDs) == 0 {
		return []ExtraRuntimeUser{}, nil
	}
	marks := make([]string, len(serviceIDs))
	args := make([]any, len(serviceIDs))
	for i, id := range serviceIDs {
		marks[i], args[i] = "?", id
	}
	rows, err := r.db.QueryContext(ctx, `
SELECT id, username, COALESCE(credential_key, ''), status, COALESCE(used_traffic, 0), data_limit, expire, COALESCE(ip_limit, 0)
FROM users WHERE status IN ('active', 'on_hold') AND service_id IN (`+strings.Join(marks, ",")+`) ORDER BY id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []ExtraRuntimeUser{}
	for rows.Next() {
		var user ExtraRuntimeUser
		var credential string
		var limit, expire sql.NullInt64
		if err := rows.Scan(&user.UserID, &user.Username, &credential, &user.Status, &user.UsedTraffic, &limit, &expire, &user.DeviceLimit); err != nil {
			return nil, err
		}
		if protocol == xrayconfig.SSTPProtocol {
			user.Password, err = userapp.SSTPPasswordFromCredentialKey(credential)
			if err != nil {
				return nil, fmt.Errorf("user %d SSTP credential: %w", user.UserID, err)
			}
		}
		user.DataLimit, user.Expire = nullableOVInt64(limit), nullableOVInt64(expire)
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	ids := []int64{}
	slots := map[int64]struct{ user, slot int }{}
	for userIndex := range users {
		count := 1
		if protocol == xrayconfig.GREProtocol && users[userIndex].DeviceLimit > 1 {
			count = min(int(users[userIndex].DeviceLimit), 64)
		}
		for slot := 0; slot < count; slot++ {
			allocationID := users[userIndex].UserID*65 + int64(slot+1)
			ids = append(ids, allocationID)
			slots[allocationID] = struct{ user, slot int }{userIndex, slot}
		}
	}
	addresses, err := userapp.NewRepository(r.db, r.dialect).WGIPv4Addresses(ctx, protocol+":"+inboundTag, ids, pool, "")
	if err != nil {
		return nil, err
	}
	for _, allocationID := range ids {
		position := slots[allocationID]
		address := addresses[allocationID]
		users[position.user].IPv4Addresses = append(users[position.user].IPv4Addresses, address)
	}
	for i := range users {
		if len(users[i].IPv4Addresses) > 0 {
			users[i].IPv4Address = users[i].IPv4Addresses[0]
		}
	}
	return users, nil
}

func (r Repository) sshUsersForServices(ctx context.Context, serviceIDs []int64) ([]ExtraRuntimeUser, error) {
	if len(serviceIDs) == 0 {
		return []ExtraRuntimeUser{}, nil
	}
	marks := make([]string, len(serviceIDs))
	args := make([]any, len(serviceIDs))
	for i, id := range serviceIDs {
		marks[i], args[i] = "?", id
	}
	rows, err := r.db.QueryContext(ctx, `
SELECT id, username, COALESCE(credential_key, ''), COALESCE(ip_limit, 0)
FROM users
WHERE status IN ('active', 'on_hold') AND service_id IN (`+strings.Join(marks, ",")+`)
ORDER BY id`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	users := []ExtraRuntimeUser{}
	for rows.Next() {
		var user ExtraRuntimeUser
		var credential string
		if err := rows.Scan(&user.UserID, &user.Username, &credential, &user.DeviceLimit); err != nil {
			return nil, err
		}
		password, err := userapp.SSHPasswordFromCredentialKey(credential)
		if err != nil {
			return nil, fmt.Errorf("user %d SSH credential: %w", user.UserID, err)
		}
		user.Password = password
		users = append(users, user)
	}
	return users, rows.Err()
}

func firstRuntimeString(value any, fallback string) string {
	if text := strings.TrimSpace(OVStringValue(value)); text != "" {
		return text
	}
	return fallback
}

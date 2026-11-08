package nodecontroller

import (
	"context"
	"database/sql"
	"path/filepath"
	"sync"
	"testing"
	"time"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
	_ "modernc.org/sqlite"
)

func TestXrayBlocksAreCountedAcrossNodesPerUser(t *testing.T) {
	base := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	endpoints := []limiterEndpoint{
		{NodeID: 1, UserID: 42, Limit: 2, Protocol: "xray", IP: "203.0.113.1", FirstSeenAt: base, LastSeenAt: base},
		{NodeID: 2, UserID: 42, Limit: 2, Protocol: "xray", IP: "203.0.113.2", FirstSeenAt: base.Add(time.Minute), LastSeenAt: base},
		{NodeID: 1, UserID: 42, Limit: 2, Protocol: "xray", IP: "203.0.113.3", FirstSeenAt: base.Add(2 * time.Minute), LastSeenAt: base},
	}

	onNode1 := xrayIPBlocksForNode(endpoints, 1)
	if len(onNode1) != 1 || onNode1[0].GetIp() != "203.0.113.3" {
		t.Fatalf("node 1 blocks = %v, want the third device 203.0.113.3", onNode1)
	}
	if onNode2 := xrayIPBlocksForNode(endpoints, 2); len(onNode2) != 0 {
		t.Fatalf("node 2 must not block a device it did not see, got %v", onNode2)
	}

	seenOnBoth := append(endpoints, limiterEndpoint{NodeID: 2, UserID: 42, Limit: 2, Protocol: "xray", IP: "203.0.113.3", FirstSeenAt: base.Add(2 * time.Minute), LastSeenAt: base})
	if onNode2 := xrayIPBlocksForNode(seenOnBoth, 2); len(onNode2) != 1 || onNode2[0].GetIp() != "203.0.113.3" {
		t.Fatalf("node 2 blocks = %v, want 203.0.113.3 when the device is also seen there", onNode2)
	}
}

func TestXrayBlocksKeepEarliestDeviceWhenLastSeenMatches(t *testing.T) {
	base := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	older := limiterEndpoint{NodeID: 1, UserID: 42, Limit: 1, Protocol: "xray", IP: "203.0.113.10", FirstSeenAt: base, LastSeenAt: base}
	newer := limiterEndpoint{NodeID: 1, UserID: 42, Limit: 1, Protocol: "xray", IP: "203.0.113.11", FirstSeenAt: base.Add(time.Second), LastSeenAt: base}

	for _, order := range [][]limiterEndpoint{{older, newer}, {newer, older}} {
		blocks := xrayIPBlocksForLimiterEndpoints(order)
		if len(blocks) != 1 || blocks[0].GetIp() != "203.0.113.11" {
			t.Fatalf("blocks = %v, want only the newer device 203.0.113.11 regardless of order", blocks)
		}
	}
}

func TestXrayBlocksKeepVPNDeviceBeforeXray(t *testing.T) {
	base := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	blocks := xrayIPBlocksForLimiterEndpoints([]limiterEndpoint{
		{NodeID: 1, UserID: 42, Limit: 1, Protocol: "xray", IP: "203.0.113.20", FirstSeenAt: base, LastSeenAt: base},
		{NodeID: 1, UserID: 42, Limit: 1, Protocol: "wg", IP: "198.51.100.30", AssignedIP: "10.70.0.2", FirstSeenAt: base.Add(time.Minute), LastSeenAt: base.Add(time.Minute)},
	})
	if len(blocks) != 1 || blocks[0].GetIp() != "203.0.113.20" {
		t.Fatalf("blocks = %v, want the Xray device blocked when the WireGuard device holds the slot", blocks)
	}
}

func newOnlineIPWriteTestDB(t *testing.T) *sql.DB {
	t.Helper()
	ctx := context.Background()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "online-ips.db")+"?_pragma=busy_timeout(30000)")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.ExecContext(ctx, `CREATE TABLE user_online_ips (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		node_id INTEGER NOT NULL,
		user_id INTEGER NOT NULL,
		protocol TEXT NOT NULL,
		ip TEXT NOT NULL,
		first_seen_at DATETIME NULL,
		last_seen_at DATETIME NOT NULL,
		UNIQUE(node_id, user_id, protocol, ip)
	)`); err != nil {
		t.Fatal(err)
	}
	return db
}

func useOnlineIPClock(t *testing.T, start time.Time) *time.Time {
	t.Helper()
	current := start
	previous := onlineIPClock
	onlineIPClock = func() time.Time { return current }
	onlineIPWrites = &onlineIPWriteTracker{written: map[int64]map[onlineIPSampleKey]time.Time{}}
	t.Cleanup(func() {
		onlineIPClock = previous
		onlineIPWrites = &onlineIPWriteTracker{written: map[int64]map[onlineIPSampleKey]time.Time{}}
	})
	return &current
}

func onlineIPRowLastSeen(t *testing.T, db *sql.DB, userID int64) (time.Time, bool) {
	t.Helper()
	var raw any
	err := db.QueryRowContext(context.Background(), `SELECT last_seen_at FROM user_online_ips WHERE user_id = ?`, userID).Scan(&raw)
	if err == sql.ErrNoRows {
		return time.Time{}, false
	}
	if err != nil {
		t.Fatal(err)
	}
	parsed := usageDBTime(raw)
	if parsed == nil {
		t.Fatalf("unparseable last_seen_at %v", raw)
	}
	return *parsed, true
}

func TestStoreNodeOnlineIPsKeepsFirstSeenAt(t *testing.T) {
	ctx := context.Background()
	db := newOnlineIPWriteTestDB(t)
	repo := NewRepository(db, "sqlite")
	first := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	clock := useOnlineIPClock(t, first)

	if err := repo.StoreNodeOnlineIPs(ctx, 1, []OnlineIPSample{{UserID: 42, Protocol: "xray", IP: "203.0.113.5", LastSeenAt: first}}); err != nil {
		t.Fatal(err)
	}
	*clock = first.Add(10 * time.Second)
	later := *clock
	if err := repo.StoreNodeOnlineIPs(ctx, 1, []OnlineIPSample{{UserID: 42, Protocol: "xray", IP: "203.0.113.5", LastSeenAt: later}}); err != nil {
		t.Fatal(err)
	}

	var firstSeenRaw any
	if err := db.QueryRowContext(ctx, `SELECT first_seen_at FROM user_online_ips WHERE user_id = 42`).Scan(&firstSeenRaw); err != nil {
		t.Fatal(err)
	}
	if got := usageDBTime(firstSeenRaw); got == nil || !got.Equal(first) {
		t.Fatalf("first_seen_at = %v, want the first observation %s", got, first)
	}
	if got, ok := onlineIPRowLastSeen(t, db, 42); !ok || !got.Equal(later) {
		t.Fatalf("last_seen_at = %v, want refreshed to %s", got, later)
	}
}

func TestStoreNodeOnlineIPsRefreshesOnlyOnInterval(t *testing.T) {
	ctx := context.Background()
	db := newOnlineIPWriteTestDB(t)
	repo := NewRepository(db, "sqlite")
	t0 := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	clock := useOnlineIPClock(t, t0)
	sampleAt := func(at time.Time) []OnlineIPSample {
		return []OnlineIPSample{{UserID: 43, Protocol: "xray", IP: "203.0.113.6", LastSeenAt: at}}
	}

	if err := repo.StoreNodeOnlineIPs(ctx, 1, sampleAt(t0)); err != nil {
		t.Fatal(err)
	}
	*clock = t0.Add(3 * time.Second)
	if err := repo.StoreNodeOnlineIPs(ctx, 1, sampleAt(*clock)); err != nil {
		t.Fatal(err)
	}
	if got, _ := onlineIPRowLastSeen(t, db, 43); !got.Equal(t0) {
		t.Fatalf("row written again inside the refresh interval: last_seen=%s want %s", got, t0)
	}
	*clock = t0.Add(10 * time.Second)
	if err := repo.StoreNodeOnlineIPs(ctx, 1, sampleAt(*clock)); err != nil {
		t.Fatal(err)
	}
	if got, _ := onlineIPRowLastSeen(t, db, 43); !got.Equal(*clock) {
		t.Fatalf("row not refreshed at the interval: last_seen=%s want %s", got, *clock)
	}
}

func TestStoreNodeOnlineIPsRemovesIPsThatStoppedBeingSeen(t *testing.T) {
	ctx := context.Background()
	db := newOnlineIPWriteTestDB(t)
	repo := NewRepository(db, "sqlite")
	t0 := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	clock := useOnlineIPClock(t, t0)
	if err := repo.StoreNodeOnlineIPs(ctx, 1, []OnlineIPSample{{UserID: 44, Protocol: "xray", IP: "203.0.113.7", LastSeenAt: t0}}); err != nil {
		t.Fatal(err)
	}
	*clock = t0.Add(50 * time.Second)
	if err := repo.StoreNodeOnlineIPs(ctx, 1, nil); err != nil {
		t.Fatal(err)
	}
	if _, ok := onlineIPRowLastSeen(t, db, 44); ok {
		t.Fatal("IP not seen for 50s must be removed from the online table")
	}
}

func TestActiveLimiterEndpointsIncludeUserDevicesOnOtherNodes(t *testing.T) {
	ctx := context.Background()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "user-wide.db")+"?_pragma=busy_timeout(30000)")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.ExecContext(ctx, `
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL DEFAULT 0);
CREATE TABLE user_online_ips (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	ip TEXT NOT NULL,
	first_seen_at DATETIME NULL,
	last_seen_at DATETIME NOT NULL,
	UNIQUE(node_id, user_id, protocol, ip)
);
CREATE TABLE vpn_user_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	session_id TEXT NOT NULL,
	assigned_ip TEXT NULL,
	client_ip TEXT NULL,
	started_at DATETIME NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME NULL,
	UNIQUE(node_id, session_id)
);`); err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC()
	at := func(offset time.Duration) string {
		return now.Add(offset).Format("2006-01-02 15:04:05.000000")
	}
	if _, err := db.ExecContext(ctx, `
INSERT INTO users (id, ip_limit) VALUES (42, 2);
INSERT INTO user_online_ips (node_id, user_id, protocol, ip, first_seen_at, last_seen_at) VALUES
	(7, 42, 'xray', '203.0.113.1', ?, ?),
	(8, 42, 'xray', '203.0.113.2', ?, ?),
	(8, 42, 'xray', '203.0.113.3', ?, ?);`,
		at(-3*time.Second), at(0), at(-2*time.Second), at(0), at(-1*time.Second), at(0)); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(db, "sqlite")
	endpoints, err := repo.activeLimiterEndpointsForNode(ctx, 7, now.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if len(endpoints) != 3 {
		t.Fatalf("endpoints = %d, want all three devices of user 42 across nodes: %#v", len(endpoints), endpoints)
	}
	if blocks := xrayIPBlocksForNode(endpoints, 7); len(blocks) != 0 {
		t.Fatalf("node 7 blocks = %v, want none because the blocked device is only seen on node 8", blocks)
	}
	if onNode8 := xrayIPBlocksForNode(endpoints, 8); len(onNode8) != 1 || onNode8[0].GetIp() != "203.0.113.3" {
		t.Fatalf("node 8 blocks = %v, want the third device 203.0.113.3", onNode8)
	}
}

func TestHoldIPBlocksKeepsBlockForFullTTL(t *testing.T) {
	t0 := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	fresh := xrayIPBlocksForLimiterEndpoints([]limiterEndpoint{
		{NodeID: 1, UserID: 301, Limit: 1, Protocol: "xray", IP: "203.0.113.30", FirstSeenAt: t0, LastSeenAt: t0},
		{NodeID: 1, UserID: 301, Limit: 1, Protocol: "xray", IP: "203.0.113.31", FirstSeenAt: t0.Add(time.Second), LastSeenAt: t0},
	})
	if got := holdIPBlocks(1, fresh, t0); len(got) != 1 || got[0].GetIp() != "203.0.113.31" {
		t.Fatalf("initial blocks = %v, want 203.0.113.31", got)
	}
	if got := holdIPBlocks(1, nil, t0.Add(60*time.Second)); len(got) != 1 || got[0].GetIp() != "203.0.113.31" {
		t.Fatalf("block must still hold 60s later while the device is blocked, got %v", got)
	}
	if got := holdIPBlocks(1, nil, t0.Add(time.Duration(ipBlockTTLSeconds)*time.Second+time.Second)); len(got) != 0 {
		t.Fatalf("block must expire after the TTL, got %v", got)
	}
}

func TestHoldIPBlocksAppliesOnlyOnObservingNode(t *testing.T) {
	t0 := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	fresh := xrayIPBlocksForLimiterEndpoints([]limiterEndpoint{
		{NodeID: 5, UserID: 302, Limit: 1, Protocol: "xray", IP: "203.0.113.40", FirstSeenAt: t0, LastSeenAt: t0},
		{NodeID: 5, UserID: 302, Limit: 1, Protocol: "xray", IP: "203.0.113.41", FirstSeenAt: t0.Add(time.Second), LastSeenAt: t0},
	})
	if got := holdIPBlocks(5, fresh, t0); len(got) != 1 {
		t.Fatalf("node 5 blocks = %v, want one", got)
	}
	if got := holdIPBlocks(6, nil, t0.Add(10*time.Second)); len(got) != 0 {
		t.Fatalf("node 6 did not observe the device and must not hold its block, got %v", got)
	}
}

func TestIPBlockApplyOnlyWhenSetChangesOrRefreshDue(t *testing.T) {
	t0 := time.Date(2026, 10, 13, 12, 0, 0, 0, time.UTC)
	ipBlockApplied = struct {
		sync.Mutex
		byNode map[int64]ipBlockApplyRecord
	}{byNode: map[int64]ipBlockApplyRecord{}}

	first := []*nodev1.IPBlockEntry{{Ip: "203.0.113.90", UserUid: "501", TtlSeconds: 120, Reason: "device_limit"}}
	if !ipBlockApplyDue(9, first, t0) {
		t.Fatal("first apply for a node must run")
	}
	recordIPBlockApply(9, first, t0)
	if ipBlockApplyDue(9, first, t0.Add(10*time.Second)) {
		t.Fatal("unchanged set inside the refresh interval must not be re-applied")
	}
	if !ipBlockApplyDue(9, first, t0.Add(ipBlockApplyRefreshInterval)) {
		t.Fatal("non-empty set must be refreshed for its TTL")
	}
	changed := []*nodev1.IPBlockEntry{{Ip: "203.0.113.91", UserUid: "501", TtlSeconds: 120, Reason: "device_limit"}}
	if !ipBlockApplyDue(9, changed, t0.Add(10*time.Second)) {
		t.Fatal("changed set must be applied immediately")
	}
	recordIPBlockApply(9, nil, t0.Add(20*time.Second))
	if ipBlockApplyDue(9, nil, t0.Add(10*time.Minute)) {
		t.Fatal("an empty set that is already cleared must not be sent again")
	}
}

func TestActiveLimiterEndpointsAllNodesCoversEveryLimitedUser(t *testing.T) {
	ctx := context.Background()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "all-nodes.db")+"?_pragma=busy_timeout(30000)")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.ExecContext(ctx, `
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL DEFAULT 0);
CREATE TABLE user_online_ips (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	ip TEXT NOT NULL,
	first_seen_at DATETIME NULL,
	last_seen_at DATETIME NOT NULL,
	UNIQUE(node_id, user_id, protocol, ip)
);
CREATE TABLE vpn_user_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	session_id TEXT NOT NULL,
	assigned_ip TEXT NULL,
	client_ip TEXT NULL,
	started_at DATETIME NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME NULL,
	UNIQUE(node_id, session_id)
);`); err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	stamp := now.Format("2006-01-02 15:04:05.000000")
	if _, err := db.ExecContext(ctx, `
INSERT INTO users (id, ip_limit) VALUES (601, 2), (602, 0), (603, 1);
INSERT INTO user_online_ips (node_id, user_id, protocol, ip, first_seen_at, last_seen_at) VALUES
	(1, 601, 'xray', '203.0.113.61', ?, ?),
	(2, 601, 'xray', '203.0.113.62', ?, ?),
	(2, 602, 'xray', '203.0.113.70', ?, ?),
	(3, 603, 'xray', '203.0.113.80', ?, ?);`, stamp, stamp, stamp, stamp, stamp, stamp, stamp, stamp); err != nil {
		t.Fatal(err)
	}

	repo := NewRepository(db, "sqlite")
	endpoints, err := repo.activeLimiterEndpoints(ctx, 0, now.Add(-time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	seen := map[int64]int{}
	for _, endpoint := range endpoints {
		seen[endpoint.UserID]++
	}
	if seen[601] != 2 || seen[603] != 1 {
		t.Fatalf("all-nodes endpoints = %v, want both devices of user 601 and the device of user 603", seen)
	}
	if seen[602] != 0 {
		t.Fatalf("user without a limit must not be evaluated, got %d endpoints", seen[602])
	}
	blocks := xrayIPBlocksForNode(endpoints, 2)
	if len(blocks) != 0 {
		t.Fatalf("user 601 has two devices within limit 2, node 2 must block nothing, got %v", blocks)
	}
}

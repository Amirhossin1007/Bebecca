package api

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestNodeSessionAdmissionClosesAddresslessLegacySession(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "sessions.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL);
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
	inbound_tag TEXT,
	session_id TEXT NOT NULL,
	assigned_ip TEXT,
	client_ip TEXT,
	started_at DATETIME NOT NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME,
	UNIQUE(node_id, session_id)
);
INSERT INTO users (id, ip_limit) VALUES (42, 1);
INSERT INTO vpn_user_sessions (node_id, user_id, protocol, session_id, started_at, last_seen_at)
VALUES (7, 42, 'ov', 'ov:legacy', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`); err != nil {
		t.Fatal(err)
	}

	server := &Server{db: db}
	err = server.applyNodeSessionEvent(context.Background(), nodeSessionEventPayload{
		NodeID:     7,
		UserID:     42,
		Protocol:   "ov",
		InboundTag: "ov-main",
		SessionID:  "ov:new",
		AssignedIP: "10.66.0.2",
		ClientIP:   "198.51.100.10",
		Event:      "start",
	})
	if err != nil {
		t.Fatal(err)
	}
	var active, closed int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE user_id = 42 AND ended_at IS NULL`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE session_id = 'ov:legacy' AND ended_at IS NOT NULL`).Scan(&closed); err != nil {
		t.Fatal(err)
	}
	if active != 1 || closed != 1 {
		t.Fatalf("active=%d closed_legacy=%d", active, closed)
	}
}

func TestNodeSessionAdmissionReplacesOpenVPNReconnect(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "sessions.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL);
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
	inbound_tag TEXT,
	session_id TEXT NOT NULL,
	assigned_ip TEXT,
	client_ip TEXT,
	started_at DATETIME NOT NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME,
	UNIQUE(node_id, session_id)
);
INSERT INTO users (id, ip_limit) VALUES (42, 1);
INSERT INTO vpn_user_sessions (node_id, user_id, protocol, inbound_tag, session_id, assigned_ip, client_ip, started_at, last_seen_at)
VALUES (7, 42, 'ov', 'ov-main', 'ov:first', '10.66.0.2', '198.51.100.10', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`); err != nil {
		t.Fatal(err)
	}

	server := &Server{db: db}
	err = server.applyNodeSessionEvent(context.Background(), nodeSessionEventPayload{
		NodeID:     7,
		UserID:     42,
		Protocol:   "ov",
		InboundTag: "ov-main",
		SessionID:  "ov:second",
		AssignedIP: "10.66.0.2",
		ClientIP:   "198.51.100.11",
		Event:      "start",
	})
	if err != nil {
		t.Fatal(err)
	}
	var active, replaced int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE user_id = 42 AND ended_at IS NULL`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE session_id = 'ov:first' AND ended_at IS NOT NULL`).Scan(&replaced); err != nil {
		t.Fatal(err)
	}
	if active != 1 || replaced != 1 {
		t.Fatalf("active=%d replaced=%d", active, replaced)
	}
}

func TestNodeSessionAdmissionExpiresStaleWireGuardSession(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "sessions.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL);
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
	inbound_tag TEXT,
	session_id TEXT NOT NULL,
	assigned_ip TEXT,
	client_ip TEXT,
	started_at DATETIME NOT NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME,
	UNIQUE(node_id, session_id)
);
INSERT INTO users (id, ip_limit) VALUES (42, 1);
INSERT INTO vpn_user_sessions (node_id, user_id, protocol, session_id, assigned_ip, client_ip, started_at, last_seen_at)
VALUES (7, 42, 'wg', 'wg:stale', '10.70.0.2', '198.51.100.10', datetime('now', '-10 minutes'), datetime('now', '-10 minutes'));`); err != nil {
		t.Fatal(err)
	}

	server := &Server{db: db}
	if err := server.applyNodeSessionEvent(context.Background(), nodeSessionEventPayload{
		NodeID:     7,
		UserID:     42,
		Protocol:   "wg",
		InboundTag: "wg-main",
		SessionID:  "wg:fresh",
		AssignedIP: "10.70.0.3",
		ClientIP:   "198.51.100.11",
		Event:      "start",
	}); err != nil {
		t.Fatal(err)
	}
	var active, closed int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE user_id = 42 AND ended_at IS NULL`).Scan(&active); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE session_id = 'wg:stale' AND ended_at IS NOT NULL`).Scan(&closed); err != nil {
		t.Fatal(err)
	}
	if active != 1 || closed != 1 {
		t.Fatalf("active=%d closed_stale=%d", active, closed)
	}
}

func openSharedLimitTestDB(t *testing.T, ipLimit int64, xrayIP string, xrayLastSeen time.Time) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "shared-limit.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.Exec(`
CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NOT NULL);
CREATE TABLE vpn_user_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	inbound_tag TEXT,
	session_id TEXT NOT NULL,
	assigned_ip TEXT,
	client_ip TEXT,
	started_at DATETIME NOT NULL,
	last_seen_at DATETIME NOT NULL,
	ended_at DATETIME,
	UNIQUE(node_id, session_id)
);
CREATE TABLE user_online_ips (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	node_id INTEGER NOT NULL,
	user_id INTEGER NOT NULL,
	protocol TEXT NOT NULL,
	ip TEXT NOT NULL,
	first_seen_at DATETIME NULL,
	last_seen_at DATETIME NOT NULL,
	UNIQUE(node_id, user_id, protocol, ip)
);`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, ip_limit) VALUES (42, ?)`, ipLimit); err != nil {
		t.Fatal(err)
	}
	if xrayIP != "" {
		stamp := xrayLastSeen.UTC().Format("2006-01-02 15:04:05.000000")
		if _, err := db.Exec(`INSERT INTO user_online_ips (node_id, user_id, protocol, ip, first_seen_at, last_seen_at) VALUES (7, 42, 'xray', ?, ?, ?)`, xrayIP, stamp, stamp); err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func wgStartEvent(sessionID string, assignedIP string, clientIP string) nodeSessionEventPayload {
	return nodeSessionEventPayload{
		NodeID:     7,
		UserID:     42,
		Protocol:   "wg",
		InboundTag: "wg-main",
		SessionID:  sessionID,
		AssignedIP: assignedIP,
		ClientIP:   clientIP,
		Event:      "start",
	}
}

func TestNodeSessionAdmissionCountsXrayDevicesTowardVPNLimit(t *testing.T) {
	db := openSharedLimitTestDB(t, 1, "203.0.113.5", time.Now())
	server := &Server{db: db}
	err := server.applyNodeSessionEvent(context.Background(), wgStartEvent("wg:second", "10.70.0.3", "198.51.100.10"))
	if err != errDeviceLimitReached {
		t.Fatalf("WireGuard device with an Xray device already at the limit: err = %v, want device limit reached", err)
	}
	var sessions int
	if err := db.QueryRow(`SELECT COUNT(*) FROM vpn_user_sessions WHERE session_id = 'wg:second'`).Scan(&sessions); err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatalf("rejected session was stored")
	}
}

func TestNodeSessionAdmissionAllowsSameDeviceAcrossProtocols(t *testing.T) {
	db := openSharedLimitTestDB(t, 1, "198.51.100.10", time.Now())
	server := &Server{db: db}
	if err := server.applyNodeSessionEvent(context.Background(), wgStartEvent("wg:same-device", "10.70.0.3", "198.51.100.10")); err != nil {
		t.Fatalf("same device over WireGuard and Xray must be admitted: %v", err)
	}
}

func TestNodeSessionAdmissionIgnoresTunneledXrayIP(t *testing.T) {
	db := openSharedLimitTestDB(t, 2, "10.70.0.2", time.Now())
	if _, err := db.Exec(`INSERT INTO vpn_user_sessions (node_id, user_id, protocol, inbound_tag, session_id, assigned_ip, client_ip, started_at, last_seen_at)
VALUES (7, 42, 'wg', 'wg-main', 'wg:first', '10.70.0.2', '198.51.100.20', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	server := &Server{db: db}
	if err := server.applyNodeSessionEvent(context.Background(), wgStartEvent("wg:second", "10.70.0.9", "198.51.100.30")); err != nil {
		t.Fatalf("Xray traffic tunneled through a VPN address must not count as a second device: %v", err)
	}
}

func TestNodeSessionAdmissionIgnoresStaleXrayIP(t *testing.T) {
	db := openSharedLimitTestDB(t, 1, "203.0.113.7", time.Now().Add(-2*time.Minute))
	server := &Server{db: db}
	if err := server.applyNodeSessionEvent(context.Background(), wgStartEvent("wg:fresh", "10.70.0.3", "198.51.100.40")); err != nil {
		t.Fatalf("an Xray IP that is no longer online must not hold a device slot: %v", err)
	}
}

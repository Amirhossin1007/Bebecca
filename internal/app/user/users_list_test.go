package user

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestUsersListIncludesOpenTunnelSessionsInOnlineStatus(t *testing.T) {
	local := time.Local
	time.Local = time.FixedZone("UTC+03:30", 3*60*60+30*60)
	defer func() { time.Local = local }()

	db, err := sql.Open("sqlite", "file:users-list-online?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, statement := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, status TEXT, used_traffic BIGINT, created_at DATETIME, expire BIGINT, data_limit BIGINT, data_limit_reset_strategy TEXT, online_at DATETIME, service_id BIGINT, admin_id BIGINT, credential_key TEXT, subadress TEXT, flow TEXT, on_hold_expire_duration BIGINT)`,
		`CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT)`,
		`CREATE TABLE services (id INTEGER PRIMARY KEY, name TEXT)`,
		`CREATE TABLE user_usage_logs (user_id BIGINT, used_traffic_at_reset BIGINT)`,
		`CREATE TABLE nodes (id INTEGER PRIMARY KEY, status TEXT)`,
		`CREATE TABLE user_online_ips (node_id BIGINT, user_id BIGINT, last_seen_at DATETIME)`,
		`CREATE TABLE vpn_user_sessions (node_id BIGINT, user_id BIGINT, last_seen_at DATETIME, ended_at DATETIME)`,
		`INSERT INTO nodes (id, status) VALUES (1, 'connected')`,
		`INSERT INTO users (id, username, status, used_traffic, created_at, online_at) VALUES (1, 'tunnel-user', 'active', 0, CURRENT_TIMESTAMP, NULL), (2, 'stale-user', 'active', 0, CURRENT_TIMESTAMP, datetime('now', '-10 minutes'))`,
		`INSERT INTO vpn_user_sessions (node_id, user_id, last_seen_at, ended_at) VALUES (1, 1, CURRENT_TIMESTAMP, NULL)`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}

	repo := NewRepository(db, "sqlite")
	onlineAt := func(rows []usersListRow, username string) *string {
		for _, row := range rows {
			if row.item.Username == username {
				return row.item.OnlineAt
			}
		}
		t.Fatalf("missing user %q in %#v", username, rows)
		return nil
	}
	isOnline := func(rows []usersListRow, username string) bool {
		for _, row := range rows {
			if row.item.Username == username {
				return row.item.IsOnline
			}
		}
		t.Fatalf("missing user %q in %#v", username, rows)
		return false
	}
	rows, err := repo.usersRows(context.Background(), usersFilter{}, UsersListRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 2 || onlineAt(rows, "tunnel-user") == nil {
		t.Fatalf("expected open tunnel session to be online, got %#v", rows)
	}
	if !isOnline(rows, "tunnel-user") || isOnline(rows, "stale-user") {
		t.Fatalf("unexpected explicit online flags: %#v", rows)
	}
	summary, err := repo.usersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if summary.onlineTotal != 1 {
		t.Fatalf("expected one online user, got %d", summary.onlineTotal)
	}
	if summary.total != 2 || summary.statusBreakdown["active"] != 2 || summary.usageTotal != 0 {
		t.Fatalf("unexpected combined summary: %#v", summary)
	}
	if _, err := db.Exec(`UPDATE nodes SET status = 'deleted' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}
	cached, err := repo.usersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if cached.onlineTotal != 1 {
		t.Fatalf("expected the repeated summary to use its short cache, got %d", cached.onlineTotal)
	}
	summary, err = repo.queryUsersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if summary.onlineTotal != 0 {
		t.Fatalf("expected deleted node sessions to be offline, got %d", summary.onlineTotal)
	}
	if _, err := db.Exec(`UPDATE nodes SET status = 'connected' WHERE id = 1`); err != nil {
		t.Fatal(err)
	}

	if _, err := db.Exec(`UPDATE vpn_user_sessions SET ended_at = ?`, time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
	rows, err = repo.usersRows(context.Background(), usersFilter{}, UsersListRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if value := onlineAt(rows, "tunnel-user"); value != nil {
		t.Fatalf("expected ended tunnel session to be offline, got %q", *value)
	}
	summary, err = repo.queryUsersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if summary.onlineTotal != 0 {
		t.Fatalf("expected stale online_at to be ignored, got %d", summary.onlineTotal)
	}
	if _, err := db.Exec(`INSERT INTO user_online_ips (node_id, user_id, last_seen_at) VALUES (1, 1, CURRENT_TIMESTAMP)`); err != nil {
		t.Fatal(err)
	}
	summary, err = repo.queryUsersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if summary.onlineTotal != 1 {
		t.Fatalf("expected fresh Xray activity to be online, got %d", summary.onlineTotal)
	}
	if _, err := db.Exec(`UPDATE users SET online_at = CURRENT_TIMESTAMP WHERE id = 2`); err != nil {
		t.Fatal(err)
	}
	summary, err = repo.queryUsersSummary(context.Background(), usersFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if summary.onlineTotal != 2 {
		t.Fatalf("expected the connection marker to count without a usable client IP, got %d", summary.onlineTotal)
	}
	onlines, err := repo.OnlineUsernames(context.Background(), UsersListRequest{})
	if err != nil {
		t.Fatal(err)
	}
	if len(onlines) != 2 || onlines[0] != "stale-user" || onlines[1] != "tunnel-user" {
		t.Fatalf("online usernames = %#v", onlines)
	}
}

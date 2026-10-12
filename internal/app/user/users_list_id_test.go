package user

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestUsersListSearchMatchesDatabaseUserID(t *testing.T) {
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "users-id.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, statement := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, status TEXT, used_traffic BIGINT, created_at DATETIME, expire BIGINT, data_limit BIGINT, data_limit_reset_strategy TEXT, online_at DATETIME, service_id BIGINT, admin_id BIGINT, credential_key TEXT, subscription_token TEXT, flow TEXT, on_hold_expire_duration BIGINT, note TEXT, telegram_id TEXT, contact_number TEXT)`,
		`CREATE TABLE user_presence (user_id INTEGER PRIMARY KEY, online_at DATETIME NOT NULL)`,
		`CREATE TABLE admins (id INTEGER PRIMARY KEY, username TEXT)`,
		`CREATE TABLE services (id INTEGER PRIMARY KEY, name TEXT)`,
		`CREATE TABLE user_usage_logs (user_id BIGINT, used_traffic_at_reset BIGINT)`,
		`CREATE TABLE nodes (id INTEGER PRIMARY KEY, status TEXT)`,
		`CREATE TABLE user_online_ips (node_id BIGINT, user_id BIGINT, last_seen_at DATETIME)`,
		`CREATE TABLE vpn_user_sessions (node_id BIGINT, user_id BIGINT, last_seen_at DATETIME, ended_at DATETIME)`,
		`INSERT INTO users (id, username, status, used_traffic, created_at, credential_key) VALUES (3558, 'alpha', 'active', 0, CURRENT_TIMESTAMP, 'k1'), (7, 'beta', 'active', 0, CURRENT_TIMESTAMP, 'k2')`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	repo := NewRepository(db, "sqlite")
	usernames := func(search string) []string {
		req := UsersListRequest{Search: search}
		filter, err := repo.usersFilter(req)
		if err != nil {
			t.Fatal(err)
		}
		rows, err := repo.usersRows(context.Background(), filter, req)
		if err != nil {
			t.Fatal(err)
		}
		names := make([]string, 0, len(rows))
		for _, row := range rows {
			names = append(names, row.item.Username)
		}
		return names
	}
	if got := usernames("3558"); len(got) != 1 || got[0] != "alpha" {
		t.Fatalf("numeric search should match the database user ID, got %v", got)
	}
	if got := usernames("#7"); len(got) != 1 || got[0] != "beta" {
		t.Fatalf("hash-prefixed ID search should match, got %v", got)
	}
}

func TestUsersOrderSQLSortsByDatabaseUserID(t *testing.T) {
	order := usersOrderSQL([]SortOption{{Field: "id", Direction: "desc"}})
	if !strings.Contains(order, "u.id") {
		t.Fatalf("id sort was dropped: %q", order)
	}
}

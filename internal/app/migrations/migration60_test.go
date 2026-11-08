package migrations

import (
	"context"
	"database/sql"
	"os"
	"strings"
	"testing"

	platformdb "github.com/rebeccapanel/rebecca/internal/platform/db"
)

func TestMigration60PreservesDataSQLite(t *testing.T) {
	db := openSQLiteTestDB(t)
	runMigration60Scenario(t, db, "sqlite")
}

func TestMigration60PreservesDataExternalDatabase(t *testing.T) {
	url := strings.TrimSpace(os.Getenv("REBECCA_MIGRATION60_DATABASE_URL"))
	if url == "" {
		t.Skip("REBECCA_MIGRATION60_DATABASE_URL is not set; it must point to an empty database")
	}
	pool, err := platformdb.Open(url)
	if err != nil {
		t.Fatalf("open external database: %v", err)
	}
	t.Cleanup(func() { _ = pool.DB.Close() })
	runMigration60Scenario(t, pool.DB, pool.Dialect)
}

func runMigration60Scenario(t *testing.T, db *sql.DB, dialect string) {
	t.Helper()
	ctx := context.Background()
	dialect = NormalizeDialect(dialect)
	if version, err := Version(ctx, db, dialect); err != nil {
		t.Fatalf("read schema version: %v", err)
	} else if version.GooseVersion > 0 {
		t.Fatalf("database must be empty, found schema version %d", version.GooseVersion)
	}
	if err := RunMigrationsTo(ctx, db, dialect, 59); err != nil {
		t.Fatalf("migrate to v59: %v", err)
	}
	key := QuoteIdent(dialect, "key")
	seed := []string{
		`DELETE FROM jwt`,
		`DELETE FROM ` + QuoteIdent(dialect, "system") + ``,
		`DELETE FROM tls`,
		`DELETE FROM master_node_state`,
		`INSERT INTO admins (id, username, hashed_password, role, status) VALUES (9001, 'legacy_admin', 'hash', 'standard', 'active')`,
		`INSERT INTO services (id, name) VALUES (9001, 'legacy_service')`,
		`INSERT INTO users (id, username, admin_id, status, credential_key, subadress, sub_updated_at, sub_last_user_agent) VALUES (9001, 'alice', 9001, 'active', '0123456789abcdef0123456789abcdef', 'tok-alice', '2026-05-01 10:00:00', 'v2rayNG/1.0')`,
		`INSERT INTO users (id, username, admin_id, status, credential_key, subadress, sub_last_user_agent) VALUES (9002, 'bob', 9001, 'active', 'fedcba9876543210fedcba9876543210', 'tok-bob', 'Clash')`,
		`INSERT INTO users (id, username, admin_id, status, credential_key, subadress) VALUES (9003, 'carol', 9001, 'active', '11111111111111111111111111111111', 'tok-carol')`,
		`INSERT INTO user_subscription_access (user_id, updated_at, user_agent) VALUES (9001, '2026-06-01 08:00:00', 'Happ')`,
		`UPDATE users SET online_at = '2026-04-01 12:00:00' WHERE id = 9002`,
		`INSERT INTO proxies (id, user_id, type, settings) VALUES (9001, 9001, 'vless', '{"id":"alice-uuid"}')`,
		`INSERT INTO admins_services (admin_id, service_id, used_traffic, lifetime_used_traffic, created_at, updated_at) VALUES (9001, 9001, 5, 6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		`INSERT INTO jwt (id, secret_key, subscription_secret_key, admin_secret_key) VALUES (1, 'secret-key', 'subscription-key', 'admin-key')`,
		`INSERT INTO ` + QuoteIdent(dialect, "system") + ` (id, uplink, downlink) VALUES (1, 100, 200)`,
		`INSERT INTO tls (id, ` + key + `, certificate) VALUES (1, 'private-key-value', 'certificate-value')`,
		`INSERT INTO master_node_state (id, uplink, downlink, status, updated_at) VALUES (1, 7, 8, 'connected', CURRENT_TIMESTAMP)`,
	}
	for _, statement := range seed {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatalf("seed v59 data: %v\n%s", err, statement)
		}
	}

	if err := RunMigrations(ctx, db, dialect); err != nil {
		t.Fatalf("migrate to v60: %v", err)
	}
	if err := RunMigrations(ctx, db, dialect); err != nil {
		t.Fatalf("v60 must be re-runnable: %v", err)
	}

	assertDBInt64Migration(t, db, `SELECT COUNT(*) FROM user_presence WHERE user_id = 9002 AND online_at IS NOT NULL`, 1)
	assertDBStringMigration(t, db, `SELECT subscription_token FROM users WHERE id = 9001`, "tok-alice")
	assertDBStringMigration(t, db, `SELECT subscription_token FROM users WHERE id = 9002`, "tok-bob")
	assertDBStringMigration(t, db, `SELECT subscription_token FROM users WHERE id = 9003`, "tok-carol")
	assertDBStringMigration(t, db, `SELECT credential_key FROM users WHERE id = 9001`, "0123456789abcdef0123456789abcdef")
	assertDBStringMigration(t, db, `SELECT user_agent FROM user_subscription_access WHERE user_id = 9001`, "Happ")
	assertDBStringMigration(t, db, `SELECT user_agent FROM user_subscription_access WHERE user_id = 9002`, "Clash")
	assertDBInt64Migration(t, db, `SELECT COUNT(*) FROM user_subscription_access WHERE user_id = 9003`, 0)
	assertDBInt64Migration(t, db, `SELECT COUNT(*) FROM user_credentials WHERE user_id = 9001 AND type = 'vless' AND settings LIKE '%alice-uuid%'`, 1)
	assertDBInt64Migration(t, db, `SELECT used_traffic FROM service_admins WHERE admin_id = 9001 AND service_id = 9001`, 5)
	assertDBInt64Migration(t, db, `SELECT lifetime_used_traffic FROM service_admins WHERE admin_id = 9001 AND service_id = 9001`, 6)
	assertDBStringMigration(t, db, `SELECT secret_key FROM auth_secrets WHERE id = 1`, "secret-key")
	assertDBInt64Migration(t, db, `SELECT uplink FROM master_usage WHERE id = 1`, 100)
	assertDBInt64Migration(t, db, `SELECT downlink FROM master_usage WHERE id = 1`, 200)
	assertDBStringMigration(t, db, `SELECT `+QuoteIdent(dialect, "private_key")+` FROM default_certificates WHERE id = 1`, "private-key-value")

	for _, table := range []string{"proxies", "admins_services", "jwt", "system", "tls", "master_node_state"} {
		assertNoTable(t, ctx, db, dialect, table)
	}
	assertNoColumn(t, ctx, db, dialect, "users", "subadress")
	assertNoColumn(t, ctx, db, dialect, "users", "online_at")
	assertNoColumn(t, ctx, db, dialect, "users", "sub_updated_at")
	assertNoColumn(t, ctx, db, dialect, "users", "sub_last_user_agent")
	assertNoColumn(t, ctx, db, dialect, "panel_settings", "backup_enabled")
	assertNoColumn(t, ctx, db, dialect, "panel_settings", "backup_cron_schedule")
}

package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000060_schema_v2_cleanup.go", up000060SchemaV2Cleanup, emptyDown)
}

// up000060SchemaV2Cleanup removes objects nothing reads, moves duplicated
// subscription metadata into the table that already owns it, and renames
// tables and columns to what they store. Each step checks the live schema
// first, so a run interrupted on MySQL (which commits DDL as it goes) can be
// retried without losing data.
func up000060SchemaV2Cleanup(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()

	hasUpdatedAt, err := HasColumn(ctx, tx, dialect, "users", "sub_updated_at")
	if err != nil {
		return err
	}
	hasUserAgent, err := HasColumn(ctx, tx, dialect, "users", "sub_last_user_agent")
	if err != nil {
		return err
	}
	if hasUpdatedAt || hasUserAgent {
		// A user-agent without a timestamp takes the account creation time, the
		// earliest moment the user could have been seen.
		updatedAt := "COALESCE(u.created_at, CURRENT_TIMESTAMP)"
		where := "u.sub_last_user_agent IS NOT NULL"
		if hasUpdatedAt {
			updatedAt = "COALESCE(u.sub_updated_at, u.created_at, CURRENT_TIMESTAMP)"
			where = "u.sub_updated_at IS NOT NULL OR u.sub_last_user_agent IS NOT NULL"
		}
		userAgent := "NULL"
		if hasUserAgent {
			userAgent = "u.sub_last_user_agent"
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_subscription_access (user_id, updated_at, user_agent)
SELECT u.id, `+updatedAt+`, `+userAgent+` FROM users u
WHERE (`+where+`) AND NOT EXISTS (SELECT 1 FROM user_subscription_access usa WHERE usa.user_id = u.id)`); err != nil {
			return err
		}
	}
	hasOnlineAt, err := HasColumn(ctx, tx, dialect, "users", "online_at")
	if err != nil {
		return err
	}
	if hasOnlineAt {
		// user_presence is the only source of last-seen time; it wins over the
		// legacy column whenever both exist, so only missing rows are copied.
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_presence (user_id, online_at)
SELECT u.id, u.online_at FROM users u
WHERE u.online_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_presence up WHERE up.user_id = u.id)`); err != nil {
			return err
		}
		if _, err := DropIndexIfExists(ctx, tx, dialect, "users", "ix_users_online_at"); err != nil {
			return err
		}
		if _, err := DropColumnIfExists(ctx, tx, dialect, "users", "online_at"); err != nil {
			return err
		}
	}
	for _, column := range []string{"sub_updated_at", "sub_last_user_agent"} {
		if _, err := DropColumnIfExists(ctx, tx, dialect, "users", column); err != nil {
			return err
		}
	}

	if err := DropTableIfExists(ctx, tx, dialect, "master_node_state"); err != nil {
		return err
	}
	for _, column := range []string{"backup_enabled", "backup_cron_schedule"} {
		if _, err := DropColumnIfExists(ctx, tx, dialect, "panel_settings", column); err != nil {
			return err
		}
	}

	tableRenames := [][2]string{
		{"proxies", "user_credentials"},
		{"admins_services", "service_admins"},
		{"jwt", "auth_secrets"},
		{"system", "master_usage"},
		{"tls", "default_certificates"},
	}
	for _, rename := range tableRenames {
		if _, err := RenameTableIfExists(ctx, tx, dialect, rename[0], rename[1]); err != nil {
			return err
		}
	}
	if _, err := RenameColumnIfExists(ctx, tx, dialect, "users", "subadress", "subscription_token"); err != nil {
		return err
	}
	if _, err := RenameColumnIfExists(ctx, tx, dialect, "default_certificates", "key", "private_key"); err != nil {
		return err
	}
	return nil
}

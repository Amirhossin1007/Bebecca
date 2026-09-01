package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000053_runtime_activity.go", up000053RuntimeActivity, emptyDown)
}

func up000053RuntimeActivity(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if err := createTable(ctx, tx, dialect, "user_presence", `
CREATE TABLE user_presence (
	user_id INTEGER PRIMARY KEY,
	online_at DATETIME NOT NULL
)`, `
CREATE TABLE user_presence (
	user_id BIGINT NOT NULL PRIMARY KEY,
	online_at DATETIME(6) NOT NULL,
	KEY ix_user_presence_online_at (online_at)
)`); err != nil {
		return err
	}
	if err := createTable(ctx, tx, dialect, "user_subscription_access", `
CREATE TABLE user_subscription_access (
	user_id INTEGER PRIMARY KEY,
	updated_at DATETIME NOT NULL,
	user_agent VARCHAR(512) NULL
)`, `
CREATE TABLE user_subscription_access (
	user_id BIGINT NOT NULL PRIMARY KEY,
	updated_at DATETIME(6) NOT NULL,
	user_agent VARCHAR(512) NULL,
	KEY ix_user_subscription_access_updated_at (updated_at)
)`); err != nil {
		return err
	}
	if dialect == "sqlite" {
		if _, err := CreateIndexIfMissing(ctx, tx, dialect, "user_presence", "ix_user_presence_online_at", []string{"online_at"}, false); err != nil {
			return err
		}
		if _, err := CreateIndexIfMissing(ctx, tx, dialect, "user_subscription_access", "ix_user_subscription_access_updated_at", []string{"updated_at"}, false); err != nil {
			return err
		}
	}
	if hasOnlineAt, err := HasColumn(ctx, tx, dialect, "users", "online_at"); err != nil {
		return err
	} else if hasOnlineAt {
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_presence (user_id, online_at)
SELECT id, online_at FROM users WHERE online_at IS NOT NULL`); err != nil {
			return err
		}
	}
	hasSubUpdatedAt, err := HasColumn(ctx, tx, dialect, "users", "sub_updated_at")
	if err != nil {
		return err
	}
	hasSubUserAgent, err := HasColumn(ctx, tx, dialect, "users", "sub_last_user_agent")
	if err != nil {
		return err
	}
	if hasSubUpdatedAt {
		userAgent := "NULL"
		if hasSubUserAgent {
			userAgent = "sub_last_user_agent"
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO user_subscription_access (user_id, updated_at, user_agent)
SELECT id, sub_updated_at, `+userAgent+` FROM users WHERE sub_updated_at IS NOT NULL`); err != nil {
			return err
		}
	}
	for _, table := range []string{"node_usage_user_queue", "node_usage_outbound_queue"} {
		exists, err := HasTable(ctx, tx, dialect, table)
		if err != nil {
			return err
		}
		if !exists {
			continue
		}
		definition := "DATETIME NULL"
		if dialect == "mysql" {
			definition = "DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6)"
		}
		if _, err := AddColumnIfMissing(ctx, tx, dialect, table, "history_processed_at", definition); err != nil {
			return err
		}
		if dialect == "mysql" {
			if _, err := tx.ExecContext(ctx, `ALTER TABLE `+QuoteIdent(dialect, table)+` ALTER COLUMN history_processed_at DROP DEFAULT`); err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE `+QuoteIdent(dialect, table)+` SET history_processed_at = NULL WHERE processed_at IS NULL`); err != nil {
				return err
			}
		} else {
			if _, err := tx.ExecContext(ctx, `UPDATE `+QuoteIdent(dialect, table)+` SET history_processed_at = processed_at WHERE processed_at IS NOT NULL`); err != nil {
				return err
			}
		}
		if _, err := CreateIndexIfMissing(ctx, tx, dialect, table, "ix_"+table+"_history_pending", []string{"history_processed_at", "id"}, false); err != nil {
			return err
		}
	}
	return nil
}

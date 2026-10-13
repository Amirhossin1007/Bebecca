package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000062_user_online_ips_first_seen.go", up000062UserOnlineIPsFirstSeen, emptyDown)
}

func up000062UserOnlineIPsFirstSeen(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if ok, err := HasTable(ctx, tx, dialect, "user_online_ips"); err != nil || !ok {
		return err
	}
	if _, err := AddColumnIfMissing(ctx, tx, dialect, "user_online_ips", "first_seen_at", definitionForDialect(dialect, "DATETIME NULL", "DATETIME(6) NULL")); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE user_online_ips SET first_seen_at = last_seen_at WHERE first_seen_at IS NULL`)
	return err
}

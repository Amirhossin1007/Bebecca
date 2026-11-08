package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000064_user_speed_limit.go", up000064UserSpeedLimit, emptyDown)
}

func up000064UserSpeedLimit(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	_, err := AddColumnIfMissing(ctx, tx, dialect, "users", "speed_limit_kbps", definitionForDialect(dialect, "INTEGER NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"))
	return err
}

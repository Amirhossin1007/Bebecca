package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000049_service_limit_disabled_at.go", up000049ServiceLimitDisabledAt, emptyDown)
}

func up000049ServiceLimitDisabledAt(ctx context.Context, tx *sql.Tx) error {
	return addColumn(ctx, tx, activeDialect(), "users", "service_limit_disabled_at", "DATETIME NULL", "DATETIME NULL")
}

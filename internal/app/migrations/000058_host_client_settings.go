package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000058_host_client_settings.go", up000058HostClientSettings, emptyDown)
}

func up000058HostClientSettings(ctx context.Context, tx *sql.Tx) error {
	return addColumn(ctx, tx, activeDialect(), "hosts", "client_settings", "JSON NULL", "TEXT NULL")
}

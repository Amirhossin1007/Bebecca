package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000055_service_subscription_placeholder.go", up000055ServiceSubscriptionPlaceholder, emptyDown)
}

func up000055ServiceSubscriptionPlaceholder(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	return addColumn(ctx, tx, dialect, "services", "subscription_placeholder_settings", "TEXT NOT NULL DEFAULT '{}'", "JSON NULL")
}

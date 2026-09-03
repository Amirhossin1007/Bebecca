package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000054_subscription_placeholder.go", up000054SubscriptionPlaceholder, emptyDown)
}

func up000054SubscriptionPlaceholder(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if err := addColumn(ctx, tx, dialect, "subscription_settings", "subscription_placeholder_enabled", "INTEGER NOT NULL DEFAULT 0", "BOOLEAN NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	return addColumn(ctx, tx, dialect, "subscription_settings", "subscription_placeholder_remark", "VARCHAR(255) NOT NULL DEFAULT 'disabled'", "VARCHAR(255) NOT NULL DEFAULT 'disabled'")
}

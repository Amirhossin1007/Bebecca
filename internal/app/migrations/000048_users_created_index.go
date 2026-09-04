package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000048_users_created_index.go", up000048UsersCreatedIndex, emptyDown)
}

func up000048UsersCreatedIndex(ctx context.Context, tx *sql.Tx) error {
	return createIndex(ctx, tx, activeDialect(), "users", "ix_users_created_id", []string{"created_at", "id"}, false)
}

package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000065_entity_notes.go", up000065EntityNotes, emptyDown)
}

func up000065EntityNotes(ctx context.Context, tx *sql.Tx) error {
	dialect := NormalizeDialect(activeDialect())
	return createTable(ctx, tx, dialect, "entity_notes", `
CREATE TABLE entity_notes (
	entity_type VARCHAR(32) NOT NULL,
	entity_key VARCHAR(255) NOT NULL,
	note TEXT NOT NULL,
	updated_by VARCHAR(255) NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (entity_type, entity_key)
)`, `
CREATE TABLE entity_notes (
	entity_type VARCHAR(32) NOT NULL,
	entity_key VARCHAR(255) NOT NULL,
	note TEXT NOT NULL,
	updated_by VARCHAR(255) NOT NULL,
	updated_at BIGINT NOT NULL,
	PRIMARY KEY (entity_type, entity_key)
)`)
}

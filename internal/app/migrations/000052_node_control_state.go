package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000052_node_control_state.go", up000052NodeControlState, emptyDown)
}

func up000052NodeControlState(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	columns := []struct {
		name, sqlite, mysql string
	}{
		{"desired_revision", "INTEGER NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"},
		{"applied_revision", "INTEGER NOT NULL DEFAULT 0", "BIGINT NOT NULL DEFAULT 0"},
		{"agent_status", "TEXT NOT NULL DEFAULT 'unknown'", "VARCHAR(16) NOT NULL DEFAULT 'unknown'"},
		{"xray_status", "TEXT NOT NULL DEFAULT 'unknown'", "VARCHAR(16) NOT NULL DEFAULT 'unknown'"},
		{"node_capabilities", "TEXT NULL", "JSON NULL"},
		{"last_seen_at", "DATETIME NULL", "DATETIME NULL"},
	}
	for _, column := range columns {
		if err := addColumn(ctx, tx, dialect, "nodes", column.name, column.sqlite, column.mysql); err != nil {
			return err
		}
	}
	if hasStatus, err := HasColumn(ctx, tx, dialect, "nodes", "status"); err != nil {
		return err
	} else if hasStatus {
		if _, err := tx.ExecContext(ctx, `UPDATE nodes SET
agent_status = CASE WHEN status = 'connected' THEN 'connected' WHEN status = 'error' THEN 'error' ELSE 'unknown' END,
xray_status = 'unknown'`); err != nil {
			return err
		}
	}
	return nil
}

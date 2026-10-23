package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000063_service_usage_coefficients.go", up000063ServiceUsageCoefficients, emptyDown)
}

func up000063ServiceUsageCoefficients(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if _, err := AddColumnIfMissing(ctx, tx, dialect, "services", "usage_coefficient", definitionForDialect(dialect, "REAL NOT NULL DEFAULT 1.0", "DOUBLE NOT NULL DEFAULT 1.0")); err != nil {
		return err
	}
	_, err := AddColumnIfMissing(ctx, tx, dialect, "service_admins", "usage_coefficient", definitionForDialect(dialect, "REAL NULL", "DOUBLE NULL"))
	return err
}

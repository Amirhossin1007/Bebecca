package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000051_host_tls_verification.go", up000051HostTLSVerification, emptyDown)
}

func up000051HostTLSVerification(ctx context.Context, tx *sql.Tx) error {
	dialect := activeDialect()
	if err := addColumn(ctx, tx, dialect, "hosts", "verify_peer_cert_by_name", "TEXT NULL", "TEXT NULL"); err != nil {
		return err
	}
	return addColumn(ctx, tx, dialect, "hosts", "pinned_peer_cert_sha256", "TEXT NULL", "TEXT NULL")
}

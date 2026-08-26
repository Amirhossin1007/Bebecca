package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000050_haproxy.go", up000050HAProxy, emptyDown)
}

func up000050HAProxy(ctx context.Context, tx *sql.Tx) error {
	if err := createTable(ctx, tx, activeDialect(), "haproxy_configs", `
CREATE TABLE haproxy_configs (
	id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	name VARCHAR(128) NOT NULL,
	enabled INTEGER NOT NULL DEFAULT 0,
	settings TEXT NOT NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL
)`, `
CREATE TABLE haproxy_configs (
	id BIGINT NOT NULL AUTO_INCREMENT,
	name VARCHAR(128) NOT NULL,
	enabled BOOLEAN NOT NULL DEFAULT FALSE,
	settings JSON NOT NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	PRIMARY KEY (id)
)`); err != nil {
		return err
	}
	if err := createTable(ctx, tx, activeDialect(), "haproxy_targets", `
CREATE TABLE haproxy_targets (
	config_id INTEGER NOT NULL,
	node_id INTEGER NOT NULL UNIQUE,
	listeners TEXT NOT NULL,
	PRIMARY KEY (config_id, node_id),
	FOREIGN KEY (config_id) REFERENCES haproxy_configs(id) ON DELETE CASCADE
)`, `
CREATE TABLE haproxy_targets (
	config_id BIGINT NOT NULL,
	node_id BIGINT NOT NULL,
	listeners JSON NOT NULL,
	PRIMARY KEY (config_id, node_id),
	UNIQUE KEY uq_haproxy_target_node (node_id),
	CONSTRAINT fk_haproxy_target_config FOREIGN KEY (config_id) REFERENCES haproxy_configs(id) ON DELETE CASCADE
)`); err != nil {
		return err
	}
	return createTable(ctx, tx, activeDialect(), "haproxy_templates", `
CREATE TABLE haproxy_templates (
	id VARCHAR(64) NOT NULL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	archive BLOB NOT NULL,
	created_at DATETIME NOT NULL
)`, `
CREATE TABLE haproxy_templates (
	id VARCHAR(64) NOT NULL,
	name VARCHAR(255) NOT NULL,
	archive LONGBLOB NOT NULL,
	created_at DATETIME NOT NULL,
	PRIMARY KEY (id)
)`)
}

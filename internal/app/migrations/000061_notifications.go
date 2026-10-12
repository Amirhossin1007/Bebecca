package migrations

import (
	"context"
	"database/sql"

	"github.com/pressly/goose/v3"
)

func init() {
	goose.AddNamedMigrationContext("000061_notifications.go", up000061Notifications, emptyDown)
}

func up000061Notifications(ctx context.Context, tx *sql.Tx) error {
	dialect := NormalizeDialect(activeDialect())
	if err := createTable(ctx, tx, dialect, "notifications", `
CREATE TABLE notifications (
	id INTEGER PRIMARY KEY,
	kind VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	body TEXT NOT NULL,
	sender_admin_id INTEGER NULL,
	sender_username VARCHAR(255) NOT NULL,
	created_at INTEGER NOT NULL
)`, `
CREATE TABLE notifications (
	id BIGINT NOT NULL AUTO_INCREMENT,
	kind VARCHAR(64) NOT NULL,
	title VARCHAR(255) NOT NULL,
	body TEXT NOT NULL,
	sender_admin_id BIGINT NULL,
	sender_username VARCHAR(255) NOT NULL,
	created_at BIGINT NOT NULL,
	PRIMARY KEY (id)
)`); err != nil {
		return err
	}
	if err := createIndex(ctx, tx, dialect, "notifications", "ix_notifications_created", []string{"created_at"}, false); err != nil {
		return err
	}
	if err := createTable(ctx, tx, dialect, "notification_recipients", `
CREATE TABLE notification_recipients (
	notification_id INTEGER NOT NULL,
	admin_id INTEGER NOT NULL,
	read_at INTEGER NULL,
	PRIMARY KEY (notification_id, admin_id)
)`, `
CREATE TABLE notification_recipients (
	notification_id BIGINT NOT NULL,
	admin_id BIGINT NOT NULL,
	read_at BIGINT NULL,
	PRIMARY KEY (notification_id, admin_id)
)`); err != nil {
		return err
	}
	if err := createIndex(ctx, tx, dialect, "notification_recipients", "ix_notification_recipients_admin", []string{"admin_id", "read_at"}, false); err != nil {
		return err
	}
	if err := createTable(ctx, tx, dialect, "notification_rules", `
CREATE TABLE notification_rules (
	rule_key VARCHAR(64) PRIMARY KEY,
	enabled INTEGER NOT NULL,
	threshold INTEGER NOT NULL,
	title VARCHAR(255) NOT NULL,
	body VARCHAR(1000) NOT NULL,
	updated_at INTEGER NOT NULL
)`, `
CREATE TABLE notification_rules (
	rule_key VARCHAR(64) NOT NULL,
	enabled INTEGER NOT NULL,
	threshold BIGINT NOT NULL,
	title VARCHAR(255) NOT NULL,
	body VARCHAR(1000) NOT NULL,
	updated_at BIGINT NOT NULL,
	PRIMARY KEY (rule_key)
)`); err != nil {
		return err
	}
	return createTable(ctx, tx, dialect, "notification_rule_states", `
CREATE TABLE notification_rule_states (
	rule_key VARCHAR(64) NOT NULL,
	subject_id INTEGER NOT NULL,
	active INTEGER NOT NULL,
	updated_at INTEGER NOT NULL,
	PRIMARY KEY (rule_key, subject_id)
)`, `
CREATE TABLE notification_rule_states (
	rule_key VARCHAR(64) NOT NULL,
	subject_id BIGINT NOT NULL,
	active INTEGER NOT NULL,
	updated_at BIGINT NOT NULL,
	PRIMARY KEY (rule_key, subject_id)
)`)
}

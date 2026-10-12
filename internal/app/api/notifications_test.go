//go:build cgo

package api

import (
	"encoding/json"
	"net/http"
	"testing"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
)

func TestNotificationsRolesAndSending(t *testing.T) {
	server, db := testAdminServer(t)
	for _, statement := range []string{
		`CREATE TABLE notifications (id INTEGER PRIMARY KEY, kind VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL, body TEXT NOT NULL, sender_admin_id INTEGER NULL, sender_username VARCHAR(255) NOT NULL, created_at INTEGER NOT NULL)`,
		`CREATE TABLE notification_recipients (notification_id INTEGER NOT NULL, admin_id INTEGER NOT NULL, read_at INTEGER NULL, PRIMARY KEY (notification_id, admin_id))`,
		`CREATE TABLE notification_rules (rule_key VARCHAR(64) PRIMARY KEY, enabled INTEGER NOT NULL, threshold INTEGER NOT NULL, title VARCHAR(255) NOT NULL, body VARCHAR(1000) NOT NULL, updated_at INTEGER NOT NULL)`,
		`CREATE TABLE notification_rule_states (rule_key VARCHAR(64) NOT NULL, subject_id INTEGER NOT NULL, active INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (rule_key, subject_id))`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	insertMasterAPIAdmin(t, db, 1, "owner", "pass123", adminapp.RoleFullAccess, adminapp.StatusActive)
	insertMasterAPIAdmin(t, db, 2, "ops", "pass123", adminapp.RoleSudo, adminapp.StatusActive)
	insertMasterAPIAdmin(t, db, 3, "alice", "pass123", adminapp.RoleStandard, adminapp.StatusActive)
	owner := adminBearerToken(t, server, "owner", "pass123")
	ops := adminBearerToken(t, server, "ops", "pass123")
	alice := adminBearerToken(t, server, "alice", "pass123")

	rec := adminJSONRequest(t, server, http.MethodPost, "/api/notifications", alice, `{"title":"x","body":"y","audience":"all"}`)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("standard admin send status=%d body=%s, want 403", rec.Code, rec.Body.String())
	}

	rec = adminJSONRequest(t, server, http.MethodPost, "/api/notifications", ops, `{"title":"Maintenance","body":"Tonight at 22:00","audience":"all"}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("sudo send status=%d body=%s, want 201", rec.Code, rec.Body.String())
	}
	var sent struct {
		Recipients int `json:"recipients"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &sent); err != nil || sent.Recipients != 2 {
		t.Fatalf("send response = %s, want 2 recipients", rec.Body.String())
	}

	rec = adminJSONRequest(t, server, http.MethodGet, "/api/notifications", alice, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("inbox status=%d body=%s", rec.Code, rec.Body.String())
	}
	var inbox struct {
		Unread int64 `json:"unread"`
		Total  int64 `json:"total"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &inbox); err != nil || inbox.Total != 1 || inbox.Unread != 1 {
		t.Fatalf("alice inbox = %s, want one unread", rec.Body.String())
	}

	rec = adminJSONRequest(t, server, http.MethodPost, "/api/notifications/read", alice, `{"all":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("mark read status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = adminJSONRequest(t, server, http.MethodGet, "/api/notifications/rules", ops, "")
	if rec.Code != http.StatusForbidden {
		t.Fatalf("sudo reading rules status=%d, want 403", rec.Code)
	}
	rec = adminJSONRequest(t, server, http.MethodGet, "/api/notifications/rules", owner, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("owner reading rules status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = adminJSONRequest(t, server, http.MethodPut, "/api/notifications/rules/admin_traffic", owner, `{"enabled":true,"threshold":0,"title":"t","body":"b"}`)
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid threshold status=%d body=%s, want 422", rec.Code, rec.Body.String())
	}
	rec = adminJSONRequest(t, server, http.MethodPut, "/api/notifications/rules/admin_traffic", owner, `{"enabled":true,"threshold":70,"title":"Traffic","body":"{percent}%"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("save rule status=%d body=%s", rec.Code, rec.Body.String())
	}
}

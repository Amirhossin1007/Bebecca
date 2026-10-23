package api

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
)

func newEntityNoteTestServer(t *testing.T) *Server {
	t.Helper()
	testDir := t.TempDir()
	dbPath := filepath.Join(testDir, "notes.sqlite3")
	server, err := New(Config{
		Database:                    "sqlite:///" + filepath.ToSlash(dbPath),
		CertificateBase:             filepath.Join(testDir, "certificates"),
		ExternalAppsBase:            filepath.Join(testDir, "apps"),
		JWTAccessTokenExpireMinutes: 1440,
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = server.db.Close() })
	hash, err := adminapp.HashPassword("pass123")
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range []struct{ username, role string }{
		{"root", "full_access"},
		{"ops", "sudo"},
		{"clerk", "standard"},
	} {
		if _, err := server.db.Exec(`INSERT INTO admins (username, hashed_password, role, permissions, status) VALUES (?, ?, ?, ?, ?)`, row.username, hash, row.role, "{}", "active"); err != nil {
			t.Fatal(err)
		}
	}
	return server
}

func entityNoteLogin(t *testing.T, server *Server, username string) string {
	t.Helper()
	rec := sqliteJSONRequest(server, http.MethodPost, "/api/admin/token", "", `{"username":"`+username+`","password":"pass123"}`)
	var body struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.AccessToken == "" {
		t.Fatalf("login %s failed: status=%d body=%s", username, rec.Code, rec.Body.String())
	}
	return "Bearer " + body.AccessToken
}

func TestEntityNotesVisibleOnlyToSudoAndFullAccess(t *testing.T) {
	server := newEntityNoteTestServer(t)
	root := entityNoteLogin(t, server, "root")
	ops := entityNoteLogin(t, server, "ops")
	clerk := entityNoteLogin(t, server, "clerk")

	rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/inbound/vless-a", root, `{"note":"ask before changing the port"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("full access save status=%d body=%s", rec.Code, rec.Body.String())
	}
	rec = sqliteJSONRequest(server, http.MethodGet, "/api/notes/inbound/vless-a", ops, "")
	var got entityNoteResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || rec.Code != http.StatusOK || got.Note != "ask before changing the port" || got.UpdatedBy != "root" {
		t.Fatalf("sudo read status=%d body=%s", rec.Code, rec.Body.String())
	}

	if rec := sqliteJSONRequest(server, http.MethodGet, "/api/notes/inbound/vless-a", clerk, ""); rec.Code != http.StatusForbidden {
		t.Fatalf("standard admin read status=%d want 403", rec.Code)
	}
	if rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/inbound/vless-a", clerk, `{"note":"x"}`); rec.Code != http.StatusForbidden {
		t.Fatalf("standard admin write status=%d want 403", rec.Code)
	}
	rec = sqliteJSONRequest(server, http.MethodGet, "/api/notes/inbound/vless-a", root, "")
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.Note != "ask before changing the port" {
		t.Fatalf("a rejected write must not change the note: %s", rec.Body.String())
	}
}

func TestEntityNoteAdminTargetMustExist(t *testing.T) {
	server := newEntityNoteTestServer(t)
	root := entityNoteLogin(t, server, "root")
	if rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/admin/999", root, `{"note":"x"}`); rec.Code != http.StatusNotFound {
		t.Fatalf("missing admin status=%d want 404", rec.Code)
	}
	var id int64
	if err := server.db.QueryRow(`SELECT id FROM admins WHERE username = 'clerk'`).Scan(&id); err != nil {
		t.Fatal(err)
	}
	path := "/api/notes/admin/" + strconv.FormatInt(id, 10)
	if rec := sqliteJSONRequest(server, http.MethodPut, path, root, `{"note":"handles overtime"}`); rec.Code != http.StatusOK {
		t.Fatalf("existing admin status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestEntityNoteRejectsBadTargetAndLongNotes(t *testing.T) {
	server := newEntityNoteTestServer(t)
	root := entityNoteLogin(t, server, "root")
	if rec := sqliteJSONRequest(server, http.MethodGet, "/api/notes/user/1", root, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("unknown type status=%d want 400", rec.Code)
	}
	if rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/admin/abc", root, `{"note":"x"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("non-numeric admin id status=%d want 400", rec.Code)
	}
	tooLong := strings.Repeat("ä", entityNoteMaxRunes+1)
	if rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/inbound/vless-a", root, `{"note":"`+tooLong+`"}`); rec.Code != http.StatusBadRequest {
		t.Fatalf("long note status=%d want 400", rec.Code)
	}
}

func TestEntityNoteEmptyTextClearsTheNote(t *testing.T) {
	server := newEntityNoteTestServer(t)
	root := entityNoteLogin(t, server, "root")
	sqliteJSONRequest(server, http.MethodPut, "/api/notes/inbound/vless-a", root, `{"note":"temporary"}`)
	if rec := sqliteJSONRequest(server, http.MethodPut, "/api/notes/inbound/vless-a", root, `{"note":"   "}`); rec.Code != http.StatusOK {
		t.Fatalf("clear status=%d body=%s", rec.Code, rec.Body.String())
	}
	var rows int
	if err := server.db.QueryRow(`SELECT COUNT(*) FROM entity_notes WHERE entity_type = 'inbound' AND entity_key = 'vless-a'`).Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Fatalf("cleared note still stored: rows=%d", rows)
	}
}

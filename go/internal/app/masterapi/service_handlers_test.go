//go:build cgo

package masterapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"testing"

	adminapp "github.com/rebeccapanel/rebecca/go/internal/app/admin"
	"github.com/rebeccapanel/rebecca/go/internal/app/usage"
)

func testServiceServer(t *testing.T) (*Server, *sql.DB, string) {
	t.Helper()
	server, db := testAdminServer(t)
	server.usageService = usage.NewService(usage.NewRepository(db, "sqlite"))
	statements := []string{
		`ALTER TABLE admins_services ADD COLUMN updated_at DATETIME NULL`,
		`DROP TABLE services`,
		`DROP TABLE hosts`,
		`DROP TABLE service_hosts`,
		`CREATE TABLE services (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			description TEXT NULL,
			used_traffic BIGINT DEFAULT 0,
			lifetime_used_traffic BIGINT DEFAULT 0,
			users_usage BIGINT DEFAULT 0,
			created_at DATETIME NULL,
			updated_at DATETIME NULL
		)`,
		`CREATE TABLE hosts (
			id INTEGER PRIMARY KEY,
			inbound_tag TEXT,
			remark TEXT,
			address TEXT,
			port BIGINT NULL,
			is_disabled INTEGER DEFAULT 0
		)`,
		`CREATE TABLE service_hosts (
			service_id INTEGER,
			host_id INTEGER,
			sort BIGINT DEFAULT 0,
			created_at DATETIME NULL
		)`,
		`INSERT INTO hosts (id, inbound_tag, remark, address, port, is_disabled) VALUES
			(1, 'vless-in', 'main', 'example.com', 443, 0),
			(2, 'vmess-in', 'second', 'example.org', 8443, 0)`,
	}
	for _, statement := range statements {
		if _, err := db.Exec(statement); err != nil {
			t.Fatalf("exec %q: %v", statement, err)
		}
	}
	insertMasterAPIAdmin(t, db, 1, "owner", "pass123", adminapp.RoleFullAccess, adminapp.StatusActive)
	insertMasterAPIAdmin(t, db, 2, "seller", "pass123", adminapp.RoleStandard, adminapp.StatusActive)
	return server, db, adminBearerToken(t, server, "owner", "pass123")
}

func TestServiceMutationRoutesGoNative(t *testing.T) {
	server, db, token := testServiceServer(t)

	rec := adminJSONRequest(t, server, http.MethodPost, "/api/v2/services", token, `{"name":"Basic","description":"entry","hosts":[{"host_id":1}],"admin_ids":[2]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID        int64   `json:"id"`
		HostIDs   []int64 `json:"host_ids"`
		AdminIDs  []int64 `json:"admin_ids"`
		HostCount int64   `json:"host_count"`
		HasHosts  bool    `json:"has_hosts"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.ID == 0 || len(created.HostIDs) != 1 || len(created.AdminIDs) != 1 || created.HostCount != 1 || !created.HasHosts {
		t.Fatalf("unexpected create response: %#v", created)
	}

	sellerToken := adminBearerToken(t, server, "seller", "pass123")
	rec = adminJSONRequest(t, server, http.MethodGet, "/api/v2/services", sellerToken, `{}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("seller list status = %d body=%s", rec.Code, rec.Body.String())
	}
	var list struct {
		Total    int64            `json:"total"`
		Services []map[string]any `json:"services"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &list); err != nil {
		t.Fatal(err)
	}
	if list.Total != 1 || len(list.Services) != 1 {
		t.Fatalf("seller list did not scope to assigned service: %#v", list)
	}

	rec = adminJSONRequest(t, server, http.MethodPut, "/api/v2/services/"+itoa(created.ID)+"/admins/2/limits", token, `{"data_limit":1000,"show_user_traffic":false,"delete_user_usage_limit_enabled":true}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("limit update status = %d body=%s", rec.Code, rec.Body.String())
	}
	var adminLimit struct {
		DataLimit                   *int64 `json:"data_limit"`
		ShowUserTraffic             bool   `json:"show_user_traffic"`
		DeleteUserUsageLimitEnabled bool   `json:"delete_user_usage_limit_enabled"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &adminLimit); err != nil {
		t.Fatal(err)
	}
	if adminLimit.DataLimit == nil || *adminLimit.DataLimit != 1000 || adminLimit.ShowUserTraffic || adminLimit.DeleteUserUsageLimitEnabled {
		t.Fatalf("unexpected admin limit response: %#v", adminLimit)
	}

	if _, err := db.Exec(`INSERT INTO users (id, username, admin_id, status, service_id) VALUES (10, 'svc_user', 2, 'active', ?)`, created.ID); err != nil {
		t.Fatal(err)
	}
	rec = adminJSONRequest(t, server, http.MethodPut, "/api/v2/services/"+itoa(created.ID), token, `{"hosts":[{"host_id":1},{"host_id":2,"sort":1}],"admin_ids":[2],"description":"updated"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("update status = %d body=%s", rec.Code, rec.Body.String())
	}
	assertDBInt64(t, db, `SELECT COUNT(*) FROM node_operations WHERE operation_type = 'update_user' AND user_id = 10`, 1)
	assertDBInt64(t, db, `SELECT COUNT(*) FROM node_operations WHERE operation_type = 'sync_config'`, 1)
	assertDBInt64(t, db, `SELECT data_limit FROM admins_services WHERE service_id = ? AND admin_id = 2`, 1000, created.ID)

	if _, err := db.Exec(`UPDATE services SET used_traffic = 500 WHERE id = ?`, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE admins_services SET used_traffic = 500 WHERE service_id = ? AND admin_id = 2`, created.ID); err != nil {
		t.Fatal(err)
	}
	rec = adminJSONRequest(t, server, http.MethodPost, "/api/v2/services/"+itoa(created.ID)+"/reset-usage", token, `{}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("reset usage status = %d body=%s", rec.Code, rec.Body.String())
	}
	assertDBInt64(t, db, `SELECT used_traffic FROM services WHERE id = ?`, 0, created.ID)
	assertDBInt64(t, db, `SELECT used_traffic FROM admins_services WHERE service_id = ? AND admin_id = 2`, 0, created.ID)

	rec = adminJSONRequest(t, server, http.MethodDelete, "/api/v2/services/"+itoa(created.ID), token, `{"mode":"delete_users","unlink_admins":true}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d body=%s", rec.Code, rec.Body.String())
	}
	assertDBString(t, db, `SELECT status FROM users WHERE id = 10`, "deleted")
	assertDBInt64(t, db, `SELECT COUNT(*) FROM node_operations WHERE operation_type = 'remove_user' AND user_id = 10`, 1)
}

func TestServiceMutationRollsBackWhenNodeOperationFails(t *testing.T) {
	server, db, token := testServiceServer(t)
	rec := adminJSONRequest(t, server, http.MethodPost, "/api/v2/services", token, `{"name":"Rollback","hosts":[{"host_id":1}]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create status = %d body=%s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users (id, username, admin_id, status, service_id) VALUES (11, 'rollback_user', 1, 'active', ?)`, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`DROP TABLE node_operations`); err != nil {
		t.Fatal(err)
	}
	rec = adminJSONRequest(t, server, http.MethodPut, "/api/v2/services/"+itoa(created.ID), token, `{"hosts":[{"host_id":1},{"host_id":2}]}`)
	if rec.Code == http.StatusOK {
		t.Fatalf("expected update to fail when node_operations is missing")
	}
	assertDBInt64(t, db, `SELECT COUNT(*) FROM service_hosts WHERE service_id = ?`, 1, created.ID)
}

func TestServiceUsersReadRouteGoNative(t *testing.T) {
	server, db := testUserReadServer(t)
	insertMasterAPIAdmin(t, db, 1, "owner", "pass123", adminapp.RoleFullAccess, adminapp.StatusActive)
	insertMasterAPIAdmin(t, db, 2, "seller", "pass123", adminapp.RoleStandard, adminapp.StatusActive)
	insertMasterAPIAdmin(t, db, 3, "outsider", "pass123", adminapp.RoleStandard, adminapp.StatusActive)
	if _, err := db.Exec(`INSERT INTO services (id, name) VALUES (7, 'service-users')`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO admins_services (admin_id, service_id) VALUES (2, 7)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO users (
		id, username, admin_id, status, credential_key, used_traffic, created_at, data_limit, service_id
	) VALUES
		(70, 'svc_owner_user', 1, 'active', 'key-owner', 100, '2026-06-05 00:00:00', 1000, 7),
		(71, 'svc_seller_user', 2, 'active', 'key-seller', 200, '2026-06-05 00:00:01', 1000, 7),
		(72, 'other_service_user', 2, 'active', 'key-other', 300, '2026-06-05 00:00:02', 1000, NULL)`); err != nil {
		t.Fatal(err)
	}

	sellerToken := adminBearerToken(t, server, "seller", "pass123")
	rec := userReadRequest(t, server, http.MethodGet, "/api/v2/services/7/users?limit=10", sellerToken)
	if rec.Code != http.StatusOK {
		t.Fatalf("seller service users status = %d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		Users []struct {
			Username         string            `json:"username"`
			SubscriptionURL  string            `json:"subscription_url"`
			SubscriptionURLs map[string]string `json:"subscription_urls"`
		} `json:"users"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Total != 2 || len(body.Users) != 2 {
		t.Fatalf("expected both service users, got %#v", body)
	}
	seen := map[string]bool{}
	for _, item := range body.Users {
		seen[item.Username] = true
		if item.SubscriptionURL == "" {
			t.Fatalf("missing subscription_url for %#v", item)
		}
	}
	if !seen["svc_owner_user"] || !seen["svc_seller_user"] || seen["other_service_user"] {
		t.Fatalf("unexpected service users: %#v", seen)
	}

	outsiderToken := adminBearerToken(t, server, "outsider", "pass123")
	rec = userReadRequest(t, server, http.MethodGet, "/api/v2/services/7/users", outsiderToken)
	if rec.Code != http.StatusForbidden {
		t.Fatalf("outsider status = %d body=%s", rec.Code, rec.Body.String())
	}

	ownerToken := adminBearerToken(t, server, "owner", "pass123")
	rec = userReadRequest(t, server, http.MethodGet, "/api/v2/services/404/users", ownerToken)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("missing service status = %d body=%s", rec.Code, rec.Body.String())
	}
}

func itoa(value int64) string {
	return strconv.FormatInt(value, 10)
}

package api

import (
	"encoding/json"
	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

func TestDecodeServiceAdminLimitUpdateAcceptsFlexibleNumericFields(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v2/services/1/admins/2/limits", strings.NewReader(`{
		"data_limit": 107374182.4,
		"users_limit": "5",
		"delete_user_usage_limit": "",
		"show_user_traffic": false
	}`))
	rec := httptest.NewRecorder()

	payload, err := decodeServiceAdminLimitUpdate(rec, req)
	if err != nil {
		t.Fatal(err)
	}
	if payload.DataLimit == nil || *payload.DataLimit != 107374182 {
		t.Fatalf("unexpected data_limit: %#v", payload.DataLimit)
	}
	if payload.UsersLimit == nil || *payload.UsersLimit != 5 {
		t.Fatalf("unexpected users_limit: %#v", payload.UsersLimit)
	}
	if payload.DeleteUserUsageLimit != nil {
		t.Fatalf("expected empty delete_user_usage_limit to clear limit, got %#v", payload.DeleteUserUsageLimit)
	}
	if payload.ShowUserTraffic == nil || *payload.ShowUserTraffic {
		t.Fatalf("unexpected show_user_traffic: %#v", payload.ShowUserTraffic)
	}
}

func TestDecodeServiceAdminLimitUpdateRejectsInvalidNumericField(t *testing.T) {
	req := httptest.NewRequest(http.MethodPut, "/api/v2/services/1/admins/2/limits", strings.NewReader(`{"users_limit":"five"}`))
	rec := httptest.NewRecorder()

	_, err := decodeServiceAdminLimitUpdate(rec, req)
	if err == nil || err.Error() != "invalid users_limit" {
		t.Fatalf("expected invalid users_limit, got %v", err)
	}
}

func TestServiceFlowMustBeConfiguredOnInbound(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPatch} {
		r := httptest.NewRequest(method, "/api/v2/services/1", strings.NewReader(`{"name":"test","flow":"xtls-rprx-vision"}`))
		_, _, err := decodeServiceWritePayload(httptest.NewRecorder(), r, method == http.MethodPost)
		if err == nil || !strings.Contains(err.Error(), "inbounds, not services") {
			t.Fatalf("service flow mutation was accepted: %v", err)
		}
	}
}

func TestServiceFlowIsNotExposedOrWritableOnMigratedDatabase(t *testing.T) {
	dir := t.TempDir()
	s, err := New(Config{Database: "sqlite:///" + filepath.ToSlash(filepath.Join(dir, "services.db")), CertificateBase: filepath.Join(dir, "cert"), ExternalAppsBase: filepath.Join(dir, "apps")})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.db.Close() })
	hash, err := adminapp.HashPassword("pass123")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO admins (username,hashed_password,role,permissions,status) VALUES ('root',?,'full_access','{}','active')`, hash); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(`INSERT INTO inbounds(tag) VALUES ('service-in'); INSERT INTO hosts (id,inbound_tag,remark,address) VALUES (1,'service-in','test','example.com')`); err != nil {
		t.Fatal(err)
	}
	token := sqliteAdminToken(t, s)
	rec := sqliteJSONRequest(s, http.MethodPost, "/api/v2/services", token, `{"name":"flow-test","hosts":[{"host_id":1}]}`)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create=%d %s", rec.Code, rec.Body.String())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if _, exists := body["flow"]; exists {
		t.Fatal("service response exposed flow")
	}
	rec = sqliteJSONRequest(s, http.MethodPut, "/api/v2/services/1", token, `{"flow":"xtls-rprx-vision"}`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("service flow mutation=%d %s", rec.Code, rec.Body.String())
	}
	var count int
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM services WHERE flow IS NOT NULL`).Scan(&count); err != nil || count != 0 {
		t.Fatalf("service flow written count=%d err=%v", count, err)
	}
}

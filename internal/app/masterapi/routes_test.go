package masterapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRoutesMatchProtectedGroups(t *testing.T) {
	handler := (&Server{}).Handler()
	paths := []string{
		"/api/admin/foo",
		"/api/admin/usage/reset/seller",
		"/api/myaccount/api-keys/12",
		"/api/core/config/targets/7/mode",
		"/api/core/geo/apply",
		"/api/inbounds/full",
		"/api/inbounds/vless-in",
		"/api/hosts/1/status",
		"/api/settings/subscriptions/templates/home_page_template",
		"/api/settings/database/3xui/jobs/abc",
		"/api/v2/services/1/users/actions",
		"/api/v2/users/example",
		"/api/user/example/reset",
		"/api/nodes/usage",
		"/api/node/1/restart",
		"/xray/reality-keypair",
	}
	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, path, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			if rec.Code != http.StatusUnauthorized {
				t.Fatalf("expected route %s to require auth, got status %d body %q", path, rec.Code, rec.Body.String())
			}
		})
	}
}

func TestAdminTokenRouteIsNotCapturedByAdminWildcard(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/admin/token", nil)
	rec := httptest.NewRecorder()

	(&Server{}).Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected admin token route to reach token handler, got status %d body %q", rec.Code, rec.Body.String())
	}
}

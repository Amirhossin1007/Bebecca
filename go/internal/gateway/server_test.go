package gateway

import (
	"net"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

func TestIsNativeNodeRoute(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		header string
		want   bool
	}{
		{name: "nodes list", method: http.MethodGet, path: "/api/nodes", want: true},
		{name: "nodes usage", method: http.MethodGet, path: "/api/nodes/usage", want: true},
		{name: "node get", method: http.MethodGet, path: "/api/node/12", want: true},
		{name: "node reconnect", method: http.MethodPost, path: "/api/node/12/reconnect", want: true},
		{name: "node restart", method: http.MethodPost, path: "/api/node/12/restart", want: true},
		{name: "node sync", method: http.MethodPost, path: "/api/node/12/sync", want: true},
		{name: "node logs", method: http.MethodGet, path: "/api/node/12/logs", want: true},
		{name: "node usage daily", method: http.MethodGet, path: "/api/node/12/usage/daily", want: true},
		{name: "node runtime update", method: http.MethodPost, path: "/api/node/12/xray/update", want: true},
		{name: "node geo update", method: http.MethodPost, path: "/api/node/12/geo/update", want: true},
		{name: "node service restart", method: http.MethodPost, path: "/api/node/12/service/restart", want: true},
		{name: "node service update", method: http.MethodPost, path: "/api/node/12/service/update", want: true},
		{name: "node websocket logs stays python", method: http.MethodGet, path: "/api/node/12/logs", header: "websocket", want: false},
		{name: "node create stays python", method: http.MethodPost, path: "/api/node", want: false},
		{name: "node update stays python", method: http.MethodPut, path: "/api/node/12", want: false},
		{name: "runtime route stays python", method: http.MethodGet, path: "/api/core", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.header != "" {
				req.Header.Set("Upgrade", tt.header)
			}
			if got := isNativeNodeRoute(req); got != tt.want {
				t.Fatalf("isNativeNodeRoute() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsNativeAdminRoute(t *testing.T) {
	tests := []struct {
		name   string
		method string
		path   string
		header string
		want   bool
	}{
		{name: "current admin", method: http.MethodGet, path: "/api/admin", want: true},
		{name: "api admin token", method: http.MethodPost, path: "/api/admin/token", want: true},
		{name: "frontend admin token alias", method: http.MethodPost, path: "/admin/token", want: true},
		{name: "admin create", method: http.MethodPost, path: "/api/admin", want: true},
		{name: "admin list", method: http.MethodGet, path: "/api/admins", want: true},
		{name: "admin update", method: http.MethodPut, path: "/api/admin/seller", want: true},
		{name: "admin usage chart", method: http.MethodGet, path: "/api/admin/seller/usage/chart", want: true},
		{name: "myaccount get", method: http.MethodGet, path: "/api/myaccount", want: true},
		{name: "myaccount password", method: http.MethodPost, path: "/api/myaccount/change_password", want: true},
		{name: "myaccount api key delete", method: http.MethodDelete, path: "/api/myaccount/api-keys/7", want: true},
		{name: "admin websocket stays python", method: http.MethodGet, path: "/api/admin", header: "websocket", want: false},
		{name: "settings admins stays python", method: http.MethodPut, path: "/api/settings/subscriptions/admins/1", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.header != "" {
				req.Header.Set("Upgrade", tt.header)
			}
			if got := isNativeAdminRoute(req); got != tt.want {
				t.Fatalf("isNativeAdminRoute() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNativeNodeRouteDoesNotFallbackToPython(t *testing.T) {
	python := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("python fallback"))
	}))
	defer python.Close()

	pythonURL := strings.TrimPrefix(python.URL, "http://")
	host, portValue, err := net.SplitHostPort(pythonURL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portValue)
	if err != nil {
		t.Fatal(err)
	}

	server, err := NewServer(Config{
		MasterAPIURL:     "http://127.0.0.1:1",
		NativeNodeRoutes: true,
		PythonHost:       host,
		PythonPort:       port,
	})
	if err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/nodes", nil)
	server.server.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusServiceUnavailable, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "python fallback") {
		t.Fatalf("native node route fell back to python: %s", rec.Body.String())
	}
}

func TestNativeAdminRouteDoesNotFallbackToPython(t *testing.T) {
	python := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("python fallback"))
	}))
	defer python.Close()

	pythonURL := strings.TrimPrefix(python.URL, "http://")
	host, portValue, err := net.SplitHostPort(pythonURL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portValue)
	if err != nil {
		t.Fatal(err)
	}

	server, err := NewServer(Config{
		MasterAPIURL: "http://127.0.0.1:1",
		PythonHost:   host,
		PythonPort:   port,
	})
	if err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/admins", nil)
	server.server.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusServiceUnavailable, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "python fallback") {
		t.Fatalf("native admin route fell back to python: %s", rec.Body.String())
	}
}

func TestNativeAdminRouteProxiesToGoMasterAPI(t *testing.T) {
	master := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/admin/token" || r.Method != http.MethodPost {
			t.Fatalf("unexpected master request: %s %s", r.Method, r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"access_token":"go-token","token_type":"bearer"}`))
	}))
	defer master.Close()

	python := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
		_, _ = w.Write([]byte("python fallback"))
	}))
	defer python.Close()

	pythonURL := strings.TrimPrefix(python.URL, "http://")
	host, portValue, err := net.SplitHostPort(pythonURL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.Atoi(portValue)
	if err != nil {
		t.Fatal(err)
	}

	server, err := NewServer(Config{
		MasterAPIURL: master.URL,
		PythonHost:   host,
		PythonPort:   port,
	})
	if err != nil {
		t.Fatal(err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/admin/token", strings.NewReader("username=a&password=b"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	server.server.Handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), "python fallback") {
		t.Fatalf("native admin route fell back to python: %s", rec.Body.String())
	}
}

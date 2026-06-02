package gateway

import (
	"net/http"
	"net/http/httptest"
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

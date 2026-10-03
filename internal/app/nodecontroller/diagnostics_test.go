package nodecontroller

import (
	"context"
	"database/sql"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestRuntimeDiagnosticsUseHealthCacheClearRecoveredErrorsAndIgnoreDisabledNodes(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE nodes (id INTEGER PRIMARY KEY, status TEXT); INSERT INTO nodes VALUES (1, 'connected'), (2, 'disabled'), (3, 'connected')`); err != nil {
		t.Fatal(err)
	}
	c := NewController(NewRepository(db, "sqlite"))
	for _, id := range []int64{1, 2, 3} {
		c.rememberRuntimeDiagnostics(RuntimeResult{NodeID: id, ProtocolStatuses: []ProtocolStatus{
			{Protocol: "tor/tor-de", State: "error", Detail: "service not found"},
			{Protocol: "wireguard", State: "idle"},
			{Protocol: "disk", State: "warning", Detail: "low disk space"},
			{Protocol: "haproxy", State: "disabled", Inbounds: 1},
		}})
	}
	expired, _ := c.runtimeDiagnostics.Load(int64(3))
	snapshot := expired.(runtimeDiagnosticSnapshot)
	snapshot.at = time.Now().Add(-3 * time.Minute)
	c.runtimeDiagnostics.Store(int64(3), snapshot)
	issues, err := c.RuntimeDiagnostics(context.Background())
	if err != nil || len(issues) != 2 {
		t.Fatalf("issues=%v err=%v", issues, err)
	}
	for _, issue := range issues {
		if issue.TargetID != "node:1" {
			t.Fatalf("stale/disabled issue leaked: %+v", issue)
		}
		if issue.Resource == "tor/tor-de" && issue.ResourceType != "outbound" {
			t.Fatalf("managed service not mapped to its outbound: %+v", issue)
		}
	}
	c.rememberRuntimeDiagnostics(RuntimeResult{NodeID: 1, ProtocolStatuses: []ProtocolStatus{{Protocol: "tor/tor-de", State: "running"}}})
	issues, err = c.RuntimeDiagnostics(context.Background())
	if err != nil || len(issues) != 0 {
		t.Fatalf("recovered errors were retained: %v %v", issues, err)
	}
}

func TestRuntimeDiagnosticsEscalateOnlyConfirmedRuntimeStops(t *testing.T) {
	c := NewController(NewRepository(nil, "sqlite"))
	c.rememberRuntimeDiagnostics(RuntimeResult{NodeID: 1, ProtocolStatuses: []ProtocolStatus{
		{Protocol: "xray", State: "error", Detail: "core startup failed"},
		{Protocol: "wireguard", State: "stopped", Inbounds: 1},
		{Protocol: "tor/tor-de", State: "error", Inbounds: 1, Detail: "service not found"},
		{Protocol: "disk", State: "warning", Detail: "low disk space"},
		{Protocol: "haproxy", State: "disabled", Inbounds: 1},
		{Protocol: "openvpn", State: "stopped"},
	}})
	value, _ := c.runtimeDiagnostics.Load(int64(1))
	issues := value.(runtimeDiagnosticSnapshot).issues
	if len(issues) != 4 {
		t.Fatalf("unexpected diagnostics: %+v", issues)
	}
	want := map[string]string{"xray": "critical", "wireguard": "critical", "tor/tor-de": "error", "disk": "warning"}
	for _, issue := range issues {
		if issue.Severity != want[issue.Resource] {
			t.Fatalf("wrong severity: %+v", issue)
		}
	}
}

package user

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestHAProxyPublicPortsUsesSharedPortAndRejectsConflicts(t *testing.T) {
	db, err := sql.Open("sqlite", "file:haproxy-public-ports?mode=memory&cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE haproxy_configs (id INTEGER PRIMARY KEY, enabled INTEGER)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE haproxy_targets (config_id INTEGER, node_id INTEGER, listeners TEXT)`); err != nil {
		t.Fatal(err)
	}
	for _, row := range []struct {
		nodeID    int
		listeners string
	}{
		{1, `[{"listen_port":443,"routes":[{"source":"xray","inbound_tag":"ws"},{"source":"external","inbound_tag":"ignored"}]}]`},
		{2, `[{"listen_port":443,"routes":[{"source":"xray","inbound_tag":"ws"},{"source":"xray","inbound_tag":"tls"}]}]`},
		{3, `[{"listen_port":8443,"routes":[{"source":"xray","inbound_tag":"tls"}]}]`},
	} {
		if _, err := db.Exec(`INSERT INTO haproxy_configs (id, enabled) VALUES (?, 1)`, row.nodeID); err != nil {
			t.Fatal(err)
		}
		if _, err := db.Exec(`INSERT INTO haproxy_targets (config_id, node_id, listeners) VALUES (?, ?, ?)`, row.nodeID, row.nodeID, row.listeners); err != nil {
			t.Fatal(err)
		}
	}
	ports, err := NewRepository(db, "sqlite").haproxyPublicPorts(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if ports["ws"] != 443 {
		t.Fatalf("ws public port = %d, want 443", ports["ws"])
	}
	if _, exists := ports["tls"]; exists {
		t.Fatal("conflicting public ports must not override subscription links")
	}
}

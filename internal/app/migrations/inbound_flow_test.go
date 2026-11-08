package migrations

import (
	"context"
	"encoding/json"
	"testing"
)

func TestInboundFlowMigrationPreservesExplicitAndConflictingChoices(t *testing.T) {
	db := openSQLiteTestDB(t)
	_, err := db.Exec(`
CREATE TABLE services(id INTEGER PRIMARY KEY, flow TEXT);
CREATE TABLE hosts(id INTEGER PRIMARY KEY, inbound_tag TEXT);
CREATE TABLE service_hosts(service_id INTEGER, host_id INTEGER);
CREATE TABLE xray_config(id INTEGER PRIMARY KEY, data TEXT);
CREATE TABLE nodes(id INTEGER PRIMARY KEY, xray_config_mode TEXT, xray_config TEXT);
INSERT INTO services VALUES(1,'xtls-rprx-vision'),(2,''),(3,'xtls-rprx-vision-udp443');
INSERT INTO hosts VALUES(1,'legacy'),(2,'explicit'),(3,'conflict'),(4,'ws');
INSERT INTO service_hosts VALUES(1,1),(3,1),(1,2),(1,3),(2,3),(1,4);
`)
	if err != nil {
		t.Fatal(err)
	}
	raw := `{"inbounds":[{"tag":"legacy","protocol":"vless","settings":{},"streamSettings":{"network":"tcp","security":"tls"}},{"tag":"explicit","protocol":"vless","settings":{"flow":""},"streamSettings":{"network":"tcp","security":"tls"}},{"tag":"conflict","protocol":"vless","settings":{},"streamSettings":{"network":"tcp","security":"tls"}},{"tag":"ws","protocol":"vless","settings":{},"streamSettings":{"network":"ws","security":"tls"}}]}`
	if _, err := db.Exec(`INSERT INTO xray_config VALUES(1,?); INSERT INTO nodes VALUES(1,'custom',?)`, raw, raw); err != nil {
		t.Fatal(err)
	}
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if err := up000059InboundFlow(context.Background(), tx); err != nil {
		t.Fatal(err)
	}
	if err := up000059InboundFlow(context.Background(), tx); err != nil {
		t.Fatal(err)
	}
	for _, query := range []string{`SELECT data FROM xray_config`, `SELECT xray_config FROM nodes`} {
		var encoded string
		if err := tx.QueryRow(query).Scan(&encoded); err != nil {
			t.Fatal(err)
		}
		var config map[string]any
		if err := json.Unmarshal([]byte(encoded), &config); err != nil {
			t.Fatal(err)
		}
		for _, value := range config["inbounds"].([]any) {
			inbound := value.(map[string]any)
			settings := inbound["settings"].(map[string]any)
			switch inbound["tag"] {
			case "legacy":
				if settings["flow"] != "xtls-rprx-vision" {
					t.Fatal("legacy flow not migrated")
				}
			case "explicit", "ws":
				if settings["flow"] != "" {
					t.Fatal("explicit or unsupported flow overwritten")
				}
			case "conflict":
				if _, exists := settings["flow"]; exists {
					t.Fatal("conflicting legacy choices were silently merged")
				}
			}
		}
	}
}

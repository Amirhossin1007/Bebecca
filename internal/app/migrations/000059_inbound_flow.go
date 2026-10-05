package migrations

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/pressly/goose/v3"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

func init() {
	goose.AddNamedMigrationContext("000059_inbound_flow.go", up000059InboundFlow, emptyDown)
}

// Move unambiguous legacy defaults without overwriting an explicit inbound choice.
// Conflicting old service values remain read-only until that inbound is edited.
func up000059InboundFlow(ctx context.Context, tx *sql.Tx) error {
	if exists, err := HasColumn(ctx, tx, activeDialect(), "services", "flow"); err != nil {
		return err
	} else if !exists {
		return nil
	}
	rows, err := tx.QueryContext(ctx, `SELECT DISTINCT COALESCE(h.inbound_tag, ''), COALESCE(s.flow, '') FROM services s JOIN service_hosts sh ON sh.service_id = s.id JOIN hosts h ON h.id = sh.host_id`)
	if err != nil {
		return err
	}
	flows := map[string]map[string]bool{}
	for rows.Next() {
		var tag, flow string
		if err := rows.Scan(&tag, &flow); err != nil {
			rows.Close()
			return err
		}
		flow = strings.TrimSuffix(strings.TrimSpace(flow), "-udp443")
		if flows[tag] == nil {
			flows[tag] = map[string]bool{}
		}
		flows[tag][flow] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	type stored struct {
		id   int64
		raw  []byte
		node bool
	}
	configs := []stored{}
	for _, source := range []struct {
		query string
		node  bool
	}{
		{`SELECT id, data FROM xray_config`, false},
		{`SELECT id, xray_config FROM nodes WHERE xray_config_mode = 'custom' AND xray_config IS NOT NULL`, true},
	} {
		rows, err := tx.QueryContext(ctx, source.query)
		if err != nil {
			return err
		}
		for rows.Next() {
			var c stored
			c.node = source.node
			if err := rows.Scan(&c.id, &c.raw); err != nil {
				rows.Close()
				return err
			}
			configs = append(configs, c)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
	}
	for _, c := range configs {
		var config map[string]any
		if json.Unmarshal(c.raw, &config) != nil {
			continue
		} // Preserve broken/imported configs for diagnostics.
		changed := false
		inbounds, _ := config["inbounds"].([]any)
		for _, value := range inbounds {
			inbound, _ := value.(map[string]any)
			if inbound["protocol"] != "vless" {
				continue
			}
			settings, _ := inbound["settings"].(map[string]any)
			if settings == nil {
				continue
			}
			if _, explicit := settings["flow"]; explicit {
				continue
			}
			tag, _ := inbound["tag"].(string)
			choices := flows[tag]
			if len(choices) != 1 {
				continue
			}
			for flow := range choices {
				if flow != "" && flow != "xtls-rprx-vision" {
					continue
				}
				if !xrayconfig.VLESSFlowSupported(inbound) {
					flow = ""
				}
				settings["flow"] = flow
				changed = true
			}
		}
		if !changed {
			continue
		}
		raw, err := json.Marshal(config)
		if err != nil {
			return err
		}
		query := `UPDATE xray_config SET data = ? WHERE id = ?`
		if c.node {
			query = `UPDATE nodes SET xray_config = ? WHERE id = ?`
		}
		if _, err := tx.ExecContext(ctx, query, string(raw), c.id); err != nil {
			return err
		}
	}
	return nil
}

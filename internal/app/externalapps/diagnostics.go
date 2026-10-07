package externalapps

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

// Diagnostics checks only enabled, locally hosted applications. It never runs
// PHP, invokes bot webhooks or sends Telegram messages while viewing a panel.
func (m *Manager) Diagnostics(ctx context.Context) []xrayconfig.ConfigIssue {
	m.mu.RLock()
	records := make([]Record, 0, len(m.apps))
	for _, record := range m.apps {
		if record.Enabled {
			records = append(records, record)
		}
	}
	m.mu.RUnlock()
	issues := []xrayconfig.ConfigIssue{}
	for _, record := range records {
		if ctx.Err() != nil {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "external_app", Resource: "Application health", Severity: "warning", Message: "Application health check exceeded its time budget; remaining statuses are unknown"})
			break
		}
		message := ""
		severity := "error"
		if info, err := os.Stat(record.Root); err != nil || !info.IsDir() {
			message = "Enabled application directory is missing or inaccessible"
		} else if record.Runtime != "node" {
			if info, err := os.Stat(filepath.Join(record.Root, externalAppIndexFile(record))); err != nil || info.IsDir() {
				message = "Enabled application entry point is missing, inaccessible or not a file"
			}
		}
		if message == "" && record.Runtime != "static" {
			network, address := "unix", record.Socket
			if record.Runtime == "node" {
				network, address = "tcp", net.JoinHostPort("127.0.0.1", strconv.Itoa(record.Port))
			}
			if address == "" {
				message = "Enabled application has no configured local runtime listener"
			} else {
				dialer := net.Dialer{Timeout: 150 * time.Millisecond}
				connection, err := dialer.DialContext(ctx, network, address)
				if err != nil {
					message = fmt.Sprintf("Enabled %s application runtime is unavailable: %v", record.Runtime, err)
					if ctx.Err() != nil {
						severity, message = "warning", "Application runtime health check exceeded its time budget; status is unknown"
					}
				} else {
					connection.Close()
				}
			}
		}
		if message != "" {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "external_app", Resource: record.Domain + "/" + record.Path, Message: message, Severity: severity})
		}
	}
	return issues
}

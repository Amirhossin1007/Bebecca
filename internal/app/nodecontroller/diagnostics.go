package nodecontroller

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/system"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

type runtimeDiagnosticSnapshot struct {
	issues []xrayconfig.ConfigIssue
	at     time.Time
}

func (c Controller) rememberRuntimeDiagnostics(runtime RuntimeResult) {
	if c.runtimeDiagnostics == nil {
		return
	}
	target := xrayconfig.NodeTargetID(runtime.NodeID)
	issues := []xrayconfig.ConfigIssue{}
	for _, protocol := range runtime.ProtocolStatuses {
		if protocol.State != "error" && protocol.State != "warning" && !(protocol.State == "stopped" && protocol.Inbounds > 0) {
			continue
		}
		kind := "node_service"
		provider, _, managed := strings.Cut(protocol.Protocol, "/")
		if managed && (provider == "tor" || provider == "windscribe" || provider == "psiphon") {
			kind = "outbound"
		} else if protocol.Protocol == "disk" || protocol.Protocol == "memory" {
			kind = "resource"
		} else if protocol.Protocol == "certificate" {
			kind = "certificate"
		}
		message := strings.TrimSpace(protocol.Detail)
		if message == "" {
			message = fmt.Sprintf("%s is configured but its runtime is %s", protocol.Protocol, protocol.State)
		}
		severity := "error"
		if protocol.State == "warning" {
			severity = "warning"
		} else if protocol.Protocol == "xray" && protocol.State == "error" || protocol.State == "stopped" && protocol.Inbounds > 0 {
			// Native proxy setup errors alone do not prove Xray has stopped.
			// Escalate only a reported core failure or a configured stopped runtime.
			severity = "critical"
		}
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: target, ResourceType: kind, Resource: protocol.Protocol, Message: message, Severity: severity})
	}
	issues = append(issues, system.ResourceIssues(target, system.UsageStats{Current: int64(runtime.Memory.UsedBytes), Total: int64(runtime.Memory.TotalBytes), Percent: runtime.Memory.UsagePercent}, system.UsageStats{})...)
	c.runtimeDiagnostics.Store(runtime.NodeID, runtimeDiagnosticSnapshot{issues: issues, at: time.Now()})
}

// RuntimeDiagnostics reuses the regular health sweep: opening a dashboard must
// never run installations, traffic tests, config syncs or extra RPCs on nodes.
func (c Controller) RuntimeDiagnostics(ctx context.Context) ([]xrayconfig.ConfigIssue, error) {
	issues := []xrayconfig.ConfigIssue{}
	if c.runtimeDiagnostics == nil {
		return issues, nil
	}
	rows, err := c.repo.db.QueryContext(ctx, `SELECT id FROM nodes WHERE status NOT IN ('disabled', 'limited', 'deleted')`)
	if err != nil {
		return nil, err
	}
	active := map[int64]bool{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, err
		}
		active[id] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, err
	}
	c.runtimeDiagnostics.Range(func(key, value any) bool {
		id := key.(int64)
		snapshot := value.(runtimeDiagnosticSnapshot)
		if !active[id] || time.Since(snapshot.at) > 2*time.Minute {
			c.runtimeDiagnostics.Delete(id)
			return true
		}
		issues = append(issues, snapshot.issues...)
		return true
	})
	sort.Slice(issues, func(i, j int) bool {
		return issues[i].TargetID+issues[i].Resource < issues[j].TargetID+issues[j].Resource
	})
	return issues, nil
}

func (c Controller) HAProxyDiagnostics(ctx context.Context) ([]xrayconfig.ConfigIssue, error) {
	issues := []xrayconfig.ConfigIssue{}
	if c.repo.db == nil {
		return issues, nil
	}
	configs, err := c.repo.HAProxyConfigs(ctx)
	if isMissingHAProxyTable(err) {
		return issues, nil
	}
	if err != nil {
		return nil, err
	}
	for _, config := range configs {
		if !config.Enabled {
			continue
		}
		// The save-time validator operates on this decoded copy, with no writes.
		if err := c.repo.normalizeHAProxyConfig(ctx, &config); err != nil {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "haproxy", Resource: config.Name, Message: err.Error()})
		}
	}
	return issues, nil
}

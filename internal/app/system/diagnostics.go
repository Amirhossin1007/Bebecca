package system

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/rebeccapanel/rebecca/internal/app/logging"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

// Diagnostics combines existing failure records; it does not run service
// installers or change configuration while the dashboard is being viewed.
func (s *Service) Diagnostics(ctx context.Context) ([]xrayconfig.ConfigIssue, error) {
	issues := []xrayconfig.ConfigIssue{}
	for _, table := range []string{"users", "nodes", "settings", "xray_config"} {
		exists, err := hasSystemTable(ctx, s.db, s.dialect, table)
		if err != nil {
			return nil, err
		}
		if !exists {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "database", Resource: table, Message: "Required database table is missing; the database restore or migration is incomplete"})
		}
	}
	if snapshot, err := s.metrics.Snapshot(ctx); err != nil {
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "resource", Resource: "System metrics", Message: err.Error()})
	} else {
		issues = append(issues, ResourceIssues("master", snapshot.Memory, snapshot.Disk)...)
	}
	if exists, err := hasSystemTable(ctx, s.db, s.dialect, "xray_config"); err != nil {
		return nil, err
	} else if exists {
		configIssues, err := xrayconfig.NewRepository(s.db, s.dialect, xrayconfig.Options{}).ConfigIssues(ctx)
		issues = append(issues, configIssues...)
		if err != nil {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "database", Resource: "Xray configuration", Message: err.Error()})
		}
	}
	sources := []struct {
		table   string
		columns []string
		kind    string
		query   string
	}{
		{"nodes", []string{"name", "status", "agent_status", "message"}, "node", `SELECT COALESCE(name, ''), CAST(id AS CHAR), message FROM nodes WHERE status NOT IN ('deleted', 'disabled', 'limited') AND (status = 'error' OR agent_status IN ('error', 'degraded')) AND TRIM(COALESCE(message, '')) <> '' ORDER BY id`},
		{"node_operations", []string{"operation_type", "node_id", "status", "last_error"}, "node_operation", `SELECT operation_type, COALESCE(CAST(node_id AS CHAR), ''), last_error FROM node_operations WHERE status IN ('failed', 'retrying') AND TRIM(COALESCE(last_error, '')) <> '' AND (node_id IS NULL OR node_id IN (SELECT id FROM nodes WHERE status NOT IN ('deleted', 'disabled', 'limited'))) ORDER BY id DESC LIMIT 20`},
		{"outbound_subscriptions", []string{"remark", "enabled", "last_error"}, "outbound_subscription", `SELECT remark, '', last_error FROM outbound_subscriptions WHERE enabled = 1 AND TRIM(COALESCE(last_error, '')) <> '' ORDER BY id`},
		{"telegram_settings", []string{"last_error"}, "telegram", `SELECT 'Telegram', '', last_error FROM telegram_settings WHERE TRIM(COALESCE(last_error, '')) <> '' ORDER BY id`},
		{"telegram_settings", []string{"backup_last_error"}, "backup", `SELECT 'Telegram backup', '', backup_last_error FROM telegram_settings WHERE TRIM(COALESCE(backup_last_error, '')) <> '' ORDER BY id`},
		{"telegram_settings", []string{"use_telegram", "api_token", "backup_enabled"}, "telegram", `SELECT 'Telegram credentials', '', 'Telegram or backup delivery is enabled but the bot API token is missing' FROM telegram_settings WHERE (use_telegram = 1 OR backup_enabled = 1) AND TRIM(COALESCE(api_token, '')) = ''`},
		{"webhook_events", []string{"action", "status", "last_error"}, "webhook", `SELECT action, '', last_error FROM webhook_events WHERE status <> 'done' AND TRIM(COALESCE(last_error, '')) <> '' ORDER BY id DESC LIMIT 20`},
	}
	seen := map[string]bool{}
	for _, source := range sources {
		exists, err := hasSystemTable(ctx, s.db, s.dialect, source.table)
		if err != nil {
			return nil, err
		}
		if !exists {
			continue
		}
		compatible := true
		for _, column := range source.columns {
			exists, err := hasSystemColumn(ctx, s.db, s.dialect, source.table, column)
			if err != nil {
				return nil, err
			}
			compatible = compatible && exists
		}
		if !compatible {
			continue
		}
		rows, err := s.db.QueryContext(ctx, source.query)
		if err != nil {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "database", Resource: source.table, Message: err.Error()})
			continue
		}
		for rows.Next() {
			var resource, target, message string
			if err := rows.Scan(&resource, &target, &message); err != nil {
				rows.Close()
				return nil, err
			}
			if target == "" {
				target = "master"
			} else {
				target = xrayconfig.NodePrefix + target
			}
			key := target + ":" + source.kind + ":" + resource + ":" + strings.TrimSpace(message)
			if seen[key] {
				continue
			}
			seen[key] = true
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: target, ResourceType: source.kind, Resource: resource, Message: message})
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, fmt.Errorf("read %s diagnostics: %w", source.table, err)
		}
	}
	backupIssues, err := s.backupDestinationIssues(ctx)
	if err != nil {
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "database", Resource: "Backup destination", Message: err.Error()})
	} else {
		issues = append(issues, backupIssues...)
	}
	for _, item := range logging.RecentDiagnostics() {
		kind := "runtime_warning"
		if item.Level >= logging.LevelError {
			kind = "runtime_error"
		}
		severity := "error"
		if kind == "runtime_warning" {
			severity = "warning"
		}
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: kind, Resource: item.Component, Severity: severity,
			Message: item.Time.Format("2006-01-02 15:04:05 UTC") + " — " + item.Message})
	}
	return issues, nil
}

func (s *Service) backupDestinationIssues(ctx context.Context) ([]xrayconfig.ConfigIssue, error) {
	for _, column := range []string{"backup_enabled", "backup_chat_id", "logs_chat_id", "admin_chat_ids"} {
		exists, err := hasSystemColumn(ctx, s.db, s.dialect, "telegram_settings", column)
		if err != nil || !exists {
			return nil, err
		}
	}
	rows, err := s.db.QueryContext(ctx, `SELECT COALESCE(admin_chat_ids, '[]') FROM telegram_settings WHERE backup_enabled = 1 AND COALESCE(backup_chat_id, 0) = 0 AND COALESCE(logs_chat_id, 0) = 0`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var raw string
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var admins []int64
		_ = json.Unmarshal([]byte(raw), &admins)
		for _, id := range admins {
			if id != 0 {
				return nil, nil // Backup delivery falls back to admin recipients.
			}
		}
		return []xrayconfig.ConfigIssue{{TargetID: "master", ResourceType: "backup", Resource: "Telegram backup destination", Message: "Scheduled Telegram backup is enabled but no backup chat, logs chat or admin recipient is configured"}}, nil
	}
	return nil, rows.Err()
}

// ResourceIssues warns about measured pressure, not its assumed cause. A busy
// CPU or the absence of swap alone does not prove an outage or an OOM event.
func ResourceIssues(target string, memory, disk UsageStats) []xrayconfig.ConfigIssue {
	issues := []xrayconfig.ConfigIssue{}
	for _, item := range []struct {
		name        string
		usage       UsageStats
		minimumFree int64
	}{
		{"Memory", memory, 128 << 20},
		{"Disk", disk, 256 << 20},
	} {
		free := item.usage.Total - item.usage.Current
		if item.usage.Total <= 0 || item.usage.Percent < 95 || free >= item.minimumFree {
			continue
		}
		severity := "warning"
		if free <= 0 {
			severity = "error"
		}
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: target, ResourceType: "resource", Resource: item.name, Severity: severity,
			Message: fmt.Sprintf("%s is %.1f%% used; only %d MiB remain available. This may prevent allocations or writes; it does not by itself prove the cause of a disconnection", item.name, item.usage.Percent, max(free, 0)/(1<<20))})
	}
	return issues
}

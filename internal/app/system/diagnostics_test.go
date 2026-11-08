package system

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestResourceIssuesUseMeasuredPressureWithoutInventingCauses(t *testing.T) {
	for _, tc := range []struct {
		usage    UsageStats
		want     int
		severity string
	}{
		{UsageStats{}, 0, ""},
		{UsageStats{Total: 1024 << 20, Current: 512 << 20, Percent: 50}, 0, ""},
		{UsageStats{Total: 32 << 30, Current: 31 << 30, Percent: 97}, 0, ""},
		{UsageStats{Total: 1024 << 20, Current: 1000 << 20, Percent: 97.6}, 1, "warning"},
		{UsageStats{Total: 1024 << 20, Current: 1024 << 20, Percent: 100}, 1, "error"},
	} {
		issues := ResourceIssues("master", tc.usage, UsageStats{})
		if len(issues) != tc.want || len(issues) > 0 && issues[0].Severity != tc.severity {
			t.Fatalf("pressure %+v: %v", tc.usage, issues)
		}
	}
}

func TestMissingRequiredTablesAreCritical(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	issues, err := NewService(db, "sqlite", "test").Diagnostics(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	missing := 0
	for _, issue := range issues {
		if issue.ResourceType == "database" {
			if issue.Severity != "critical" {
				t.Fatalf("missing table not critical: %+v", issue)
			}
			missing++
		}
	}
	if missing != 4 {
		t.Fatalf("missing table errors lost: %+v", issues)
	}
}

func TestBackupDestinationDiagnosticsRespectAdminFallbackAndDisabledBackup(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE telegram_settings (backup_enabled INTEGER, backup_chat_id INTEGER, logs_chat_id INTEGER, admin_chat_ids TEXT); INSERT INTO telegram_settings VALUES (1, 0, 0, '[]')`); err != nil {
		t.Fatal(err)
	}
	s := NewService(db, "sqlite", "test")
	for _, tc := range []struct {
		update string
		want   int
	}{
		{"admin_chat_ids = '[]'", 1},
		{"admin_chat_ids = '[0]'", 1},
		{"admin_chat_ids = '[123]'", 0},
		{"admin_chat_ids = '[]', logs_chat_id = -100123", 0},
		{"logs_chat_id = 0, backup_enabled = 0", 0},
	} {
		if _, err := db.Exec("UPDATE telegram_settings SET " + tc.update); err != nil {
			t.Fatal(err)
		}
		before := db.Stats()
		issues, err := s.backupDestinationIssues(context.Background())
		if err != nil || len(issues) != tc.want {
			t.Fatalf("%s: issues=%v err=%v", tc.update, issues, err)
		}
		if db.Stats().InUse != before.InUse {
			t.Fatal("diagnostics leaked a database cursor")
		}
	}
}

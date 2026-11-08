package logging

import (
	"testing"
	"time"
)

func TestRecentDiagnosticsAreBoundedDeduplicatedAndExpire(t *testing.T) {
	t.Setenv("REBECCA_LOG_LEVEL", "debug")
	recentDiagnostics.Lock()
	recentDiagnostics.items = nil
	recentDiagnostics.Unlock()
	for i := 0; i < 55; i++ {
		Warnf(ComponentDatabase, "usage flush failed %d", i)
	}
	Warnf(ComponentDatabase, "usage flush failed %d", 54)
	Infof(ComponentRuntime, "healthy")
	items := RecentDiagnostics()
	if len(items) != 50 || items[0].Message != "usage flush failed 54" || items[0].Level != LevelWarn {
		t.Fatalf("incorrect recent diagnostics: %v", items)
	}
	items[0].Message = "must not mutate collector"
	if RecentDiagnostics()[0].Message == items[0].Message {
		t.Fatal("diagnostics returned mutable internal storage")
	}
	recentDiagnostics.Lock()
	recentDiagnostics.items = []Diagnostic{{Time: time.Now().Add(-16 * time.Minute)}}
	recentDiagnostics.Unlock()
	if len(RecentDiagnostics()) != 0 {
		t.Fatal("expired failures must not remain visible")
	}
}

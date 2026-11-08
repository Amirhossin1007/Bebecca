package externalapps

import (
	"context"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestApplicationDiagnosticsSkipDisabledAppsAndDetectMissingRuntime(t *testing.T) {
	m := &Manager{apps: map[string]Record{
		"disabled": {Domain: "disabled.test", Enabled: false, Root: "/missing-test-app"},
		"missing":  {Domain: "missing.test", Enabled: true, Root: "/missing-test-app"},
	}}
	issues := m.Diagnostics(context.Background())
	if len(issues) != 1 || issues[0].Resource != "missing.test/" || !strings.Contains(issues[0].Message, "directory") {
		t.Fatalf("issues=%v", issues)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, rawPort, _ := net.SplitHostPort(listener.Addr().String())
	port, _ := strconv.Atoi(rawPort)
	m.apps = map[string]Record{"healthy": {Domain: "healthy.test", Enabled: true, Root: t.TempDir(), Runtime: "node", Port: port}}
	if issues := m.Diagnostics(context.Background()); len(issues) != 0 {
		t.Fatalf("healthy listener: %v", issues)
	}
	listener.Close()
	if issues := m.Diagnostics(context.Background()); len(issues) != 1 || !strings.Contains(issues[0].Message, "runtime is unavailable") {
		t.Fatalf("missing runtime: %v", issues)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if issues := m.Diagnostics(ctx); len(issues) != 1 || issues[0].Severity != "warning" || !strings.Contains(issues[0].Message, "unknown") {
		t.Fatalf("timeout was reported as a confirmed outage: %v", issues)
	}
}

func TestBotDiagnosticsCheckDefaultEntryPointWithoutExecutingPHP(t *testing.T) {
	m := &Manager{apps: map[string]Record{"bot": {Domain: "bot.test", Template: "mirzabot", Enabled: true, Root: t.TempDir(), Runtime: "php"}}}
	issues := m.Diagnostics(context.Background())
	if len(issues) != 1 || !strings.Contains(issues[0].Message, "entry point") {
		t.Fatalf("issues=%v", issues)
	}
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("static website"), 0600); err != nil {
		t.Fatal(err)
	}
	m.apps = map[string]Record{"static": {Domain: "static.test", Enabled: true, Runtime: "static", Root: root}}
	if issues := m.Diagnostics(context.Background()); len(issues) != 0 {
		t.Fatalf("static app incorrectly required a PHP/Node service: %v", issues)
	}
}

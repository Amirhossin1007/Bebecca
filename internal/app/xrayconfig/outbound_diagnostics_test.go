package xrayconfig

import (
	"strings"
	"testing"
)

func TestManagedOutboundDiagnosticsPreserveLegacyClassification(t *testing.T) {
	outbound := map[string]any{"tag": "windscribe-DE", "protocol": "wireguard"}
	issues := outboundIssues("node_1", map[string]any{"outbounds": []any{outbound}})
	if len(issues) != 1 || !strings.Contains(issues[0].Message, "wireguard") || !strings.Contains(issues[0].Message, "local SOCKS") {
		t.Fatalf("expected actionable legacy classification error: %v", issues)
	}
	if outbound["tag"] != "windscribe-DE" || outbound["protocol"] != "wireguard" {
		t.Fatal("diagnostics changed the user's outbound")
	}
	outbound["tag"] = "ordinary-wireguard"
	if got := outboundIssues("node_1", map[string]any{"outbounds": []any{outbound}}); len(got) != 0 {
		t.Fatalf("ordinary outbound was classified as a managed service: %v", got)
	}
}

func TestManagedOutboundDiagnosticsDetectConflictsAndMissingCredentials(t *testing.T) {
	socks := func(tag, address string, port int) map[string]any {
		return map[string]any{"tag": tag, "protocol": "socks", "settings": map[string]any{"servers": []any{map[string]any{"address": address, "port": port}}}}
	}
	healthy := socks("tor-de", "[::1]", 9050)
	if got := outboundIssues("master", map[string]any{"outbounds": []any{healthy}}); len(got) != 0 {
		t.Fatalf("healthy local SOCKS configuration: %v", got)
	}
	for _, tc := range []struct {
		outbounds []any
		want      string
	}{
		{[]any{healthy, socks("tor-nl", "localhost", 9050)}, "both use local SOCKS port"},
		{[]any{healthy, socks("tor-alt-de", "LOCALHOST", 9051)}, "location"},
		{[]any{socks("windscribe-de", "127.0.0.1", 1080)}, "credentials"},
		{[]any{socks("tor-nl", "192.0.2.1", 9050)}, "loopback"},
	} {
		issues := outboundIssues("master", map[string]any{"outbounds": tc.outbounds})
		if len(issues) != 1 || !strings.Contains(issues[0].Message, tc.want) {
			t.Fatalf("wanted %q, got %v", tc.want, issues)
		}
	}
}

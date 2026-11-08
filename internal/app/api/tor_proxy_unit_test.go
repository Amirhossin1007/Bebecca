package api

import "testing"

func TestDuplicateTorOutboundTag(t *testing.T) {
	config := map[string]any{
		"outbounds": []any{map[string]any{"tag": "tor-de"}},
	}
	profiles := []torProxyProfile{{Tag: "tor-nl"}, {Tag: "tor-de"}}
	if got := duplicateTorOutboundTag(config, profiles); got != "tor-de" {
		t.Fatalf("duplicateTorOutboundTag() = %q, want tor-de", got)
	}
}

func TestManagedProxyConflictAllowsSameTagReplacement(t *testing.T) {
	config := map[string]any{"outbounds": []any{map[string]any{
		"tag": "windscribe-de", "protocol": "socks",
		"settings": map[string]any{"servers": []any{map[string]any{"address": "127.0.0.1", "port": 18080}}},
	}}}
	if tag, conflict := managedProxyConflict(config, "windscribe-us", 18080); !conflict || tag != "windscribe-de" {
		t.Fatalf("expected port conflict, got %q/%v", tag, conflict)
	}
	if tag, conflict := managedProxyConflict(config, "windscribe-de", 18080); conflict || tag != "" {
		t.Fatalf("same-tag replacement should be allowed, got %q/%v", tag, conflict)
	}
}

func TestManagedProxyLocationConflict(t *testing.T) {
	config := map[string]any{"outbounds": []any{map[string]any{
		"tag": "custom", "rebecca_proxy": "tor", "rebecca_proxy_location": "de",
	}}}
	if tag, conflict := managedProxyLocationConflict(config, "tor", "de", "other"); !conflict || tag != "custom" {
		t.Fatalf("expected location conflict, got %q/%v", tag, conflict)
	}
	if _, conflict := managedProxyLocationConflict(config, "tor", "us", "other"); conflict {
		t.Fatal("unexpected conflict for another location")
	}
}

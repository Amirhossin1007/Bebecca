package nodecontroller

import (
	"testing"

	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

func TestOVRuntimeSettingsAppliesDCOAndDefaults(t *testing.T) {
	inbound := map[string]any{"settings": map[string]any{"require_dco": true, "transport": "TCP"}}
	settings := OVRuntimeSettings(inbound)
	if settings["transport"] != "tcp" {
		t.Fatalf("transport=%v want tcp", settings["transport"])
	}
	if settings["data_ciphers"] != xrayconfig.OVDCODataCiphers {
		t.Fatalf("data_ciphers=%v want the DCO cipher list", settings["data_ciphers"])
	}
	if settings["inline_ca"] != true || settings["route_nopull"] != false {
		t.Fatalf("fallback flags not applied: %v", settings)
	}
}

func TestOVRuntimeSettingsWithoutDCOLeavesCiphersOut(t *testing.T) {
	settings := OVRuntimeSettings(map[string]any{"settings": map[string]any{}})
	if _, ok := settings["data_ciphers"]; ok {
		t.Fatalf("data_ciphers must only be set with require_dco: %v", settings)
	}
}

package nodecontroller

import "testing"

func TestSkipNodeMetricsClearsInactiveRuntimeState(t *testing.T) {
	for _, status := range []string{"disabled", "limited"} {
		item := NodeListItem{Status: status, AgentStatus: "connected", XrayStatus: "running"}
		if !skipNodeMetrics(&item) {
			t.Fatalf("expected %s node metrics to be skipped", status)
		}
		if item.AgentStatus != "unknown" || item.XrayStatus != "stopped" {
			t.Fatalf("stale runtime state remained for %s node: %#v", status, item)
		}
	}

	item := NodeListItem{Status: "connected", AgentStatus: "connected", XrayStatus: "running"}
	if skipNodeMetrics(&item) {
		t.Fatal("connected node metrics should still be collected")
	}
}

func TestEnrichCertificateFieldsIncludesInstallBundleMaterial(t *testing.T) {
	defaultCert := "default certificate"
	defaultKey := "default key"

	legacy := NodeListItem{}
	enrichCertificateFields(&legacy, defaultCert, defaultKey)
	if !legacy.UsesDefaultCertificate || legacy.HasCustomCertificate {
		t.Fatalf("expected legacy node to use the default certificate: %#v", legacy)
	}
	if legacy.NodeCertificate == nil || *legacy.NodeCertificate != defaultCert {
		t.Fatalf("default certificate was not exposed for install bundle: %#v", legacy)
	}
	if legacy.NodeCertificateKey == nil || *legacy.NodeCertificateKey != defaultKey {
		t.Fatalf("default key was not exposed for install bundle: %#v", legacy)
	}

	customCert := "custom certificate"
	customKey := "custom key"
	custom := NodeListItem{NodeCertificate: &customCert, NodeCertificateKey: &customKey}
	enrichCertificateFields(&custom, defaultCert, defaultKey)
	if custom.UsesDefaultCertificate || !custom.HasCustomCertificate {
		t.Fatalf("expected custom node certificate flags: %#v", custom)
	}
	if custom.NodeCertificate == nil || *custom.NodeCertificate != customCert {
		t.Fatalf("custom certificate changed unexpectedly: %#v", custom)
	}
	if custom.NodeCertificateKey == nil || *custom.NodeCertificateKey != customKey {
		t.Fatalf("custom key was not exposed for install bundle: %#v", custom)
	}
}

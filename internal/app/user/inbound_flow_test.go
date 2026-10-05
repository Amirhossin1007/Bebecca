package user

import (
	"net/url"
	"testing"
)

func TestInboundFlowIsExplicitForRPCAndConfigLinks(t *testing.T) {
	const vision = "xtls-rprx-vision"
	const key = "05bfddf81eb418fa1edbce7cd286eee1"
	for _, network := range []string{"tcp", "xhttp"} {
		for _, flow := range []string{"", vision} {
			inbound := map[string]any{"tag": "test", "protocol": "vless", "port": 443, "settings": map[string]any{"decryption": "mlkem768x25519plus.native.600s.test", "encryption": "mlkem768x25519plus.native.0rtt.test", "flow": flow}, "streamSettings": map[string]any{"network": network, "security": "tls"}}
			settings, err := RuntimeProxySettingsForInbound(map[string]any{"flow": vision}, inbound, key, vision, nil)
			if err != nil {
				t.Fatal(err)
			}
			if stringValue(settings["flow"]) != flow {
				t.Fatalf("%s RPC flow=%v, want %q", network, settings, flow)
			}
			resolved, err := resolveInbound(inbound)
			if err != nil {
				t.Fatal(err)
			}
			serviceID := int64(1)
			links, err := BuildConfigLinks(ConfigLinkUser{Username: "test", ServiceID: &serviceID, CredentialKey: key, Flow: vision}, map[string]ResolvedInbound{"test": resolved}, []string{"test"}, []Host{{InboundTag: "test", Address: "example.com", ServiceIDs: []int64{1}}}, nil, false)
			if err != nil {
				t.Fatal(err)
			}
			if len(links.Links) != 1 {
				t.Fatalf("links=%v", links.Links)
			}
			parsed, _ := url.Parse(links.Links[0])
			if got := parsed.Query().Get("flow"); got != flow {
				t.Fatalf("%s link flow=%q, want %q", network, got, flow)
			}
		}
	}
}

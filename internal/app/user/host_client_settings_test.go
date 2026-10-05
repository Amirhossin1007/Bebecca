package user

import (
	"encoding/json"
	"net/url"
	"reflect"
	"strings"
	"testing"
)

func TestValidateHostClientSettings(t *testing.T) {
	for _, test := range []struct {
		name, raw string
		valid     bool
	}{
		{"empty", `{}`, true},
		{"ECH DNS", `{"tlsSettings":{"echConfigList":"cloudflare-ech.com+udp://1.1.1.1"}}`, true},
		{"ECH local HTTPS", `{"tlsSettings":{"echConfigList":"cloudflare-ech.com+https+local://dns.example.com/dns-query"}}`, true},
		{"ECH disabled", `{"tlsSettings":{"echConfigList":""}}`, true},
		{"TLS tuning", `{"tlsSettings":{"minVersion":"1.2","maxVersion":"1.3","curvePreferences":["X25519"],"enableSessionResumption":false,"echSockopt":{"domainStrategy":"UseIPv4"}}}`, true},
		{"transport tuning", `{"wsSettings":{"heartbeatPeriod":30,"headers":{"User-Agent":"client"}},"sockopt":{"tcpFastOpen":true,"tcpMptcp":false},"mux":{"concurrency":8}}`, true},
		{"gRPC mode", `{"grpcSettings":{"multiMode":false}}`, true},
		{"happy eyeballs", `{"sockopt":{"happyEyeballs":{"prioritizeIPv6":false,"tryDelayMs":250,"maxConcurrentTry":4}}}`, true},
		{"empty happy eyeballs workers", `{"sockopt":{"happyEyeballs":{"maxConcurrentTry":0}}}`, false},
		{"raw request", `{"tcpSettings":{"header":{"request":{"method":"GET","version":"1.1","headers":{"User-Agent":["client"]}}}}}`, true},
		{"XHTTP", `{"xhttpSettings":{"scMaxEachPostBytes":"100-200","xmux":{"maxConnections":4}}}`, true},
		{"VMess", `{"vmessSecurity":"chacha20-poly1305"}`, true},
		{"server flow", `{"flow":"xtls-rprx-vision"}`, false},
		{"server ECH key", `{"tlsSettings":{"echServerKeys":"private"}}`, false},
		{"server path", `{"wsSettings":{"path":"/other"}}`, false},
		{"group type", `{"sockopt":true}`, false},
		{"boolean type", `{"sockopt":{"tcpFastOpen":"true"}}`, false},
		{"unknown ECH", `{"tlsSettings":{"echConfigList":"not a config"}}`, false},
		{"reverse TLS range", `{"tlsSettings":{"minVersion":"1.3","maxVersion":"1.2"}}`, false},
		{"negative unsigned", `{"wsSettings":{"heartbeatPeriod":-1}}`, false},
		{"fraction", `{"mux":{"concurrency":1.5}}`, false},
		{"mux overflow", `{"mux":{"concurrency":32768}}`, false},
		{"range", `{"xhttpSettings":{"scMaxEachPostBytes":"200-100"}}`, false},
		{"host duplicate", `{"wsSettings":{"headers":{"Host":"other.example"}}}`, false},
		{"header injection", `{"wsSettings":{"headers":{"User-Agent":"client\r\nInjected: yes"}}}`, false},
		{"header name", `{"wsSettings":{"headers":{"Bad:Name":"value"}}}`, false},
		{"raw header type", `{"tcpSettings":{"header":{"request":{"headers":{"User-Agent":"client"}}}}}`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			var settings map[string]any
			if err := json.Unmarshal([]byte(test.raw), &settings); err != nil {
				t.Fatal(err)
			}
			if err := ValidateHostClientSettings(settings); (err == nil) != test.valid {
				t.Fatalf("valid=%v err=%v", test.valid, err)
			}
		})
	}
	if err := ValidateHostClientSettings(map[string]any{"tlsSettings": map[string]any{"cipherSuites": strings.Repeat("a", 65536)}}); err == nil {
		t.Fatal("oversized settings accepted")
	}
}

func TestHostClientSettingsAreIsolatedAndPreservedInSubscriptions(t *testing.T) {
	serviceID := int64(1)
	base := ResolvedInbound{"tag": "test", "protocol": "vless", "port": int64(443), "network": "ws", "tls": "tls", "path": "/ws", "sni": "cert.example.com", "echConfigList": "inherited.example.com+udp://1.1.1.1"}
	before, _ := json.Marshal(base)
	first := map[string]any{
		"tlsSettings": map[string]any{"echConfigList": "cloudflare-ech.com+udp://1.1.1.1", "minVersion": "1.2"},
		"wsSettings":  map[string]any{"heartbeatPeriod": 30, "headers": map[string]any{"User-Agent": "client-A"}},
		"sockopt":     map[string]any{"tcpFastOpen": true},
	}
	response, err := BuildConfigLinks(ConfigLinkUser{ID: 1, Username: "alice", Status: "active", ServiceID: &serviceID, Proxies: []StoredProxy{{Type: "vless", Settings: map[string]any{"id": "05bfddf8-1eb4-18fa-1edb-ce7cd286eee1"}}}},
		map[string]ResolvedInbound{"test": base}, []string{"test"}, []Host{
			{ID: 1, InboundTag: "test", Remark: "A", Address: "one.example.com", ServiceIDs: []int64{1}, ClientSettings: first},
			{ID: 2, InboundTag: "test", Remark: "B", Address: "two.example.com", ServiceIDs: []int64{1}, ClientSettings: map[string]any{"tlsSettings": map[string]any{"echConfigList": ""}}},
			{ID: 3, InboundTag: "test", Remark: "C", Address: "three.example.com", ServiceIDs: []int64{1}},
		}, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if len(response.Links) != 3 {
		t.Fatalf("links=%v", response.Links)
	}
	for index, wantECH := range []string{"cloudflare-ech.com+udp://1.1.1.1", "", "inherited.example.com+udp://1.1.1.1"} {
		parsed, err := url.Parse(response.Links[index])
		if err != nil || parsed.Query().Get("ech") != wantECH {
			t.Fatalf("host %d ECH=%v err=%v", index, parsed, err)
		}
		if parsed.Query().Has("client_settings") {
			t.Fatal("nonstandard client_settings URI parameter emitted")
		}
	}
	content, err := renderXrayJSONSubscriptionWithMetadata(response.Links, response.Metadata, false, "", "", true)
	if err != nil {
		t.Fatal(err)
	}
	var configs []map[string]any
	if err := json.Unmarshal([]byte(content), &configs); err != nil {
		t.Fatal(err)
	}
	for index, config := range configs {
		outbound := listOfMaps(config["outbounds"])[0]
		stream := mapValue(outbound["streamSettings"])
		tls := mapValue(stream["tlsSettings"])
		if index == 0 {
			if tls["minVersion"] != "1.2" || mapValue(stream["sockopt"])["tcpFastOpen"] != true || mapValue(mapValue(stream["wsSettings"])["headers"])["User-Agent"] != "client-A" {
				t.Fatalf("client options missing: %#v", stream)
			}
		} else if len(mapValue(stream["sockopt"])) > 0 || tls["minVersion"] != nil || mapValue(mapValue(stream["wsSettings"])["headers"])["User-Agent"] != nil {
			t.Fatalf("host %d inherited another host's options: %#v", index, stream)
		}
	}
	after, _ := json.Marshal(base)
	if string(before) != string(after) || !reflect.DeepEqual(response.Metadata[0].ClientSettings, cloneJSONMap(first)) {
		t.Fatal("inbound mutated or metadata lost")
	}
}

func TestHostXHTTPTuningOverridesExtraWithoutChangingServerFields(t *testing.T) {
	outbound := map[string]any{"protocol": "vless", "streamSettings": map[string]any{
		"network": "xhttp", "security": "reality", "realitySettings": map[string]any{"serverName": "server.example"},
		"xhttpSettings": map[string]any{"path": "/required", "mode": "auto", "extra": map[string]any{"scMaxEachPostBytes": "100-200", "noSSEHeader": true}},
	}}
	applyHostClientSettings(outbound, map[string]any{
		"tlsSettings":   map[string]any{"echConfigList": ""},
		"wsSettings":    map[string]any{"heartbeatPeriod": 30},
		"xhttpSettings": map[string]any{"scMaxEachPostBytes": "200-300"},
	})
	stream := mapValue(outbound["streamSettings"])
	xhttp := mapValue(stream["xhttpSettings"])
	if mapValue(xhttp["extra"])["scMaxEachPostBytes"] != "200-300" || mapValue(xhttp["extra"])["noSSEHeader"] != true || xhttp["path"] != "/required" || stream["wsSettings"] != nil || stream["tlsSettings"] != nil {
		t.Fatalf("incorrect transport overrides: %#v", stream)
	}
}

func TestExplicitAccountFlowOverridesLegacyProxyFlow(t *testing.T) {
	for _, flow := range []string{"", "xtls-rprx-vision"} {
		settings, err := RuntimeProxySettings(map[string]any{"id": "05bfddf8-1eb4-18fa-1edb-ce7cd286eee1", "flow": "xtls-rprx-vision"}, "vless", "", flow, nil)
		if err != nil || stringValue(settings["flow"]) != flow {
			t.Fatalf("explicit flow %q settings=%v err=%v", flow, settings, err)
		}
	}
}

func TestHostClientSettingsTransportAliasesAndVMess(t *testing.T) {
	for _, network := range []string{"tcp", "raw", "ws", "httpupgrade", "grpc", "kcp", "xhttp", "splithttp"} {
		t.Run(network, func(t *testing.T) {
			group := networkSettingsKey(network)
			overrideGroup := group
			if network == "raw" {
				overrideGroup = "tcpSettings"
			} else if network == "splithttp" {
				overrideGroup = "xhttpSettings"
			}
			value := map[string]any{"headers": map[string]any{"User-Agent": "test"}}
			switch network {
			case "tcp", "raw":
				value = map[string]any{"header": map[string]any{"request": map[string]any{"method": "GET"}}}
			case "grpc":
				value = map[string]any{"user_agent": "test"}
			case "kcp":
				value = map[string]any{"uplinkCapacity": float64(10)}
			}
			outbound := map[string]any{"protocol": "vless", "streamSettings": map[string]any{"network": network, group: map[string]any{"path": "/required"}}}
			applyHostClientSettings(outbound, map[string]any{overrideGroup: value})
			transport := mapValue(mapValue(outbound["streamSettings"])[group])
			for key := range value {
				if !reflect.DeepEqual(transport[key], value[key]) {
					t.Fatalf("%s override missing: %#v", network, transport)
				}
			}
			if transport["path"] != "/required" {
				t.Fatal("server-required field changed")
			}
		})
	}
	outbound := map[string]any{"protocol": "vmess", "settings": map[string]any{"vnext": []any{map[string]any{"users": []any{map[string]any{"security": "auto"}}}}}}
	applyHostClientSettings(outbound, map[string]any{"vmessSecurity": "chacha20-poly1305"})
	account := listOfMaps(listOfMaps(mapValue(outbound["settings"])["vnext"])[0]["users"])[0]
	if account["security"] != "chacha20-poly1305" {
		t.Fatal("VMess cipher override lost")
	}
}

func TestHostMuxOptionsRespectVisionAndDisabledMux(t *testing.T) {
	for _, vision := range []bool{false, true} {
		outbound := map[string]any{"protocol": "vless", "settings": map[string]any{"vnext": []any{map[string]any{"users": []any{map[string]any{"id": "05bfddf8-1eb4-18fa-1edb-ce7cd286eee1"}}}}}}
		if vision {
			listOfMaps(listOfMaps(mapValue(outbound["settings"])["vnext"])[0]["users"])[0]["flow"] = "xtls-rprx-vision"
		}
		settings := map[string]any{"mux": map[string]any{"concurrency": float64(4)}}
		applyHostClientSettings(outbound, settings)
		if outbound["mux"] != nil {
			t.Fatal("client tuning enabled disabled mux")
		}
		outbound["mux"] = map[string]any{"enabled": true, "concurrency": float64(8)}
		applyHostClientSettings(outbound, settings)
		want := float64(4)
		if vision {
			want = 8
		}
		if mapValue(outbound["mux"])["concurrency"] != want {
			t.Fatalf("vision=%v mux=%v", vision, outbound["mux"])
		}
	}
}

func TestHostGRPCModeCanDifferFromInbound(t *testing.T) {
	inbound := ResolvedInbound{"tag": "grpc", "protocol": "vless", "network": "grpc", "port": 443, "tls": "tls", "path": "required", "multiMode": true}
	for _, multi := range []bool{false, true} {
		_, _, effective, ok := effectiveInboundForHost("salt", nil, inbound, Host{Address: "host.example.com", ClientSettings: map[string]any{"grpcSettings": map[string]any{"multiMode": multi}}})
		if !ok || effective["multiMode"] != multi || inbound["multiMode"] != true {
			t.Fatalf("gRPC host override changed server: effective=%v inbound=%v", effective, inbound)
		}
		link := vlessShareLink("grpc", "host.example.com", "required", effective, map[string]any{"id": "05bfddf8-1eb4-18fa-1edb-ce7cd286eee1"})
		parsed, err := url.Parse(link)
		if err != nil || (parsed.Query().Get("mode") == "multi") != multi || parsed.Query().Get("serviceName") != "required" {
			t.Fatalf("gRPC share link lost mode/service: %s err=%v", link, err)
		}
	}
}

package user

import (
	"encoding/json"
	"net/url"
	"testing"
)

func TestXHTTPSessionKeysAreCurrentForAnyInput(t *testing.T) {
	inputs := map[string]map[string]any{
		"current input": {
			"sessionIDPlacement": "header", "sessionIDKey": "X-Session",
			"downloadSettings": map[string]any{
				"address": "down.example.com", "port": 8443, "network": "xhttp",
				"xhttpSettings": map[string]any{"path": "/down", "sessionIDPlacement": "query", "sessionIDKey": "sid"},
			},
		},
		"legacy input": {
			"sessionPlacement": "header", "sessionKey": "X-Session",
			"downloadSettings": map[string]any{
				"address": "down.example.com", "port": 8443, "network": "xhttp",
				"xhttpSettings": map[string]any{"path": "/down", "sessionPlacement": "query", "sessionKey": "sid"},
			},
		},
	}
	renders := map[string]func([]string, bool) (string, error){
		"v2ray-json": renderV2RayJSONSubscription,
		"xray-json":  renderXrayJSONSubscription,
	}
	for inputName, input := range inputs {
		extra, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		query := url.Values{"type": {"xhttp"}, "security": {"tls"}, "path": {"/x"}, "host": {"edge.example.com"}, "mode": {"auto"}, "extra": {string(extra)}}
		link := "vless://11111111-1111-4111-8111-111111111111@example.com:443?" + query.Encode() + "#probe"
		for renderName, render := range renders {
			t.Run(inputName+" rendered as "+renderName, func(t *testing.T) {
				body, err := render([]string{link}, false)
				if err != nil {
					t.Fatal(err)
				}
				var configs []map[string]any
				if err := json.Unmarshal([]byte(body), &configs); err != nil {
					t.Fatal(err)
				}
				outbound := configs[0]["outbounds"].([]any)[0].(map[string]any)
				outerExtra := outbound["streamSettings"].(map[string]any)["xhttpSettings"].(map[string]any)["extra"].(map[string]any)
				nested := outerExtra["downloadSettings"].(map[string]any)["xhttpSettings"].(map[string]any)
				if outerExtra["sessionIDPlacement"] != "header" || outerExtra["sessionIDKey"] != "X-Session" {
					t.Fatalf("outer extra session ids = %#v, want current names; extra=%#v", outerExtra, outerExtra)
				}
				if nested["sessionIDPlacement"] != "query" || nested["sessionIDKey"] != "sid" {
					t.Fatalf("download xhttpSettings session ids = %#v, want current names", nested)
				}
				for _, legacy := range []string{"sessionPlacement", "sessionKey"} {
					if _, exists := outerExtra[legacy]; exists {
						t.Fatalf("outer extra kept legacy %s: %#v", legacy, outerExtra)
					}
					if _, exists := nested[legacy]; exists {
						t.Fatalf("download xhttpSettings kept legacy %s: %#v", legacy, nested)
					}
				}
			})
		}
	}
}

func TestShareLinkDownloadSettingsUseCurrentSessionKeys(t *testing.T) {
	serviceID := int64(1)
	inbound, err := resolveInbound(map[string]any{
		"tag":      "VLESS XHTTP",
		"protocol": "vless",
		"port":     int64(443),
		"settings": map[string]any{"clients": []any{}, "decryption": "none"},
		"streamSettings": map[string]any{
			"network":  "xhttp",
			"security": "none",
			"xhttpSettings": map[string]any{
				"path":             "/x",
				"mode":             "packet-up",
				"sessionPlacement": "header",
				"sessionKey":       "X-Session",
				"downloadSettings": map[string]any{
					"address": "down.example.com", "port": int64(8443), "network": "xhttp",
					"xhttpSettings": map[string]any{"path": "/down", "sessionPlacement": "query", "sessionKey": "sid"},
				},
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	links, err := BuildConfigLinks(
		ConfigLinkUser{
			ID:                8,
			Username:          "bob",
			Status:            "active",
			ServiceID:         &serviceID,
			CredentialKey:     "05bfddf81eb418fa1edbce7cd286eee1",
			ServiceHostOrders: map[int64]int64{1: 0},
		},
		map[string]ResolvedInbound{"VLESS XHTTP": inbound},
		[]string{"VLESS XHTTP"},
		[]Host{{ID: 1, InboundTag: "VLESS XHTTP", Remark: "xhttp", Address: "edge.example.com", Security: "inbound_default", ServiceIDs: []int64{1}}},
		map[string][]byte{},
		false,
	)
	if err != nil {
		t.Fatalf("BuildConfigLinks error: %v", err)
	}
	parsed, err := url.Parse(links.Links[0])
	if err != nil {
		t.Fatal(err)
	}
	var extra map[string]any
	if err := json.Unmarshal([]byte(parsed.Query().Get("extra")), &extra); err != nil {
		t.Fatalf("extra is not valid JSON: %v", err)
	}
	nested := extra["downloadSettings"].(map[string]any)["xhttpSettings"].(map[string]any)
	if nested["sessionIDPlacement"] != "query" || nested["sessionIDKey"] != "sid" {
		t.Fatalf("share link download settings kept legacy session keys: %#v", nested)
	}
	if _, legacy := nested["sessionPlacement"]; legacy {
		t.Fatalf("share link download settings still carry sessionPlacement: %#v", nested)
	}
}

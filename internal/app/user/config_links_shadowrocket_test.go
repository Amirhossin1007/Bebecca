package user

import (
	"encoding/base64"
	"encoding/json"
	"net/url"
	"strings"
	"testing"
)

func TestShadowrocketVLESSShareLinkRewritesStandardLink(t *testing.T) {
	link := "vless://cab64579-bd41-4ce7-9cc2-4011ebd03e0f@151.101.36.99:443?security=tls&type=xhttp&headerType=none&encryption=none&path=&host=Schooli.global.ssl.fastly.net&mode=packet-up&extra=%7B%22xPaddingBytes%22%3A%22100-1000%22%7D&sni=cdn.akamai.steamstatic.com&fp=chrome&alpn=h2&pcs=CD6E838B9BFE31CAB8B3D5C858B0D6223FE84ECE236C1FDB281BE93C302E1E6E#%F0%9F%87%A9%F0%9F%87%AA%20%20Germany%20-%20f1"
	parsed, err := url.Parse(shadowrocketVLESSShareLink(link))
	if err != nil {
		t.Fatal(err)
	}
	authority, err := base64.RawURLEncoding.DecodeString(parsed.Host)
	if err != nil {
		t.Fatal(err)
	}
	if string(authority) != "none:cab64579-bd41-4ce7-9cc2-4011ebd03e0f@151.101.36.99:443" {
		t.Fatalf("authority = %q", authority)
	}
	want := map[string]string{
		"remarks":     "🇩🇪  Germany - f1",
		"obfs":        "xhttp",
		"obfsParam":   `{"":{"xPaddingBytes":"100-1000"},"Host":"Schooli.global.ssl.fastly.net"}`,
		"mode":        "packet-up",
		"tls":         "1",
		"peer":        "cdn.akamai.steamstatic.com",
		"alpn":        "h2",
		"fingerprint": "chrome",
		"hpkp":        "CD6E838B9BFE31CAB8B3D5C858B0D6223FE84ECE236C1FDB281BE93C302E1E6E",
		"udp":         "1",
	}
	query := parsed.Query()
	if len(query) != len(want) {
		t.Fatalf("query = %v", query)
	}
	for key, value := range want {
		if query.Get(key) != value {
			t.Fatalf("%s = %q, want %q", key, query.Get(key), value)
		}
	}
}

func TestShadowrocketVLESSShareLinkKeepsUnsupportedLinks(t *testing.T) {
	for _, link := range []string{
		"vless://uuid@example.com:443?security=reality&type=tcp&headerType=none&encryption=none&pbk=key&sid=&sni=example.com&fp=chrome",
		"vless://uuid@example.com:443?security=tls&type=tcp&headerType=none&encryption=none&flow=xtls-rprx-vision&sni=example.com&fp=chrome",
		"vless://uuid@example.com:443?security=tls&type=tcp&headerType=none&encryption=mlkem768x25519plus.native.0rtt.key&sni=example.com&fp=chrome",
		"trojan://pass@example.com:443?security=tls&type=tcp&headerType=none&sni=example.com",
	} {
		if got := shadowrocketVLESSShareLink(link); got != link {
			t.Fatalf("converted unsupported link %q to %q", link, got)
		}
	}
}

func TestShadowrocketTrojanShareLinkAddsPeer(t *testing.T) {
	got := shadowrocketShareLink("trojan://pass@example.com:443?security=tls&type=tcp&headerType=none&sni=cdn.example.com#node%201")
	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Query().Get("peer") != "cdn.example.com" || parsed.Query().Get("sni") != "cdn.example.com" {
		t.Fatalf("query = %v", parsed.Query())
	}
	if parsed.Fragment != "node 1" || parsed.Host != "example.com:443" {
		t.Fatalf("fragment = %q host = %q", parsed.Fragment, parsed.Host)
	}
	withPeer := "trojan://pass@example.com:443?peer=other.example.com&security=tls&sni=cdn.example.com"
	if shadowrocketShareLink(withPeer) != withPeer {
		t.Fatalf("rewrote a trojan link that already has peer")
	}
}

func TestShadowrocketVMessShareLinkUsesLegacyFields(t *testing.T) {
	payload, _ := json.Marshal(map[string]any{
		"add": "151.101.36.99", "aid": "0", "host": "cdn.example.com", "id": "uuid-1", "net": "ws", "path": "/ws",
		"port": 443, "ps": "node 1", "scy": "auto", "tls": "tls", "type": "none", "v": "2",
		"sni": "cdn.example.com", "fp": "chrome", "alpn": "h2",
	})
	got := shadowrocketShareLink("vmess://" + base64.StdEncoding.EncodeToString(payload))
	authority, rawQuery, _ := strings.Cut(strings.TrimPrefix(got, "vmess://"), "?")
	decoded, err := base64.StdEncoding.DecodeString(authority)
	if err != nil {
		t.Fatal(err)
	}
	if string(decoded) != "auto:uuid-1@151.101.36.99:443" {
		t.Fatalf("authority = %q", decoded)
	}
	query, err := url.ParseQuery(rawQuery)
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"remarks": "node 1", "tfo": "1", "alterId": "0", "obfs": "websocket", "obfsParam": "cdn.example.com",
		"path": "/ws", "tls": "1", "peer": "cdn.example.com", "alpn": "h2", "fingerprint": "chrome",
	}
	if len(query) != len(want) {
		t.Fatalf("query = %v", query)
	}
	for key, value := range want {
		if query.Get(key) != value {
			t.Fatalf("%s = %q, want %q", key, query.Get(key), value)
		}
	}
	grpc := "vmess://" + base64.StdEncoding.EncodeToString([]byte(`{"add":"a.example","aid":"0","id":"u","net":"grpc","port":443,"ps":"x","tls":"none","type":"none","v":"2"}`))
	if shadowrocketShareLink(grpc) != grpc {
		t.Fatalf("converted unsupported grpc vmess link")
	}
}

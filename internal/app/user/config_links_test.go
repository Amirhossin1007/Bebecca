package user

import (
	"strings"
	"testing"
	"time"
)

func TestBuildConfigLinksReplacesServerIPPlaceholder(t *testing.T) {
	serviceID := int64(1)
	links, err := BuildConfigLinks(
		ConfigLinkUser{
			ID:            7,
			Username:      "alice",
			Status:        "active",
			ServiceID:     &serviceID,
			CredentialKey: "05bfddf81eb418fa1edbce7cd286eee1",
			ServerIP:      "116.203.156.169",
			ServiceHostOrders: map[int64]int64{
				1: 0,
			},
		},
		map[string]ResolvedInbound{
			"Shadowsocks TCP": {
				"tag":      "Shadowsocks TCP",
				"protocol": "shadowsocks",
				"port":     int64(1080),
				"network":  "tcp",
			},
		},
		[]string{"Shadowsocks TCP"},
		[]Host{{
			ID:         1,
			InboundTag: "Shadowsocks TCP",
			Remark:     "Rebecca ({username})",
			Address:    "{SERVER_IP}",
			Security:   "inbound_default",
			ServiceIDs: []int64{1},
		}},
		map[string][]byte{},
		false,
	)
	if err != nil {
		t.Fatalf("BuildConfigLinks error: %v", err)
	}
	if len(links.Links) != 1 {
		t.Fatalf("expected one link, got %#v", links.Links)
	}
	if strings.Contains(links.Links[0], "{SERVER_IP}") || !strings.Contains(links.Links[0], "@116.203.156.169:1080") {
		t.Fatalf("server IP placeholder was not replaced: %s", links.Links[0])
	}
}

func TestBuildConfigLinksReplacesSubscriptionRemarkPlaceholders(t *testing.T) {
	serviceID := int64(1)
	expire := time.Now().UTC().Add(48 * time.Hour).Unix()
	dataLimit := int64(10 * 1024 * 1024 * 1024)
	links, err := BuildConfigLinks(
		ConfigLinkUser{
			ID:            7,
			Username:      "alice",
			Status:        "active",
			UsedTraffic:   1024 * 1024 * 1024,
			DataLimit:     &dataLimit,
			Expire:        &expire,
			ServiceID:     &serviceID,
			CredentialKey: "05bfddf81eb418fa1edbce7cd286eee1",
			ServiceHostOrders: map[int64]int64{
				1: 0,
			},
		},
		map[string]ResolvedInbound{
			"VLESS WS": {
				"tag":         "VLESS WS",
				"protocol":    "vless",
				"port":        int64(443),
				"network":     "ws",
				"tls":         "tls",
				"encryption":  "none",
				"path":        "/ws",
				"header_type": "none",
			},
		},
		[]string{"VLESS WS"},
		[]Host{{
			ID:         1,
			InboundTag: "VLESS WS",
			Remark:     "{USERNAME}|{DATA_LEFT}|{PROTOCOL}|{TRANSPORT}|{EXPIRE_DATE}|{JALALI_EXPIRE_DATE}",
			Address:    "edge.example.com",
			Security:   "inbound_default",
			ServiceIDs: []int64{1},
		}},
		map[string][]byte{},
		false,
	)
	if err != nil {
		t.Fatalf("BuildConfigLinks error: %v", err)
	}
	if len(links.Links) != 1 {
		t.Fatalf("expected one link, got %#v", links.Links)
	}
	link := links.Links[0]
	if strings.Contains(link, "{USERNAME}") || strings.Contains(link, "{DATA_LEFT}") || strings.Contains(link, "{PROTOCOL}") || strings.Contains(link, "{TRANSPORT}") || strings.Contains(link, "{EXPIRE_DATE}") || strings.Contains(link, "{JALALI_EXPIRE_DATE}") {
		t.Fatalf("remark placeholders were not replaced: %s", link)
	}
	for _, expected := range []string{"alice", "9.00%20GB", "VLESS", "WS"} {
		if !strings.Contains(link, expected) {
			t.Fatalf("expected %q in link: %s", expected, link)
		}
	}
}

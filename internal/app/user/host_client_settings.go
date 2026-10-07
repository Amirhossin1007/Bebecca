package user

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"strings"
)

// Only client-side knobs belong here. Authentication, flow, transport selection,
// server keys and protocol-required paths remain owned by services/inbounds.
var hostClientSettingFields = map[string]map[string]string{
	"tlsSettings": {
		"echConfigList": "ech", "cipherSuites": "string",
		"minVersion": "tls-version", "maxVersion": "tls-version",
		"curvePreferences": "strings", "enableSessionResumption": "bool",
		"disableSystemRoot": "bool", "echSockopt": "sockopt",
	},
	"sockopt": {
		"tcpFastOpen": "bool", "tcpMptcp": "bool", "tcpKeepAliveIdle": "integer",
		"tcpKeepAliveInterval": "integer", "tcpUserTimeout": "integer",
		"tcpCongestion": "string", "domainStrategy": "domain-strategy",
		"tcpMaxSeg": "nonnegative", "tcpWindowClamp": "nonnegative",
		"happyEyeballs": "happyEyeballs",
	},
	"happyEyeballs": {
		"prioritizeIPv6": "bool", "tryDelayMs": "nonnegative", "interleave": "positive", "maxConcurrentTry": "positive",
	},
	"wsSettings":          {"heartbeatPeriod": "nonnegative", "headers": "headers"},
	"httpupgradeSettings": {"headers": "headers"},
	"grpcSettings": {
		"idle_timeout": "integer", "health_check_timeout": "integer",
		"permit_without_stream": "bool", "initial_windows_size": "integer",
		"user_agent": "string", "multiMode": "bool",
	},
	"kcpSettings": {
		"uplinkCapacity": "nonnegative", "downlinkCapacity": "nonnegative",
	},
	"xhttpSettings": {
		"headers": "headers", "scMaxEachPostBytes": "range", "scMinPostsIntervalMs": "range",
		"xmux": "xmux",
	},
	"xmux": {
		"maxConcurrency": "range", "maxConnections": "range", "cMaxReuseTimes": "range",
		"hMaxRequestTimes": "range", "hMaxReusableSecs": "range", "hKeepAlivePeriod": "integer",
	},
	"mux":         {"concurrency": "mux-concurrency", "xudpConcurrency": "mux-concurrency", "xudpProxyUDP443": "udp443"},
	"tcpSettings": {"header": "request-header"},
}

func ValidateHostClientSettings(settings map[string]any) error {
	encoded, err := json.Marshal(settings)
	if err != nil || len(encoded) > 64<<10 {
		return fmt.Errorf("host client_settings must be a JSON object of at most 64 KiB")
	}
	for group, value := range settings {
		switch group {
		case "vmessSecurity":
			if !hostClientEnum(value, "", "auto", "aes-128-gcm", "chacha20-poly1305", "none", "zero") {
				return fmt.Errorf("invalid client_settings.vmessSecurity")
			}
		default:
			if group == "xmux" || group == "happyEyeballs" || hostClientSettingFields[group] == nil {
				return fmt.Errorf("client_settings.%s is not a supported client-only setting", group)
			}
			if err := validateHostClientGroup(group, value); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateHostClientGroup(group string, value any) error {
	object, ok := value.(map[string]any)
	if !ok {
		return fmt.Errorf("client_settings.%s must be an object", group)
	}
	for key, value := range object {
		kind, exists := hostClientSettingFields[group][key]
		if !exists {
			return fmt.Errorf("client_settings.%s.%s is not a supported client-only setting", group, key)
		}
		valid := false
		switch kind {
		case "string":
			_, valid = value.(string)
		case "bool":
			_, valid = value.(bool)
		case "strings":
			items, ok := value.([]any)
			valid = ok
			for _, item := range items {
				text, ok := item.(string)
				valid = valid && ok && strings.TrimSpace(text) != ""
			}
		case "integer":
			valid = hostClientInteger(value, -1)
		case "mux-concurrency":
			valid = hostClientInteger(value, -1) && intValue(value) <= math.MaxInt16
		case "nonnegative":
			valid = hostClientInteger(value, 0)
		case "positive":
			valid = hostClientInteger(value, 1)
		case "range":
			valid = hostClientInteger(value, 0)
			if text, ok := value.(string); ok {
				var low, high int64
				_, err := fmt.Sscanf(text, "%d-%d", &low, &high)
				valid = err == nil && low >= 0 && high >= low && high <= math.MaxInt32 && text == fmt.Sprintf("%d-%d", low, high)
			}
		case "tls-version":
			valid = hostClientEnum(value, "", "1.0", "1.1", "1.2", "1.3")
		case "domain-strategy":
			valid = hostClientEnum(value, "AsIs", "UseIP", "UseIPv4", "UseIPv6", "UseIPv4v6", "UseIPv6v4", "ForceIP", "ForceIPv4", "ForceIPv6", "ForceIPv4v6", "ForceIPv6v4")
		case "udp443":
			valid = hostClientEnum(value, "reject", "allow", "skip")
		case "ech":
			text, ok := value.(string)
			valid = ok && validHostECH(text)
		case "headers":
			valid = validHostClientHeaders(value, false)
		case "sockopt", "xmux", "happyEyeballs":
			if err := validateHostClientGroup(kind, value); err != nil {
				return err
			}
			valid = true
		case "request-header":
			header, ok := value.(map[string]any)
			request, requestOK := header["request"].(map[string]any)
			valid = ok && requestOK && len(header) == 1
			for name, item := range request {
				if name == "headers" {
					valid = valid && validHostClientHeaders(item, true)
				} else {
					_, textOK := item.(string)
					valid = valid && textOK && (name == "method" || name == "version")
				}
			}
		}
		if !valid {
			return fmt.Errorf("invalid client_settings.%s.%s", group, key)
		}
	}
	if group == "tlsSettings" {
		min, max := stringValue(object["minVersion"]), stringValue(object["maxVersion"])
		if min != "" && max != "" && min > max {
			return fmt.Errorf("client TLS minVersion cannot exceed maxVersion")
		}
	}
	return nil
}

func hostClientInteger(value any, minimum float64) bool {
	var number float64
	switch typed := value.(type) {
	case float64:
		number = typed
	case int:
		number = float64(typed)
	case int64:
		number = float64(typed)
	default:
		return false
	}
	return number >= minimum && number <= math.MaxInt32 && number == math.Trunc(number)
}

func hostClientEnum(value any, choices ...string) bool {
	text, ok := value.(string)
	if !ok {
		return false
	}
	for _, choice := range choices {
		if text == choice {
			return true
		}
	}
	return false
}

func validHostECH(value string) bool {
	if value == "" {
		return true // Explicitly disable an inherited ECH value.
	}
	if decoded, err := base64.StdEncoding.DecodeString(value); err == nil && len(decoded) > 0 {
		return true
	}
	resolver := value
	if index := strings.Index(value, "+"); index >= 0 && !strings.HasPrefix(value, "https+local://") {
		if strings.TrimSpace(value[:index]) == "" {
			return false
		}
		resolver = value[index+1:]
	}
	parsed, err := url.Parse(resolver)
	return err == nil && parsed.Hostname() != "" && parsed.User == nil &&
		(parsed.Scheme == "udp" || parsed.Scheme == "https" || parsed.Scheme == "https+local" || parsed.Scheme == "h2c")
}

func validHostClientHeaders(value any, list bool) bool {
	headers, ok := value.(map[string]any)
	if !ok {
		return false
	}
	for name, raw := range headers {
		if name == "" || strings.ContainsAny(name, " ()<>@,;:\\[]?={}\t\r\n\"") || strings.EqualFold(name, "Host") {
			return false // Host already has its own per-host override.
		}
		for _, char := range name {
			if char < 33 || char > 126 {
				return false
			}
		}
		values := []any{raw}
		if list {
			var ok bool
			values, ok = raw.([]any)
			if !ok || len(values) == 0 {
				return false
			}
		}
		for _, item := range values {
			text, ok := item.(string)
			if !ok || strings.ContainsAny(text, "\r\n") {
				return false
			}
		}
	}
	return true
}

func applyHostClientSettings(outbound map[string]any, settings map[string]any) {
	stream := mapValue(outbound["streamSettings"])
	network := normalizeNetwork(stringValue(stream["network"]))
	for group, value := range settings {
		switch group {
		case "tlsSettings":
			if stream["security"] == "tls" {
				stream[group] = mergeSingBoxObjects(mapValue(stream[group]), mapValue(value))
			}
		case "sockopt":
			stream[group] = mergeSingBoxObjects(mapValue(stream[group]), mapValue(value))
		case "xhttpSettings":
			if network == "xhttp" || network == "splithttp" {
				key := networkSettingsKey(network)
				transport := mapValue(stream[key])
				if extra := mapValue(transport["extra"]); len(extra) > 0 {
					// Xray replaces the top-level tuning with extra when it exists.
					transport["extra"] = mergeSingBoxObjects(extra, mapValue(value))
					stream[key] = transport
				} else {
					stream[key] = mergeSingBoxObjects(transport, mapValue(value))
				}
			}
		case "wsSettings", "httpupgradeSettings", "grpcSettings", "tcpSettings", "kcpSettings":
			if settingsGroup := map[string]string{"tcp": "tcpSettings", "raw": "tcpSettings", "ws": "wsSettings", "httpupgrade": "httpupgradeSettings", "grpc": "grpcSettings", "kcp": "kcpSettings"}[network]; group == settingsGroup {
				key := networkSettingsKey(network)
				stream[key] = mergeSingBoxObjects(mapValue(stream[key]), mapValue(value))
			}
		case "mux":
			if boolValue(mapValue(outbound["mux"])["enabled"]) && !v2rayOutboundUsesVision(outbound) {
				outbound[group] = mergeSingBoxObjects(mapValue(outbound[group]), mapValue(value))
			}
		case "vmessSecurity":
			if outbound["protocol"] == "vmess" {
				for _, server := range listOfMaps(mapValue(outbound["settings"])["vnext"]) {
					for _, account := range listOfMaps(server["users"]) {
						account["security"] = value
					}
				}
			}
		}
	}
	if len(stream) > 0 {
		outbound["streamSettings"] = stream
	}
}

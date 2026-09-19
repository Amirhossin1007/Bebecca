package api

import "strings"

// managedProxyConflict rejects a duplicate local SOCKS endpoint while allowing
// a caller to replace the same tagged outbound.
func managedProxyConflict(config map[string]any, tag string, port uint32) (string, bool) {
	for _, outbound := range outboundMaps(config["outbounds"]) {
		protocol := strings.ToLower(strings.TrimSpace(stringFromAny(outbound["protocol"])))
		address, existingPort := outboundAddressPort(protocol, outbound)
		if existingPort == nil || *existingPort != int64(port) || !isLoopbackAddress(address) {
			continue
		}
		existingTag := strings.TrimSpace(stringFromAny(outbound["tag"]))
		if tag != "" && existingTag == tag {
			continue
		}
		return existingTag, true
	}
	return "", false
}

func managedProxyLocationConflict(config map[string]any, kind, location, tag string) (string, bool) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	location = strings.ToLower(strings.TrimSpace(location))
	if kind == "" || location == "" {
		return "", false
	}
	for _, outbound := range outboundMaps(config["outbounds"]) {
		if strings.ToLower(strings.TrimSpace(stringFromAny(outbound["rebecca_proxy"]))) != kind {
			continue
		}
		existingTag := strings.TrimSpace(stringFromAny(outbound["tag"]))
		if tag != "" && existingTag == tag {
			continue
		}
		existingLocation := strings.ToLower(strings.TrimSpace(stringFromAny(outbound["rebecca_proxy_location"])))
		if existingLocation == "" {
			existingLocation = managedProxyLocationFromTag(kind, existingTag)
		}
		if existingLocation == location {
			return existingTag, true
		}
	}
	return "", false
}

func managedProxyLocationFromTag(kind, tag string) string {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(tag)), "-")
	if len(parts) > 1 && parts[0] == kind && len(parts[len(parts)-1]) == 2 {
		return parts[len(parts)-1]
	}
	return ""
}

func managedProxySingletonConflict(config map[string]any, kind, tag string) (string, bool) {
	kind = strings.ToLower(strings.TrimSpace(kind))
	for _, outbound := range outboundMaps(config["outbounds"]) {
		if strings.ToLower(strings.TrimSpace(stringFromAny(outbound["rebecca_proxy"]))) != kind {
			continue
		}
		existingTag := strings.TrimSpace(stringFromAny(outbound["tag"]))
		if existingTag != "" && existingTag != tag {
			return existingTag, true
		}
	}
	return "", false
}

func isLoopbackAddress(value string) bool {
	value = strings.TrimSpace(strings.Trim(value, "[]"))
	return value == "127.0.0.1" || value == "::1" || strings.EqualFold(value, "localhost")
}

package xrayconfig

import (
	"fmt"
	"strings"
	"time"
)

// ManagedOutboundProvider preserves the legacy name-based classification.
// Diagnostics never rename outbounds or install services.
func ManagedOutboundProvider(outbound map[string]any) string {
	provider := strings.ToLower(strings.TrimSpace(stringValue(outbound["rebecca_proxy"])))
	if provider == "tor" || provider == "windscribe" || provider == "psiphon" {
		return provider
	}
	tag := strings.ToLower(strings.TrimSpace(stringValue(outbound["tag"])))
	for _, provider := range []string{"tor", "windscribe", "psiphon"} {
		if tag == provider || strings.HasPrefix(tag, provider+"-") {
			return provider
		}
	}
	return ""
}

func managedOutboundError(outbound map[string]any, provider string) error {
	servers := listOfMaps(mapValue(outbound["settings"])["servers"])
	if strings.ToLower(stringValue(outbound["protocol"])) != "socks" || len(servers) == 0 {
		return fmt.Errorf("Outbound %q is classified as %s but uses protocol %q; the managed service requires a local SOCKS server", stringValue(outbound["tag"]), provider, stringValue(outbound["protocol"]))
	}
	server := servers[0]
	address := strings.Trim(strings.TrimSpace(stringValue(server["address"])), "[]")
	port, err := parseConfigPort(server["port"])
	if (address != "127.0.0.1" && address != "::1" && !strings.EqualFold(address, "localhost")) || err != nil || port < 1024 || port > 65535 {
		return fmt.Errorf("Managed %s outbound %q requires a loopback SOCKS address and port 1024–65535", provider, stringValue(outbound["tag"]))
	}
	if provider == "windscribe" {
		users := listOfMaps(server["users"])
		if len(users) == 0 || stringValue(users[0]["user"]) == "" || stringValue(users[0]["pass"]) == "" {
			return fmt.Errorf("Windscribe outbound %q is missing SOCKS proxy credentials; configure its account and proxy on the target node", stringValue(outbound["tag"]))
		}
	}
	return nil
}

func outboundIssues(target string, config map[string]any) []ConfigIssue {
	issues := []ConfigIssue{}
	ports, locations := map[int]string{}, map[string]string{}
	windscribe := ""
	for _, outbound := range listOfMaps(config["outbounds"]) {
		tag := stringValue(outbound["tag"])
		add := func(err error) {
			if err != nil {
				issues = append(issues, ConfigIssue{TargetID: target, ResourceType: "outbound", Resource: tag, Message: err.Error()})
			}
		}
		add(StreamCertificateError(outbound, time.Now()))
		provider := ManagedOutboundProvider(outbound)
		if provider == "" {
			continue
		}
		if err := managedOutboundError(outbound, provider); err != nil {
			add(err)
			continue
		}
		server := listOfMaps(mapValue(outbound["settings"])["servers"])[0]
		port, _ := parseConfigPort(server["port"])
		if previous := ports[port]; previous != "" {
			add(fmt.Errorf("managed outbounds %q and %q both use local SOCKS port %d", previous, tag, port))
		}
		ports[port] = tag
		if provider == "windscribe" {
			if windscribe != "" {
				add(fmt.Errorf("only one Windscribe account can run per node; outbounds %q and %q conflict", windscribe, tag))
			}
			windscribe = tag
		}
		location := strings.ToLower(strings.TrimSpace(stringValue(outbound["rebecca_proxy_location"])))
		if location == "" {
			parts := strings.Split(strings.ToLower(strings.TrimSpace(tag)), "-")
			if len(parts) > 1 && len(parts[len(parts)-1]) == 2 {
				location = parts[len(parts)-1]
			}
		}
		if location != "" {
			key := provider + ":" + location
			if previous := locations[key]; previous != "" {
				add(fmt.Errorf("managed %s location %q is used by both %q and %q", provider, location, previous, tag))
			}
			locations[key] = tag
		}
	}
	return issues
}

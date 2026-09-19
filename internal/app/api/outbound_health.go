package api

import "strings"

// managedOutboundProvider identifies the native proxy services supported by the
// node runtime. The tag fallback keeps older saved configs health-checkable.
func managedOutboundProvider(outbound map[string]any) string {
	provider := strings.ToLower(strings.TrimSpace(stringFromAny(outbound["rebecca_proxy"])))
	if provider == "tor" || provider == "windscribe" || provider == "psiphon" {
		return provider
	}
	tag := strings.ToLower(strings.TrimSpace(stringFromAny(outbound["tag"])))
	for _, candidate := range []string{"tor", "windscribe", "psiphon"} {
		if tag == candidate || strings.HasPrefix(tag, candidate+"-") {
			return candidate
		}
	}
	return ""
}

package api

import "github.com/rebeccapanel/rebecca/internal/app/xrayconfig"

// managedOutboundProvider identifies the native proxy services supported by the
// node runtime. The tag fallback keeps older saved configs health-checkable.
func managedOutboundProvider(outbound map[string]any) string {
	return xrayconfig.ManagedOutboundProvider(outbound)
}

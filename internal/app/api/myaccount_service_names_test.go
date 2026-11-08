package api

import (
	"testing"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
)

func TestServiceLimitSummaryUsesServiceNames(t *testing.T) {
	summary := serviceLimitSummary([]adminapp.AdminServiceLimit{{ServiceID: 7}}, map[int64]string{7: "Premium"})
	if summary[0]["service_name"] != "Premium" {
		t.Fatalf("service_name = %v", summary[0]["service_name"])
	}
}

package api

import (
	"reflect"
	"testing"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
)

func TestLiveAdminSpeedsSumsAdminScopesForViewer(t *testing.T) {
	serviceID := int64(3)
	s := &Server{liveUserSpeedTotals: map[liveUserSpeedScope]liveUserSpeedTotal{
		{AdminID: 7}: {Upload: 100, Download: 200},
		{AdminID: 7, ServiceID: serviceID, HasService: true}: {Upload: 10, Download: 20},
		{AdminID: 8}: {Upload: 5, Download: 5},
	}}

	sudo := adminPrincipal{Context: adminapp.EffectiveAdminContext{Admin: adminapp.Admin{Role: adminapp.RoleSudo}}}
	want := map[int64]liveAdminSpeed{
		7: {UploadSpeed: 110, DownloadSpeed: 220},
		8: {UploadSpeed: 5, DownloadSpeed: 5},
	}
	if got := s.liveAdminSpeedsFor(sudo); !reflect.DeepEqual(got, want) {
		t.Fatalf("sudo speeds = %+v, want %+v", got, want)
	}

	restricted := adminPrincipal{Context: adminapp.EffectiveAdminContext{Admin: adminapp.Admin{
		Role:                    adminapp.RoleStandard,
		UseServiceTrafficLimits: true,
		ServiceLimits: []adminapp.AdminServiceLimit{{
			ServiceID:        serviceID,
			TrafficLimitMode: adminapp.TrafficLimitCreatedTraffic,
			ShowUserTraffic:  false,
		}},
	}}}
	wantRestricted := map[int64]liveAdminSpeed{
		7: {UploadSpeed: 100, DownloadSpeed: 200},
		8: {UploadSpeed: 5, DownloadSpeed: 5},
	}
	if got := s.liveAdminSpeedsFor(restricted); !reflect.DeepEqual(got, wantRestricted) {
		t.Fatalf("restricted speeds = %+v, want %+v", got, wantRestricted)
	}
}

package api

import (
	"context"
	"net/http"
	"time"

	dashboardapp "github.com/rebeccapanel/rebecca/internal/app/dashboard"
	systemapp "github.com/rebeccapanel/rebecca/internal/app/system"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

func (s *Server) handleSystemStats(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/system" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	stats, err := s.systemStatsForRequest(ctx, r)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

func (s *Server) handleSystemDiagnostics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	issues, err := s.systemStatsService().Diagnostics(ctx)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	runtimeIssues, err := s.nodeController.RuntimeDiagnostics(ctx)
	if err != nil {
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "database", Resource: "Node health", Message: err.Error()})
	} else {
		issues = append(issues, runtimeIssues...)
	}
	haproxyIssues, err := s.nodeController.HAProxyDiagnostics(ctx)
	if err != nil {
		issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "haproxy", Resource: "HAProxy configuration", Message: err.Error()})
	} else {
		issues = append(issues, haproxyIssues...)
	}
	if s.certificateManager != nil {
		records, err := s.certificateManager.List(ctx)
		if err != nil {
			issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "certificate", Resource: "Managed certificates", Message: err.Error()})
		} else {
			for _, record := range records {
				if record.Status == "active" || record.Status == "revoked" || record.Status == "revoking" {
					continue
				}
				severity := "error"
				if record.Status == "expiring" {
					severity = "warning"
				}
				issues = append(issues, xrayconfig.ConfigIssue{TargetID: "master", ResourceType: "certificate", Resource: record.Domain, Severity: severity, Message: "Managed TLS certificate is " + record.Status + "; check certificate settings before it is used by subscriptions or a service"})
			}
		}
	}
	if s.externalApps != nil {
		appCtx, appCancel := context.WithTimeout(ctx, time.Second)
		issues = append(issues, s.externalApps.Diagnostics(appCtx)...)
		appCancel()
	}
	writeJSON(w, http.StatusOK, issues)
}

func (s *Server) systemStatsForRequest(ctx context.Context, r *http.Request) (systemapp.SystemStats, error) {
	stats, err := s.systemStatsService().Stats(ctx, dashboardAdminContext(r))
	if err != nil {
		return systemapp.SystemStats{}, err
	}
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	total := s.liveUserSpeedTotalFor(principal)
	stats.OnlineUsersUploadRate = total.Upload
	stats.OnlineUsersDownloadRate = total.Download
	return stats, nil
}

func (s *Server) systemStatsService() *systemapp.Service {
	if s.systemService == nil {
		s.systemService = systemapp.NewService(s.db, s.dialect, systemapp.DefaultVersion)
	}
	return s.systemService
}

func dashboardAdminContext(r *http.Request) dashboardapp.AdminContext {
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	adminID := principal.ID
	adminContext := dashboardapp.AdminContext{
		ID:             &adminID,
		Username:       principal.Username,
		Role:           principal.Role,
		CanViewTraffic: canViewUserTraffic(principal.Context.Admin, nil),
	}
	if adminID <= 0 {
		adminContext.ID = nil
	}
	return adminContext
}

package api

import (
	"errors"
	"net/http"

	adminapp "github.com/rebeccapanel/rebecca/internal/app/admin"
	settingsapp "github.com/rebeccapanel/rebecca/internal/app/settings"
)

type subscriptionPlaceholderUpdateRequest struct {
	AdminID        *int64 `json:"admin_id"`
	ServiceID      int64  `json:"service_id"`
	InheritDefault bool   `json:"inherit_default"`
	settingsapp.SubscriptionPlaceholderPolicy
}

func (s *Server) handleSubscriptionPlaceholders(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/settings/placeholders" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	principal, _ := r.Context().Value(adminContextKey).(adminPrincipal)
	manageAll := principal.Role == string(adminapp.RoleFullAccess) ||
		(principal.Role == string(adminapp.RoleSudo) && principal.Context.Admin.Permissions.Sudo.Subscriptions)
	if !manageAll && !hasSelfPermission(principal.Context.Admin, "self_placeholders") {
		writeError(w, http.StatusForbidden, "You're not allowed")
		return
	}

	switch r.Method {
	case http.MethodGet:
		var adminID *int64
		if !manageAll {
			adminID = &principal.ID
		}
		items, err := s.settingsRepo.SubscriptionPlaceholderSettings(r.Context(), adminID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": items, "manage_all": manageAll})
	case http.MethodPut:
		var payload subscriptionPlaceholderUpdateRequest
		if err := decodeOptionalJSON(r, &payload); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if payload.ServiceID <= 0 {
			writeError(w, http.StatusBadRequest, "service_id is required")
			return
		}
		if !manageAll && payload.AdminID != nil && *payload.AdminID != principal.ID {
			writeError(w, http.StatusForbidden, "You're not allowed")
			return
		}
		if payload.AdminID == nil && manageAll {
			item, err := s.settingsRepo.UpdateServiceSubscriptionPlaceholderSetting(r.Context(), payload.ServiceID, payload.SubscriptionPlaceholderPolicy)
			if errors.Is(err, settingsapp.ErrServiceNotFound) {
				writeError(w, http.StatusNotFound, "Service was not found")
				return
			}
			if err != nil {
				writeError(w, http.StatusBadRequest, err.Error())
				return
			}
			writeJSON(w, http.StatusOK, item)
			return
		}
		adminID := principal.ID
		if payload.AdminID != nil {
			adminID = *payload.AdminID
		}
		item, err := s.settingsRepo.UpdateSubscriptionPlaceholderSetting(
			r.Context(), adminID, payload.ServiceID, payload.SubscriptionPlaceholderPolicy, payload.InheritDefault,
		)
		if errors.Is(err, settingsapp.ErrAdminNotFound) {
			writeError(w, http.StatusNotFound, "Admin is not assigned to this service")
			return
		}
		if err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, item)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

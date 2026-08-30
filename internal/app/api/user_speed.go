package api

import (
	"context"
	"strings"

	"github.com/rebeccapanel/rebecca/internal/app/nodecontroller"
	userapp "github.com/rebeccapanel/rebecca/internal/app/user"
)

type liveUserSpeed struct {
	UploadSpeed   uint64 `json:"upload_speed"`
	DownloadSpeed uint64 `json:"download_speed"`
	AdminID       *int64 `json:"-"`
	ServiceID     *int64 `json:"-"`
}

type liveUserSpeedScope struct {
	AdminID    int64
	ServiceID  int64
	HasService bool
}

type liveUserSpeedTotal struct {
	Upload   uint64
	Download uint64
}

func (s *Server) setLiveUserSpeeds(speeds []nodecontroller.UserTrafficSpeed) {
	next := make(map[string]liveUserSpeed, len(speeds))
	totals := make(map[liveUserSpeedScope]liveUserSpeedTotal)
	var global liveUserSpeedTotal
	for _, speed := range speeds {
		if speed.Username == "" {
			continue
		}
		next[speed.Username] = liveUserSpeed{
			UploadSpeed:   speed.UploadSpeed,
			DownloadSpeed: speed.DownloadSpeed,
			AdminID:       speed.AdminID,
			ServiceID:     speed.ServiceID,
		}
		global.Upload += speed.UploadSpeed
		global.Download += speed.DownloadSpeed
		if speed.AdminID != nil {
			scope := liveUserSpeedScope{AdminID: *speed.AdminID}
			if speed.ServiceID != nil {
				scope.ServiceID = *speed.ServiceID
				scope.HasService = true
			}
			total := totals[scope]
			total.Upload += speed.UploadSpeed
			total.Download += speed.DownloadSpeed
			totals[scope] = total
		}
	}
	s.liveUserSpeedsMu.Lock()
	s.liveUserSpeeds = next
	s.liveUserSpeedTotals = totals
	s.liveUserGlobalSpeed = global
	s.liveUserSpeedsMu.Unlock()
}

func (s *Server) liveUserSpeedsSnapshot() map[string]liveUserSpeed {
	s.liveUserSpeedsMu.RLock()
	defer s.liveUserSpeedsMu.RUnlock()
	result := make(map[string]liveUserSpeed, len(s.liveUserSpeeds))
	for username, speed := range s.liveUserSpeeds {
		result[username] = speed
	}
	return result
}

func (s *Server) liveUserSpeedsFor(usernames []string) map[string]liveUserSpeed {
	s.liveUserSpeedsMu.RLock()
	defer s.liveUserSpeedsMu.RUnlock()
	result := make(map[string]liveUserSpeed, len(usernames))
	for _, username := range usernames {
		if speed, ok := s.liveUserSpeeds[username]; ok {
			result[username] = speed
		}
	}
	return result
}

func (s *Server) liveUserSpeedTotalFor(principal adminPrincipal) liveUserSpeedTotal {
	s.liveUserSpeedsMu.RLock()
	defer s.liveUserSpeedsMu.RUnlock()
	if principal.Context.Admin.Role.IsGlobal() {
		return s.liveUserGlobalSpeed
	}
	var result liveUserSpeedTotal
	for scope, total := range s.liveUserSpeedTotals {
		if scope.AdminID != principal.ID {
			continue
		}
		var serviceID *int64
		if scope.HasService {
			value := scope.ServiceID
			serviceID = &value
		}
		if !canViewUserTraffic(principal.Context.Admin, serviceID) {
			continue
		}
		result.Upload += total.Upload
		result.Download += total.Download
	}
	return result
}

func hasAdvancedUserFilter(filters []string, target string) bool {
	for _, filter := range filters {
		if strings.EqualFold(strings.TrimSpace(filter), target) {
			return true
		}
	}
	return false
}

func (s *Server) applyTopSpeedUserFilter(ctx context.Context, principal adminPrincipal, req userapp.UsersListRequest) (userapp.UsersListRequest, error) {
	filtered := req.AdvancedFilters[:0]
	for _, filter := range req.AdvancedFilters {
		if !strings.EqualFold(strings.TrimSpace(filter), "top_speed") {
			filtered = append(filtered, filter)
		}
	}
	req.AdvancedFilters = filtered
	onlineUsers, err := s.userService.OnlineUsernames(ctx, req)
	if err != nil {
		return req, err
	}
	online := make(map[string]struct{}, len(onlineUsers))
	for _, username := range onlineUsers {
		online[username] = struct{}{}
	}
	bestUsername := ""
	var bestSpeed uint64
	for username, speed := range s.liveUserSpeedsSnapshot() {
		if _, ok := online[username]; !ok || !canViewUserTraffic(principal.Context.Admin, speed.ServiceID) {
			continue
		}
		total := speed.UploadSpeed + speed.DownloadSpeed
		if total > bestSpeed || (total == bestSpeed && total > 0 && (bestUsername == "" || username < bestUsername)) {
			bestUsername = username
			bestSpeed = total
		}
	}
	if bestUsername == "" {
		bestUsername = "__rebecca_no_top_speed_user__"
	}
	req.Usernames = []string{bestUsername}
	return req, nil
}

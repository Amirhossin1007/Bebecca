package api

import "github.com/rebeccapanel/rebecca/internal/app/nodecontroller"

type liveUserSpeed struct {
	UploadSpeed   uint64 `json:"upload_speed"`
	DownloadSpeed uint64 `json:"download_speed"`
	ServiceID     *int64 `json:"-"`
}

func (s *Server) setLiveUserSpeeds(speeds []nodecontroller.UserTrafficSpeed) {
	next := make(map[string]liveUserSpeed, len(speeds))
	for _, speed := range speeds {
		if speed.Username == "" {
			continue
		}
		next[speed.Username] = liveUserSpeed{
			UploadSpeed:   speed.UploadSpeed,
			DownloadSpeed: speed.DownloadSpeed,
			ServiceID:     speed.ServiceID,
		}
	}
	s.liveUserSpeedsMu.Lock()
	s.liveUserSpeeds = next
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

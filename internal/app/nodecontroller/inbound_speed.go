package nodecontroller

import (
	"sync"
	"time"
)

const inboundSpeedStaleAfter = 30 * time.Second

type InboundSpeed struct {
	UploadSpeed   uint64 `json:"upload_speed"`
	DownloadSpeed uint64 `json:"download_speed"`
}

type nodeInboundSpeeds struct {
	at     time.Time
	speeds map[string]InboundSpeed
}

type inboundSpeedTracker struct {
	mu      sync.Mutex
	ackedAt map[int64]time.Time
	nodes   map[int64]nodeInboundSpeeds
}

func newInboundSpeedTracker() *inboundSpeedTracker {
	return &inboundSpeedTracker{
		ackedAt: map[int64]time.Time{},
		nodes:   map[int64]nodeInboundSpeeds{},
	}
}

func (t *inboundSpeedTracker) record(nodeID int64, pulledAt time.Time, deltas []InboundUsageDelta) {
	if t == nil || nodeID <= 0 {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	previous, seen := t.ackedAt[nodeID]
	t.ackedAt[nodeID] = pulledAt
	if !seen || !pulledAt.After(previous) {
		return
	}
	seconds := pulledAt.Sub(previous).Seconds()
	speeds := make(map[string]InboundSpeed, len(deltas))
	for _, delta := range deltas {
		item := speeds[delta.Tag]
		if delta.Up > 0 {
			item.UploadSpeed += uint64(float64(delta.Up) / seconds)
		}
		if delta.Down > 0 {
			item.DownloadSpeed += uint64(float64(delta.Down) / seconds)
		}
		speeds[delta.Tag] = item
	}
	t.nodes[nodeID] = nodeInboundSpeeds{at: pulledAt, speeds: speeds}
}

func (t *inboundSpeedTracker) snapshot(now time.Time) map[string]InboundSpeed {
	result := map[string]InboundSpeed{}
	if t == nil {
		return result
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	for _, node := range t.nodes {
		if now.Sub(node.at) > inboundSpeedStaleAfter {
			continue
		}
		for tag, speed := range node.speeds {
			item := result[tag]
			item.UploadSpeed += speed.UploadSpeed
			item.DownloadSpeed += speed.DownloadSpeed
			result[tag] = item
		}
	}
	return result
}

func (c Controller) InboundSpeeds(now time.Time) map[string]InboundSpeed {
	return c.inboundSpeeds.snapshot(now)
}

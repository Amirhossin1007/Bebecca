package nodecontroller

import (
	"testing"
	"time"
)

func TestInboundSpeedTrackerDerivesRatesFromAckedWindows(t *testing.T) {
	tracker := newInboundSpeedTracker()
	start := time.Unix(1_700_000_000, 0)
	tracker.record(1, start, []InboundUsageDelta{{Tag: "vless", Up: 500, Down: 1000}})
	if got := tracker.snapshot(start); len(got) != 0 {
		t.Fatalf("first window must not report a rate, got %v", got)
	}
	tracker.record(1, start.Add(5*time.Second), []InboundUsageDelta{{Tag: "vless", Up: 500, Down: 1000}})
	if got := tracker.snapshot(start.Add(5 * time.Second))["vless"]; got.UploadSpeed != 100 || got.DownloadSpeed != 200 {
		t.Fatalf("speed = %+v, want upload 100 and download 200 bytes/s", got)
	}
	tracker.record(1, start.Add(10*time.Second), nil)
	if got := tracker.snapshot(start.Add(10 * time.Second)); len(got) != 0 {
		t.Fatalf("idle window must clear the rate, got %v", got)
	}
}

func TestInboundSpeedTrackerSumsNodesAndDropsStaleOnes(t *testing.T) {
	tracker := newInboundSpeedTracker()
	start := time.Unix(1_700_000_000, 0)
	for _, nodeID := range []int64{1, 2} {
		tracker.record(nodeID, start, nil)
		tracker.record(nodeID, start.Add(10*time.Second), []InboundUsageDelta{{Tag: "vless", Up: 100, Down: 200}})
	}
	at := start.Add(10 * time.Second)
	if got := tracker.snapshot(at)["vless"]; got.UploadSpeed != 20 || got.DownloadSpeed != 40 {
		t.Fatalf("summed speed = %+v, want 20 and 40", got)
	}
	if got := tracker.snapshot(at.Add(inboundSpeedStaleAfter + time.Second)); len(got) != 0 {
		t.Fatalf("stale nodes must be ignored, got %v", got)
	}
}

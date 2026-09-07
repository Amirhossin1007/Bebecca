package nodecontroller

import (
	"errors"
	"reflect"
	"testing"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func TestNodeGRPCPortCandidatesPreferControlPortWithLegacyFallback(t *testing.T) {
	got := NodeGRPCPortCandidates(62033, 62034)
	want := []int{62033, 62035}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected candidates: got %v want %v", got, want)
	}
}

func TestNodeGRPCPortCandidatesFallbackToServicePortWithoutAPIPort(t *testing.T) {
	got := NodeGRPCPortCandidates(62033, 0)
	want := []int{62033}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("unexpected candidates: got %v want %v", got, want)
	}
}

func TestOperationRevisionUsesStableQueueID(t *testing.T) {
	if got := operationRevision("sync_config-1842"); got != 1842 {
		t.Fatalf("unexpected revision: %d", got)
	}
}

func TestMissingNodeCLIIsPermanentOperationError(t *testing.T) {
	err := errors.New("Node error during update service: unable to locate rebecca-node CLI on this host")
	if !isPermanentOperationError(err) {
		t.Fatal("a missing node CLI cannot be fixed by retrying the same update")
	}
}

func TestRuntimeResultMapsProtocolAndXrayMetrics(t *testing.T) {
	result := runtimeResult(NodeRow{ID: 7, Name: "de-1"}, &nodev1.RuntimeState{
		ProtocolStatuses: []*nodev1.ProtocolStatus{{Protocol: "wireguard", State: "running", Inbounds: 2}},
	}, &nodev1.MetricsResponse{Xray: &nodev1.XrayMetrics{
		Pid: 42, CpuUsagePercent: 3.5, MemoryUsed: 1024, UptimeSeconds: 60,
	}})
	if len(result.ProtocolStatuses) != 1 || result.ProtocolStatuses[0].Protocol != "wireguard" || result.ProtocolStatuses[0].Inbounds != 2 {
		t.Fatalf("protocol statuses were not mapped: %#v", result.ProtocolStatuses)
	}
	if result.XrayMetrics.PID != 42 || result.XrayMetrics.CPUPercent != 3.5 || result.XrayMetrics.MemoryUsed != 1024 || result.XrayMetrics.UptimeSeconds != 60 {
		t.Fatalf("xray metrics were not mapped: %#v", result.XrayMetrics)
	}
}

package system

import "testing"

func TestAppendHistoryIncludesUsageMetrics(t *testing.T) {
	service := &Service{}
	history := service.appendHistory(MetricsSnapshot{
		Timestamp: 123,
		CPUUsage:  11,
		Memory:    UsageStats{Percent: 22},
		Swap:      UsageStats{Percent: 33},
		Disk:      UsageStats{Percent: 44},
	})

	for name, metric := range map[string]struct {
		entries []HistoryEntry
		value   float64
	}{
		"cpu": {history.cpu, 11}, "memory": {history.memory, 22},
		"swap": {history.swap, 33}, "disk": {history.disk, 44},
	} {
		if len(metric.entries) != 1 || metric.entries[0] != (HistoryEntry{Timestamp: 123, Value: metric.value}) {
			t.Fatalf("%s history = %#v", name, metric.entries)
		}
	}
}

func TestAppendHistorySamplesAtFixedIntervals(t *testing.T) {
	service := &Service{}
	service.appendHistory(MetricsSnapshot{Timestamp: 100, CPUUsage: 10})
	history := service.appendHistory(MetricsSnapshot{Timestamp: 105, CPUUsage: 20})
	if len(history.cpu) != 1 || history.cpu[0] != (HistoryEntry{Timestamp: 100, Value: 20}) {
		t.Fatalf("history inside sample window = %#v", history.cpu)
	}

	history = service.appendHistory(MetricsSnapshot{Timestamp: 130, CPUUsage: 30})
	if len(history.cpu) != 2 || history.cpu[1] != (HistoryEntry{Timestamp: 130, Value: 30}) {
		t.Fatalf("history after sample window = %#v", history.cpu)
	}
}

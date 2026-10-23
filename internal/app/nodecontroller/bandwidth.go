package nodecontroller

import (
	"context"
	"sync"
	"time"
)

const nodeBandwidthMetricsTimeout = 2 * time.Second

func (c Controller) NodeBandwidthSpeeds(ctx context.Context, maxAge time.Duration) (int64, int64, error) {
	rows, _, _, err := c.repo.ListNodeItems(ctx, 0)
	if err != nil {
		return 0, 0, err
	}
	results := make(chan NetInfo, len(rows))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 8)
	for idx := range rows {
		if skipNodeMetrics(&rows[idx]) {
			continue
		}
		wg.Add(1)
		go func(nodeID int64) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			metricsCtx, cancel := context.WithTimeout(ctx, nodeBandwidthMetricsTimeout)
			defer cancel()
			runtime, err := c.cachedMetrics(metricsCtx, Request{NodeID: nodeID, MetricsMaxAge: maxAge})
			if err != nil {
				return
			}
			results <- runtime.Transfer
		}(rows[idx].ID)
	}
	go func() {
		wg.Wait()
		close(results)
	}()
	var samples []NetInfo
	for transfer := range results {
		samples = append(samples, transfer)
	}
	incoming, outgoing := sumNodeBandwidth(samples)
	return incoming, outgoing, nil
}

func sumNodeBandwidth(samples []NetInfo) (int64, int64) {
	var incoming, outgoing int64
	for _, sample := range samples {
		incoming += int64(sample.DownloadSpeed)
		outgoing += int64(sample.UploadSpeed)
	}
	return incoming, outgoing
}

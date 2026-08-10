package api

import (
	"context"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/logging"
	"github.com/rebeccapanel/rebecca/internal/app/nodecontroller"
)

const defaultNodeRecoveryPollInterval = 45 * time.Second
const defaultNodeRecoveryBatchSize = 25

func (s *Server) runNodeRecoveryWorker(ctx context.Context) {
	logging.Infof(logging.ComponentNode, "recovery worker started interval=%s batch=%d", defaultNodeRecoveryPollInterval, defaultNodeRecoveryBatchSize)
	ticker := time.NewTicker(defaultNodeRecoveryPollInterval)
	defer ticker.Stop()
	healthRunning := make(chan struct{}, 1)
	recoveryRunning := make(chan struct{}, 1)
	start := func(guard chan struct{}, task func(context.Context)) {
		select {
		case guard <- struct{}{}:
			go func() {
				defer func() { <-guard }()
				task(ctx)
			}()
		default:
		}
	}
	run := func() {
		start(healthRunning, s.checkConnectedNodeHealth)
		start(recoveryRunning, s.recoverStaleNodes)
	}
	run()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			run()
		}
	}
}

func (s *Server) checkConnectedNodeHealth(ctx context.Context) {
	health, err := s.nodeController.CheckConnectedNodes(ctx)
	if err != nil {
		if ctx.Err() != nil {
			return
		}
		logging.Warnf(logging.ComponentNode, "node health sweep failed: %v", err)
	} else if len(health.Errors) > 0 {
		logging.Infof(logging.ComponentNode, "node health sweep checked=%d unavailable=%d", health.Checked, len(health.Errors))
	}
}

func (s *Server) recoverStaleNodes(ctx context.Context) {
	workerCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	result, err := s.nodeController.RecoverNodes(workerCtx, nodecontroller.RecoverNodesRequest{Limit: defaultNodeRecoveryBatchSize})
	if err != nil {
		if ctx.Err() != nil {
			logging.Debugf(logging.ComponentNode, "recovery worker stopped: %v", err)
			return
		}
		logging.Warnf(logging.ComponentNode, "recovery worker failed: %v", err)
		return
	}
	if result.Recovered > 0 {
		logging.Infof(logging.ComponentNode, "recovered stale nodes checked=%d recovered=%d", result.Checked, result.Recovered)
	}
	if len(result.Errors) > 0 {
		logging.Debugf(logging.ComponentNode, "stale node recovery skipped=%d", len(result.Errors))
	}
}

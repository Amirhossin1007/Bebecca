package nodecontroller

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"sync"
	"testing"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/nodeclient"
	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type legacyUsageServer struct {
	nodev1.UnimplementedNodeUsageServiceServer
}

func (legacyUsageServer) CollectUserUsage(context.Context, *nodev1.CollectUsageRequest) (*nodev1.UserUsageBatch, error) {
	return &nodev1.UserUsageBatch{BatchId: "user-batch"}, nil
}

func (legacyUsageServer) CollectOutboundUsage(context.Context, *nodev1.CollectUsageRequest) (*nodev1.OutboundUsageBatch, error) {
	return &nodev1.OutboundUsageBatch{BatchId: "outbound-batch"}, nil
}

type bundleUsageServer struct {
	nodev1.UnimplementedNodeUsageServiceServer
	outboundError string
	mu            sync.Mutex
	request       *nodev1.CollectAllUsageRequest
	ackRequest    *nodev1.AckAllUsageRequest
}

func (s *bundleUsageServer) AckAllUsage(_ context.Context, req *nodev1.AckAllUsageRequest) (*nodev1.AckAllUsageResponse, error) {
	s.mu.Lock()
	s.ackRequest = req
	s.mu.Unlock()
	return &nodev1.AckAllUsageResponse{
		UsersAcknowledged:    req.GetUserBatchId() == "user-batch",
		OutboundAcknowledged: req.GetOutboundBatchId() == "outbound-batch",
	}, nil
}

func (s *bundleUsageServer) CollectAllUsage(_ context.Context, req *nodev1.CollectAllUsageRequest) (*nodev1.CollectAllUsageResponse, error) {
	s.mu.Lock()
	s.request = req
	s.mu.Unlock()
	res := &nodev1.CollectAllUsageResponse{}
	if !req.GetSkipUsers() {
		res.Users = &nodev1.UserUsageBatch{BatchId: "user-batch"}
	}
	if !req.GetSkipOutbound() {
		if s.outboundError != "" {
			res.OutboundError = s.outboundError
		} else {
			res.Outbound = &nodev1.OutboundUsageBatch{BatchId: "outbound-batch"}
		}
	}
	return res, nil
}

func startUsageTestNode(t *testing.T, server nodev1.NodeUsageServiceServer, capabilities ...string) *nodeclient.Client {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	grpcServer := grpc.NewServer()
	nodev1.RegisterNodeUsageServiceServer(grpcServer, server)
	go func() { _ = grpcServer.Serve(listener) }()
	t.Cleanup(grpcServer.Stop)

	client, err := nodeclient.Dial(context.Background(), listener.Addr().String(), &tls.Config{}, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = client.Close() })
	client.SetHandshake("test", capabilities)
	return client
}

func TestFetchUsageBatchesFallsBackToSeparateRPCsForNodesWithoutBundle(t *testing.T) {
	client := startUsageTestNode(t, legacyUsageServer{}, nodeclient.CapabilityUsageBundle)
	batches := fetchUsageBatches(context.Background(), client, usageBatchRequest{collectUsers: true, collectOutbound: true})
	if batches.bundled {
		t.Fatal("node answered Unimplemented for the bundle; the separate RPCs must be used")
	}
	if batches.userErr != nil || batches.outboundErr != nil {
		t.Fatalf("unexpected errors user=%v outbound=%v", batches.userErr, batches.outboundErr)
	}
	if batches.user.GetBatchId() != "user-batch" || batches.outbound.GetBatchId() != "outbound-batch" {
		t.Fatalf("batches user=%q outbound=%q", batches.user.GetBatchId(), batches.outbound.GetBatchId())
	}
}

func TestFetchUsageBatchesUsesBundleWhenNodeAdvertisesIt(t *testing.T) {
	server := &bundleUsageServer{}
	client := startUsageTestNode(t, server, nodeclient.CapabilityUsageBundle)
	batches := fetchUsageBatches(context.Background(), client, usageBatchRequest{collectUsers: true, collectOutbound: true})
	if !batches.bundled {
		t.Fatal("node advertises usage_bundle; the combined RPC must be used")
	}
	if batches.user.GetBatchId() != "user-batch" || batches.outbound.GetBatchId() != "outbound-batch" {
		t.Fatalf("batches user=%q outbound=%q", batches.user.GetBatchId(), batches.outbound.GetBatchId())
	}
}

func TestFetchUsageBatchesKeepsOutboundFailureSeparate(t *testing.T) {
	server := &bundleUsageServer{outboundError: "xray stats unavailable"}
	client := startUsageTestNode(t, server, nodeclient.CapabilityUsageBundle)
	batches := fetchUsageBatches(context.Background(), client, usageBatchRequest{collectUsers: true, collectOutbound: true})
	if batches.userErr != nil {
		t.Fatalf("user batch must not fail with the outbound error: %v", batches.userErr)
	}
	if batches.user.GetBatchId() != "user-batch" {
		t.Fatalf("user batch id = %q", batches.user.GetBatchId())
	}
	if batches.outboundErr == nil || batches.outboundErr.Error() != "xray stats unavailable" {
		t.Fatalf("outbound error = %v", batches.outboundErr)
	}
}

func TestFetchUsageBatchesSendsSkipFlagsForDisabledSides(t *testing.T) {
	server := &bundleUsageServer{}
	client := startUsageTestNode(t, server, nodeclient.CapabilityUsageBundle)
	batches := fetchUsageBatches(context.Background(), client, usageBatchRequest{collectUsers: true, collectOutbound: false})
	if batches.user.GetBatchId() != "user-batch" || batches.outbound != nil {
		t.Fatalf("users only: user=%v outbound=%v", batches.user, batches.outbound)
	}
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.request == nil || !server.request.GetSkipOutbound() || server.request.GetSkipUsers() {
		t.Fatalf("skip flags not sent correctly: %v", server.request)
	}
}

func TestCachedNodeMetricsFetchesOncePerWindow(t *testing.T) {
	c := Controller{metricsCache: &sync.Map{}}
	fetches := 0
	fetch := func(context.Context, Request) (RuntimeResult, error) {
		fetches++
		return RuntimeResult{Message: "ok"}, nil
	}
	req := Request{NodeID: 7, MetricsMaxAge: time.Hour}
	for range 3 {
		result, err := c.cachedNodeMetrics(context.Background(), req, fetch)
		if err != nil || result.Message != "ok" {
			t.Fatalf("result=%v err=%v", result, err)
		}
	}
	if fetches != 1 {
		t.Fatalf("fetches=%d want 1 within the window", fetches)
	}
}

func TestCachedNodeMetricsRefetchesAfterWindow(t *testing.T) {
	c := Controller{metricsCache: &sync.Map{}}
	fetches := 0
	fetch := func(context.Context, Request) (RuntimeResult, error) {
		fetches++
		return RuntimeResult{}, nil
	}
	req := Request{NodeID: 7, MetricsMaxAge: time.Nanosecond}
	for range 2 {
		time.Sleep(time.Millisecond)
		if _, err := c.cachedNodeMetrics(context.Background(), req, fetch); err != nil {
			t.Fatal(err)
		}
	}
	if fetches != 2 {
		t.Fatalf("fetches=%d want 2 after the window expired", fetches)
	}
}

func TestCachedNodeMetricsCachesNodeErrorsWithinWindow(t *testing.T) {
	c := Controller{metricsCache: &sync.Map{}}
	fetches := 0
	nodeDown := errors.New("node unreachable")
	fetch := func(context.Context, Request) (RuntimeResult, error) {
		fetches++
		return RuntimeResult{}, nodeDown
	}
	req := Request{NodeID: 7, MetricsMaxAge: time.Hour}
	for range 2 {
		if _, err := c.cachedNodeMetrics(context.Background(), req, fetch); !errors.Is(err, nodeDown) {
			t.Fatalf("err=%v", err)
		}
	}
	if fetches != 1 {
		t.Fatalf("fetches=%d want 1: a down node must not be re-dialed by every dashboard", fetches)
	}
}

func TestCachedNodeMetricsDoesNotCacheCancelledFetch(t *testing.T) {
	c := Controller{metricsCache: &sync.Map{}}
	fetches := 0
	fetch := func(ctx context.Context, _ Request) (RuntimeResult, error) {
		fetches++
		if ctx.Err() != nil {
			return RuntimeResult{}, ctx.Err()
		}
		return RuntimeResult{Message: "ok"}, nil
	}
	req := Request{NodeID: 7, MetricsMaxAge: time.Hour}
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.cachedNodeMetrics(cancelled, req, fetch); err == nil {
		t.Fatal("cancelled fetch must return its error")
	}
	result, err := c.cachedNodeMetrics(context.Background(), req, fetch)
	if err != nil || result.Message != "ok" {
		t.Fatalf("a live caller must not inherit a cancelled fetch: result=%v err=%v", result, err)
	}
	if fetches != 2 {
		t.Fatalf("fetches=%d want 2", fetches)
	}
}

func TestAckBundledUsageCountsAcknowledgedBatches(t *testing.T) {
	server := &bundleUsageServer{}
	client := startUsageTestNode(t, server, nodeclient.CapabilityUsageBundle)
	result := CollectUsageResult{}
	ackBundledUsage(context.Background(), client, 1, "user-batch", "outbound-batch", &result)
	if result.UserAcked != 1 || result.OutboundAcked != 1 || len(result.Errors) != 0 {
		t.Fatalf("result=%+v", result)
	}
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.ackRequest.GetUserBatchId() != "user-batch" || server.ackRequest.GetOutboundBatchId() != "outbound-batch" {
		t.Fatalf("ack request=%v", server.ackRequest)
	}
}

func TestAckBundledUsageSkipsRPCWhenNothingWasCollected(t *testing.T) {
	server := &bundleUsageServer{}
	client := startUsageTestNode(t, server, nodeclient.CapabilityUsageBundle)
	result := CollectUsageResult{}
	ackBundledUsage(context.Background(), client, 1, "", "", &result)
	if result.UserAcked != 0 || result.OutboundAcked != 0 || len(result.Errors) != 0 {
		t.Fatalf("result=%+v", result)
	}
	server.mu.Lock()
	defer server.mu.Unlock()
	if server.ackRequest != nil {
		t.Fatalf("ack must not be sent without batches: %v", server.ackRequest)
	}
}

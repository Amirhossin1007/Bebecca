package nodeclient

import (
	"testing"
	"time"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func TestClientHandshakeIsDueOnlyAfterInterval(t *testing.T) {
	client := &Client{}
	client.SetHandshake("1.7.1", []string{"ip_scope_lookup"})
	if client.HandshakeDue(time.Minute) {
		t.Fatal("fresh handshake must not be due")
	}

	client.handshakeAt = time.Now().Add(-2 * time.Minute)
	if !client.HandshakeDue(time.Minute) {
		t.Fatal("handshake older than the interval must be due")
	}

	client.DeferHandshake()
	if client.HandshakeDue(time.Minute) {
		t.Fatal("deferred handshake must not be due again before the interval")
	}
}

func TestClientRequestOptionsCompressOnlyLargeRequestsToCapableNodes(t *testing.T) {
	large := &nodev1.CollectAllUsageRequest{IpScope: &nodev1.IPLookupScope{Uids: make([]string, 1000)}}
	for index := range large.IpScope.Uids {
		large.IpScope.Uids[index] = "123456789"
	}
	small := &nodev1.CollectAllUsageRequest{CollectorId: "master"}

	legacy := &Client{}
	if opts := legacy.RequestOptions(large); len(opts) != 0 {
		t.Fatalf("node without grpc_gzip must receive uncompressed requests, got %d options", len(opts))
	}

	current := &Client{}
	current.SetHandshake("1.6.2", []string{CapabilityGzipRequests})
	if opts := current.RequestOptions(small); len(opts) != 0 {
		t.Fatalf("requests below %d bytes must not be compressed, got %d options", compressRequestsAboveBytes, len(opts))
	}
	if opts := current.RequestOptions(large); len(opts) != 1 {
		t.Fatalf("large request to a node with grpc_gzip must get the gzip option, got %d options", len(opts))
	}
}

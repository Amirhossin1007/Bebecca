package nodecontroller

import (
	"database/sql"
	"errors"
	"testing"

	userread "github.com/rebeccapanel/rebecca/internal/app/user"
	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func TestShadowsocks2022LiveUserPayloadCarriesInboundMethod(t *testing.T) {
	inbound := map[string]any{"tag": "ss", "protocol": "shadowsocks", "settings": map[string]any{"method": "2022-blake3-aes-256-gcm"}}
	settings, err := userread.RuntimeProxySettingsForInbound(map[string]any{"password": "secret", "method": "chacha20-ietf-poly1305"}, inbound, "", "", nil)
	if err != nil {
		t.Fatal(err)
	}
	payload := grpcInboundUserPayload(userread.RuntimeShadowsocksLiveSettings(settings, ensureMap(inbound, "settings")))
	if payload.GetFields()["method"] != "2022-blake3-aes-256-gcm" {
		t.Fatalf("live payload method = %q, want the inbound 2022 method", payload.GetFields()["method"])
	}
}

func plannedGroup(items int, planErr error) plannedRuntimeUserGroup {
	planned := plannedRuntimeUserGroup{planErr: planErr}
	for index := 0; index < items; index++ {
		planned.items = append(planned.items, &nodev1.UserBatchOperation{InboundTag: "in"})
	}
	return planned
}

func TestSplitRuntimeUserBatchChunksKeepsGroupsWhole(t *testing.T) {
	planned := []plannedRuntimeUserGroup{plannedGroup(600, nil), plannedGroup(600, nil), plannedGroup(300, nil)}
	chunks := splitRuntimeUserBatchChunks(planned, 1000)
	if len(chunks) != 2 || len(chunks[0]) != 1 || len(chunks[1]) != 2 {
		t.Fatalf("unexpected chunk layout: %d chunks", len(chunks))
	}
	oversized := splitRuntimeUserBatchChunks([]plannedRuntimeUserGroup{plannedGroup(1500, nil)}, 1000)
	if len(oversized) != 1 || len(oversized[0]) != 1 {
		t.Fatalf("a single group larger than the limit must still be sent as one unit")
	}
}

func TestRuntimeUserBatchOutcomesMapResultsPerGroup(t *testing.T) {
	planErr := errors.New("no matching inbound")
	chunk := []plannedRuntimeUserGroup{
		plannedGroup(2, nil),
		plannedGroup(2, nil),
		plannedGroup(1, planErr),
		plannedGroup(0, nil),
	}
	results := []*nodev1.UserBatchResult{
		{Ok: true}, {Ok: true},
		{Ok: true}, {Ok: false, Error: "xray rejected user"},
		{Ok: true},
	}
	outcomes := runtimeUserBatchOutcomes(chunk, results, nil)
	if outcomes[0] != nil {
		t.Fatalf("fully applied group reported failure: %v", outcomes[0])
	}
	if outcomes[1] == nil || outcomes[1].Error() != "xray rejected user" {
		t.Fatalf("second group should carry its item failure, got %v", outcomes[1])
	}
	if !errors.Is(outcomes[2], planErr) {
		t.Fatalf("planning error must fail its group even when its good items were sent, got %v", outcomes[2])
	}
	if outcomes[3] != nil {
		t.Fatalf("group without operations must succeed, got %v", outcomes[3])
	}
}

func TestRuntimeUserBatchOutcomesReportTransportFailure(t *testing.T) {
	transport := errors.New("node unreachable")
	chunk := []plannedRuntimeUserGroup{plannedGroup(1, nil), plannedGroup(0, nil)}
	outcomes := runtimeUserBatchOutcomes(chunk, nil, transport)
	if !errors.Is(outcomes[0], transport) {
		t.Fatalf("group with operations must fail with the transport error: %v", outcomes[0])
	}
	if outcomes[1] != nil {
		t.Fatalf("group without operations must not fail on transport: %v", outcomes[1])
	}
}

func TestBuildRuntimeUserUpsertsEmitsOneUpsertPerMatchedInbound(t *testing.T) {
	users := []runtimeUserRow{{
		ID:            42,
		Username:      "user",
		CredentialKey: "0123456789abcdef0123456789abcdef",
		ServiceID:     sql.NullInt64{Int64: 10, Valid: true},
		Protocol:      "trojan",
		Settings:      map[string]any{},
	}}
	raw := map[string]any{"inbounds": []any{
		map[string]any{"tag": "trojan-in", "protocol": "trojan", "settings": map[string]any{}},
		map[string]any{"tag": "trojan-other", "protocol": "trojan", "settings": map[string]any{}},
		map[string]any{"tag": "vless-in", "protocol": "vless", "settings": map[string]any{}},
	}}
	serviceTags := map[int64]map[string]bool{10: {"trojan-in": true, "vless-in": true}}
	items, err := buildRuntimeUserUpserts(users, 7, 42, "42.user", raw, serviceTags, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one upsert for the single matching trojan service inbound, got %d", len(items))
	}
	if items[0].GetAction() != nodev1.UserBatchAction_USER_BATCH_ACTION_UPSERT || items[0].GetInboundTag() != "trojan-in" {
		t.Fatalf("unexpected upsert: %#v", items[0])
	}
	if items[0].GetUser().GetEmail() != taggedRuntimeUserEmail("42.user", "trojan-in") {
		t.Fatalf("upsert email = %q", items[0].GetUser().GetEmail())
	}
}

func TestBuildRuntimeUserUpsertsWithoutServiceIsNoOp(t *testing.T) {
	users := []runtimeUserRow{{ID: 42, Protocol: "trojan", Settings: map[string]any{}}}
	raw := map[string]any{"inbounds": []any{map[string]any{"tag": "trojan-in", "protocol": "trojan", "settings": map[string]any{}}}}
	items, err := buildRuntimeUserUpserts(users, 7, 42, "42.user", raw, nil, nil)
	if err != nil || len(items) != 0 {
		t.Fatalf("user without service must be a no-op, items=%d err=%v", len(items), err)
	}
}

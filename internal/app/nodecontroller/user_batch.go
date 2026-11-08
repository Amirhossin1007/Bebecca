package nodecontroller

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/nodeclient"
	userread "github.com/rebeccapanel/rebecca/internal/app/user"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
)

const (
	maxUserBatchItems      = 200
	runtimeUserNodeTimeout = 90 * time.Second
	operationResultTimeout = 30 * time.Second
)

type runtimeUserGroup struct {
	userID int64
	ops    []OperationRow
}

type plannedRuntimeUserGroup struct {
	group   runtimeUserGroup
	items   []*nodev1.UserBatchOperation
	planErr error
}

func (c Controller) ProcessRuntimeUserOperationsForUsers(ctx context.Context, userIDs []int64, limit int) (ProcessOperationsResult, error) {
	operations, err := c.repo.PendingRuntimeUserOperationsForUsers(ctx, userIDs, limit)
	if err != nil {
		return ProcessOperationsResult{}, err
	}
	return c.applyRuntimeUserOperationBatch(ctx, operations)
}

func (c Controller) ProcessRuntimeUserQueue(ctx context.Context, limit int) (ProcessOperationsResult, error) {
	operations, err := c.repo.PendingRuntimeUserOperationsAll(ctx, limit)
	if err != nil {
		return ProcessOperationsResult{}, err
	}
	return c.applyRuntimeUserOperationBatch(ctx, operations)
}

func (c Controller) applyRuntimeUserOperationBatch(ctx context.Context, operations []OperationRow) (ProcessOperationsResult, error) {
	result := ProcessOperationsResult{}
	byNode := map[int64]map[int64][]OperationRow{}
	for _, operation := range operations {
		if !operation.NodeID.Valid || !operation.UserID.Valid || !xrayconfig.IsRuntimeUserNodeOperationType(operation.OperationType) {
			continue
		}
		users := byNode[operation.NodeID.Int64]
		if users == nil {
			users = map[int64][]OperationRow{}
			byNode[operation.NodeID.Int64] = users
		}
		users[operation.UserID.Int64] = append(users[operation.UserID.Int64], operation)
	}
	nodeIDs := make([]int64, 0, len(byNode))
	for nodeID := range byNode {
		nodeIDs = append(nodeIDs, nodeID)
	}
	sort.Slice(nodeIDs, func(i, j int) bool { return nodeIDs[i] < nodeIDs[j] })
	outcomes := make([]ProcessOperationsResult, len(nodeIDs))
	errs := make([]error, len(nodeIDs))
	slots := make(chan struct{}, maxConcurrentRuntimeUserOperations)
	var group sync.WaitGroup
	for index, nodeID := range nodeIDs {
		group.Add(1)
		go func(index int, nodeID int64) {
			defer group.Done()
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				errs[index] = ctx.Err()
				return
			}
			defer func() { <-slots }()
			nodeCtx, cancel := context.WithTimeout(ctx, runtimeUserNodeTimeout)
			defer cancel()
			errs[index] = c.applyRuntimeUserBatchToNode(nodeCtx, nodeID, byNode[nodeID], &outcomes[index])
		}(index, nodeID)
	}
	group.Wait()
	for index := range nodeIDs {
		result.Processed += outcomes[index].Processed
		result.Done += outcomes[index].Done
		result.Retrying += outcomes[index].Retrying
		result.Failed += outcomes[index].Failed
		if errs[index] != nil {
			return result, errs[index]
		}
	}
	return result, nil
}

// applyRuntimeUserBatchToNode sends every pending user change of one node in
// as few gRPC calls as possible. Per user, only the latest pending operation is
// sent, because the database state is authoritative and earlier operations for
// the same user are superseded.
func (c Controller) applyRuntimeUserBatchToNode(ctx context.Context, nodeID int64, users map[int64][]OperationRow, result *ProcessOperationsResult) error {
	unlock, err := c.lockNodeContext(ctx, nodeID)
	if err != nil {
		return err
	}
	groups := make([]runtimeUserGroup, 0, len(users))
	for userID, operations := range users {
		claimed := make([]OperationRow, 0, len(operations))
		for _, operation := range operations {
			ok, err := c.repo.MarkOperationRunning(ctx, operation.ID)
			if err != nil {
				unlock()
				return err
			}
			if ok {
				claimed = append(claimed, operation)
			}
		}
		if len(claimed) == 0 {
			continue
		}
		sort.Slice(claimed, func(i, j int) bool { return claimed[i].ID < claimed[j].ID })
		result.Processed += len(claimed)
		groups = append(groups, runtimeUserGroup{userID: userID, ops: claimed})
	}
	sort.Slice(groups, func(i, j int) bool { return groups[i].userID < groups[j].userID })
	if len(groups) == 0 {
		unlock()
		return nil
	}

	client, node, err := c.dial(ctx, nodeID)
	if err != nil {
		unlock()
		c.retryRuntimeUserGroups(ctx, groups, err, result)
		return nil
	}
	raw, serviceTags, masks, err := c.runtimeUserPlanningInputs(ctx, node)
	if err != nil {
		unlock()
		c.retryRuntimeUserGroups(ctx, groups, err, result)
		return nil
	}

	planned := make([]plannedRuntimeUserGroup, 0, len(groups))
	fallbacks := make([]runtimeUserGroup, 0)
	syncCache := &runtimeSyncCache{}
	for _, group := range groups {
		latest := group.ops[len(group.ops)-1]
		perOperation, err := c.runtimeUserNeedsPerOperationPath(ctx, client, node, latest, syncCache)
		if err != nil {
			planned = append(planned, plannedRuntimeUserGroup{group: group, planErr: err})
			continue
		}
		if perOperation {
			fallbacks = append(fallbacks, group)
			continue
		}
		items, perOperation, err := c.planRuntimeUserItems(ctx, node, latest, raw, serviceTags, masks)
		if perOperation {
			fallbacks = append(fallbacks, group)
			continue
		}
		planned = append(planned, plannedRuntimeUserGroup{group: group, items: items, planErr: err})
	}

	c.sendRuntimeUserBatches(ctx, client, planned, result)
	unlock()

	for _, group := range fallbacks {
		c.finishRuntimeUserGroup(ctx, group.ops, c.runOperation(ctx, group.ops[len(group.ops)-1]), result)
	}
	return nil
}

func (c Controller) runtimeUserPlanningInputs(ctx context.Context, node NodeRow) (map[string]any, map[int64]map[string]bool, map[string][]byte, error) {
	raw, err := c.repo.NodeRawConfig(ctx, node)
	if err != nil {
		return nil, nil, nil, err
	}
	serviceTags, err := c.repo.ServiceAllowedTags(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	masks, err := c.repo.UUIDMasks(ctx)
	if err != nil {
		return nil, nil, nil, err
	}
	return raw, serviceTags, masks, nil
}

func (c Controller) retryRuntimeUserGroups(ctx context.Context, groups []runtimeUserGroup, err error, result *ProcessOperationsResult) {
	for _, group := range groups {
		c.finishRuntimeUserGroup(ctx, group.ops, err, result)
	}
}

func (c Controller) runtimeUserNeedsPerOperationPath(ctx context.Context, client *nodeclient.Client, node NodeRow, operation OperationRow, syncCache *runtimeSyncCache) (bool, error) {
	if !client.Supports("user_batch") {
		return true, nil
	}
	if operation.OperationType == "update_user" && !client.Supports("targeted_user_update") {
		return true, nil
	}
	return c.userOperationRequiresConfigSyncCached(ctx, node, operation, syncCache)
}

func (c Controller) planRuntimeUserItems(
	ctx context.Context,
	node NodeRow,
	operation OperationRow,
	raw map[string]any,
	serviceTags map[int64]map[string]bool,
	masks map[string][]byte,
) ([]*nodev1.UserBatchOperation, bool, error) {
	email, err := c.legacyOperationEmail(ctx, operation)
	if err != nil {
		if operation.OperationType == "remove_user" || operation.OperationType == "disable_user" {
			return nil, true, nil
		}
		return nil, false, err
	}
	switch operation.OperationType {
	case "remove_user", "disable_user":
		tags := legacyRuntimeInboundTagsFromRaw(raw)
		items := make([]*nodev1.UserBatchOperation, 0, len(tags)*2)
		for _, tag := range tags {
			for _, candidate := range []string{taggedRuntimeUserEmail(email, tag), email} {
				items = append(items, &nodev1.UserBatchOperation{
					Action:     nodev1.UserBatchAction_USER_BATCH_ACTION_REMOVE,
					InboundTag: tag,
					Email:      candidate,
				})
			}
		}
		return items, false, nil
	case "add_user", "enable_user", "update_user":
		items, err := c.planRuntimeUserUpserts(ctx, node, operation, email, raw, serviceTags, masks)
		return items, false, err
	default:
		return nil, false, fmt.Errorf("unsupported runtime user operation: %s", operation.OperationType)
	}
}

func (c Controller) planRuntimeUserUpserts(
	ctx context.Context,
	node NodeRow,
	operation OperationRow,
	legacyEmail string,
	raw map[string]any,
	serviceTags map[int64]map[string]bool,
	masks map[string][]byte,
) ([]*nodev1.UserBatchOperation, error) {
	users, err := c.repo.RuntimeUsersByID(ctx, operation.UserID.Int64)
	if err != nil {
		return nil, err
	}
	return buildRuntimeUserUpserts(users, node.ID, operation.UserID.Int64, legacyEmail, raw, serviceTags, masks)
}

func buildRuntimeUserUpserts(
	users []runtimeUserRow,
	nodeID int64,
	userID int64,
	legacyEmail string,
	raw map[string]any,
	serviceTags map[int64]map[string]bool,
	masks map[string][]byte,
) ([]*nodev1.UserBatchOperation, error) {
	if len(users) == 0 {
		return nil, nil
	}
	inbounds := listOfMaps(raw["inbounds"])
	items := make([]*nodev1.UserBatchOperation, 0)
	var lastErr error
	matched := 0
	eligibleServiceUser := false
	for _, runtimeUser := range users {
		if !runtimeUser.ServiceID.Valid || runtimeUser.ServiceID.Int64 <= 0 {
			continue
		}
		eligibleServiceUser = true
		for _, inbound := range inbounds {
			tag := stringValue(inbound["tag"])
			protocol := strings.ToLower(stringValue(inbound["protocol"]))
			if tag == "" || protocol == "" || protocol != runtimeUser.Protocol {
				continue
			}
			if !serviceTags[runtimeUser.ServiceID.Int64][tag] {
				continue
			}
			matched++
			settings, err := userread.RuntimeProxySettingsForInbound(runtimeUser.Settings, inbound, runtimeUser.CredentialKey, runtimeUser.Flow, masks)
			if err != nil {
				lastErr = err
				continue
			}
			if runtimeUser.Protocol == "shadowsocks" {
				settings = userread.RuntimeShadowsocksLiveSettings(settings, ensureMap(inbound, "settings"))
			}
			settings["email"] = taggedRuntimeUserEmail(legacyEmail, tag)
			settings["protocol"] = protocol
			items = append(items, &nodev1.UserBatchOperation{
				Action:     nodev1.UserBatchAction_USER_BATCH_ACTION_UPSERT,
				InboundTag: tag,
				User:       grpcInboundUserPayload(settings),
			})
		}
	}
	if len(items) == 0 {
		if !eligibleServiceUser || matched == 0 {
			return nil, lastErr
		}
		if lastErr != nil {
			return nil, lastErr
		}
		return nil, fmt.Errorf("no service inbound user was applied for user %d on node %d", userID, nodeID)
	}
	return items, lastErr
}

// splitRuntimeUserBatchChunks packs planned groups into requests of at most
// maxUserBatchItems operations. A group is never split across requests.
func splitRuntimeUserBatchChunks(planned []plannedRuntimeUserGroup, maxItems int) [][]plannedRuntimeUserGroup {
	chunks := [][]plannedRuntimeUserGroup{}
	for start := 0; start < len(planned); {
		end := start
		itemCount := 0
		for end < len(planned) {
			next := len(planned[end].items)
			if end > start && itemCount+next > maxItems {
				break
			}
			itemCount += next
			end++
		}
		chunks = append(chunks, planned[start:end])
		start = end
	}
	return chunks
}

// runtimeUserBatchOutcomes returns one error per planned group, nil when the
// group was applied completely.
func runtimeUserBatchOutcomes(chunk []plannedRuntimeUserGroup, results []*nodev1.UserBatchResult, batchErr error) []error {
	outcomes := make([]error, len(chunk))
	offset := 0
	for index, planned := range chunk {
		count := len(planned.items)
		var failure error
		for position := 0; position < count; position++ {
			resultIndex := offset + position
			if batchErr != nil || failure != nil {
				break
			}
			if resultIndex >= len(results) {
				failure = fmt.Errorf("node returned %d results for the user batch", len(results))
				break
			}
			if item := results[resultIndex]; !item.GetOk() {
				failure = fmt.Errorf("%s", item.GetError())
			}
		}
		offset += count
		switch {
		case planned.planErr != nil:
			outcomes[index] = planned.planErr
		case batchErr != nil && count > 0:
			outcomes[index] = batchErr
		default:
			outcomes[index] = failure
		}
	}
	return outcomes
}

type runtimeUserBatchRuntime interface {
	Runtime() nodev1.NodeRuntimeServiceClient
	RequestOptions(request proto.Message) []grpc.CallOption
}

func (c Controller) sendRuntimeUserBatches(ctx context.Context, client runtimeUserBatchRuntime, planned []plannedRuntimeUserGroup, result *ProcessOperationsResult) {
	for _, chunk := range splitRuntimeUserBatchChunks(planned, maxUserBatchItems) {
		c.sendRuntimeUserBatch(ctx, client, chunk, result)
	}
}

func (c Controller) sendRuntimeUserBatch(ctx context.Context, client runtimeUserBatchRuntime, chunk []plannedRuntimeUserGroup, result *ProcessOperationsResult) {
	operations := make([]*nodev1.UserBatchOperation, 0)
	for _, planned := range chunk {
		operations = append(operations, planned.items...)
	}
	var results []*nodev1.UserBatchResult
	var batchErr error
	if len(operations) > 0 {
		batchReq := &nodev1.UserBatchRequest{
			BatchId:    newOperationID("user_batch", 0),
			Operations: operations,
		}
		response, err := client.Runtime().ApplyUserBatch(ctx, batchReq, client.RequestOptions(batchReq)...)
		batchErr = err
		if err == nil {
			results = response.GetResults()
		}
	}
	for index, outcome := range runtimeUserBatchOutcomes(chunk, results, batchErr) {
		c.finishRuntimeUserGroup(ctx, chunk[index].group.ops, outcome, result)
	}
}

func (c Controller) finishRuntimeUserGroup(ctx context.Context, ops []OperationRow, err error, result *ProcessOperationsResult) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), operationResultTimeout)
	defer cancel()
	if err == nil {
		done, markErr := c.repo.MarkOperationsDone(ctx, operationIDs(ops))
		if markErr != nil {
			return
		}
		result.Done += done
		return
	}
	if isPermanentOperationError(err) {
		for _, operation := range ops {
			_ = c.repo.MarkOperationFailed(ctx, operation.ID, err.Error())
		}
		result.Failed += len(ops)
		return
	}
	for _, operation := range ops {
		_ = c.repo.MarkOperationRetrying(ctx, operation.ID, err.Error())
	}
	result.Retrying += len(ops)
}

func operationIDs(operations []OperationRow) []int64 {
	ids := make([]int64, 0, len(operations))
	for _, operation := range operations {
		ids = append(ids, operation.ID)
	}
	return ids
}

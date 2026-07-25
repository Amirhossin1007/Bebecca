package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

const (
	recentActionSnapshotLifetime = 30 * 24 * time.Hour
	recentActionHistoryLifetime  = 90 * 24 * time.Hour
	recentActionSnapshotMaxSize  = 1 << 20
	recentActionHistoryMaxRows   = 1000
)

type recentActionSnapshot struct {
	Before        xrayconfig.MutationSnapshot `json:"before"`
	After         xrayconfig.MutationSnapshot `json:"after"`
	ConfigPatches []xrayconfig.ConfigPatch    `json:"config_patches,omitempty"`
}

type recentActionItem struct {
	ID                int64   `json:"id"`
	ActionType        string  `json:"action_type"`
	ResourceType      string  `json:"resource_type"`
	ResourceKey       string  `json:"resource_key"`
	ActorAdminID      *int64  `json:"actor_admin_id,omitempty"`
	ActorUsername     string  `json:"actor_username"`
	AuthSource        string  `json:"auth_source"`
	Summary           string  `json:"summary"`
	RollbackStatus    string  `json:"rollback_status"`
	CreatedAt         string  `json:"created_at"`
	SnapshotExpiresAt *string `json:"snapshot_expires_at,omitempty"`
	UndoneAt          *string `json:"undone_at,omitempty"`
	UndoneByAdminID   *int64  `json:"undone_by_admin_id,omitempty"`
}

type recentActionStored struct {
	recentActionItem
	Snapshot  []byte
	AfterHash string
}

func (s *Server) recordXrayMutationTx(ctx context.Context, tx *sql.Tx, mutation xrayconfig.Mutation) error {
	return s.recordRecentActionTx(ctx, tx, mutation)
}

func (s *Server) recordRecentActionTx(ctx context.Context, tx *sql.Tx, mutation xrayconfig.Mutation) error {
	principal, ok := ctx.Value(adminContextKey).(adminPrincipal)
	if !ok || principal.ID <= 0 || strings.TrimSpace(mutation.ActionType) == "" {
		return nil
	}
	configPatches, err := xrayconfig.BuildConfigPatches(mutation.Before.TargetStates, mutation.After.TargetStates)
	if err != nil {
		return err
	}
	before := withoutConfigTargetStates(mutation.Before)
	after := withoutConfigTargetStates(mutation.After)
	beforeHash, err := xrayconfig.SnapshotHash(before)
	if err != nil {
		return err
	}
	afterHash, err := xrayconfig.SnapshotHash(after)
	if err != nil {
		return err
	}
	if beforeHash == afterHash && len(configPatches) == 0 {
		return nil
	}
	payload, err := encodeRecentActionSnapshot(recentActionSnapshot{Before: before, After: after, ConfigPatches: configPatches})
	if err != nil {
		return err
	}
	if len(payload) > recentActionSnapshotMaxSize {
		return fmt.Errorf("recent action snapshot exceeds the 1 MiB safety limit")
	}
	now := time.Now().UTC()
	status := "available"
	if strings.HasPrefix(mutation.ActionType, "recent_action.rollback") {
		status = "unsupported"
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO recent_actions (
		action_type, resource_type, resource_key, actor_admin_id, actor_username, auth_source,
		summary, snapshot, after_hash, rollback_status, created_at, snapshot_expires_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		strings.TrimSpace(mutation.ActionType),
		strings.TrimSpace(mutation.ResourceType),
		strings.TrimSpace(mutation.ResourceKey),
		principal.ID,
		strings.TrimSpace(principal.Username),
		fmt.Sprint(principal.Context.Source),
		strings.TrimSpace(mutation.Summary),
		payload,
		afterHash,
		status,
		dbTimestamp(now),
		dbTimestamp(now.Add(recentActionSnapshotLifetime)),
	)
	if err != nil {
		return err
	}
	return s.pruneRecentActionsTx(ctx, tx, now)
}

func (s *Server) markRecentActionUndoneTx(ctx context.Context, tx *sql.Tx, actionID int64) error {
	principal, ok := ctx.Value(adminContextKey).(adminPrincipal)
	if !ok || principal.ID <= 0 {
		return errors.New("missing admin context")
	}
	result, err := tx.ExecContext(ctx, `UPDATE recent_actions
SET rollback_status = 'undone', undone_at = ?, undone_by_admin_id = ?
WHERE id = ? AND rollback_status = 'available'`, dbTimestamp(time.Now().UTC()), principal.ID, actionID)
	if err != nil {
		return err
	}
	updated, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if updated != 1 {
		return xrayconfig.ErrRollbackConflict
	}
	return nil
}

func (s *Server) pruneRecentActionsTx(ctx context.Context, tx *sql.Tx, now time.Time) error {
	if _, err := tx.ExecContext(ctx, `UPDATE recent_actions
SET snapshot = NULL, rollback_status = 'expired'
WHERE snapshot IS NOT NULL AND rollback_status = 'available' AND snapshot_expires_at IS NOT NULL AND snapshot_expires_at <= ?`, dbTimestamp(now)); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `DELETE FROM recent_actions WHERE created_at < ?`, dbTimestamp(now.Add(-recentActionHistoryLifetime)))
	if err != nil {
		return err
	}
	for {
		rows, err := tx.QueryContext(ctx, `SELECT id FROM recent_actions ORDER BY id DESC LIMIT 250 OFFSET ?`, recentActionHistoryMaxRows)
		if err != nil {
			return err
		}
		ids := make([]int64, 0, 250)
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				rows.Close()
				return err
			}
			ids = append(ids, id)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return err
		}
		if err := rows.Close(); err != nil {
			return err
		}
		if len(ids) == 0 {
			return nil
		}
		args := make([]any, len(ids))
		markers := make([]string, len(ids))
		for i, id := range ids {
			args[i] = id
			markers[i] = "?"
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM recent_actions WHERE id IN (`+strings.Join(markers, ",")+`)`, args...); err != nil {
			return err
		}
		if len(ids) < 250 {
			return nil
		}
	}
}

func encodeRecentActionSnapshot(snapshot recentActionSnapshot) ([]byte, error) {
	raw, err := json.Marshal(snapshot)
	if err != nil {
		return nil, err
	}
	var compressed bytes.Buffer
	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write(raw); err != nil {
		return nil, err
	}
	if err := writer.Close(); err != nil {
		return nil, err
	}
	return compressed.Bytes(), nil
}

func decodeRecentActionSnapshot(raw []byte) (recentActionSnapshot, error) {
	reader, err := gzip.NewReader(bytes.NewReader(raw))
	if err != nil {
		return recentActionSnapshot{}, err
	}
	defer reader.Close()
	decoded, err := io.ReadAll(io.LimitReader(reader, 8<<20))
	if err != nil {
		return recentActionSnapshot{}, err
	}
	var snapshot recentActionSnapshot
	if err := json.Unmarshal(decoded, &snapshot); err != nil {
		return recentActionSnapshot{}, err
	}
	if snapshot.Before.Version != 1 || snapshot.After.Version != 1 {
		return recentActionSnapshot{}, errors.New("unsupported recent action snapshot")
	}
	for _, patch := range snapshot.ConfigPatches {
		if !patch.Valid() {
			return recentActionSnapshot{}, errors.New("unsupported Xray config patch")
		}
	}
	return snapshot, nil
}

func withoutConfigTargetStates(snapshot xrayconfig.MutationSnapshot) xrayconfig.MutationSnapshot {
	result := snapshot
	result.TargetStates = nil
	return result
}

func (s *Server) handleRecentActionsRoot(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	limit := 30
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 || parsed > 50 {
			writeError(w, http.StatusBadRequest, "limit must be between 1 and 50")
			return
		}
		limit = parsed
	}
	var beforeID int64
	if raw := strings.TrimSpace(r.URL.Query().Get("before_id")); raw != "" {
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || parsed <= 0 {
			writeError(w, http.StatusBadRequest, "invalid before_id")
			return
		}
		beforeID = parsed
	}
	items, err := s.listRecentActions(r.Context(), beforeID, limit+1)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	var nextBeforeID *int64
	if len(items) > limit {
		items = items[:limit]
		cursor := items[len(items)-1].ID
		nextBeforeID = &cursor
	}
	writeJSON(w, http.StatusOK, map[string]any{"actions": items, "next_before_id": nextBeforeID})
}

func (s *Server) handleRecentActionsPath(w http.ResponseWriter, r *http.Request) {
	rest := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/core/recent-actions/"), "/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	actionID, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil || actionID <= 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if len(parts) == 1 && r.Method == http.MethodGet {
		s.handleRecentActionDetail(w, r, actionID)
		return
	}
	if len(parts) == 2 && parts[1] == "rollback" && r.Method == http.MethodPost {
		s.handleRecentActionRollback(w, r, actionID)
		return
	}
	writeError(w, http.StatusMethodNotAllowed, "method not allowed")
}

func (s *Server) listRecentActions(ctx context.Context, beforeID int64, limit int) ([]recentActionItem, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id, action_type, resource_type, resource_key, actor_admin_id, actor_username, auth_source,
		summary, rollback_status, created_at, snapshot_expires_at, undone_at, undone_by_admin_id
		FROM recent_actions WHERE (? = 0 OR id < ?) ORDER BY id DESC LIMIT ?`, beforeID, beforeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []recentActionItem{}
	for rows.Next() {
		item, err := scanRecentActionItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Server) loadRecentAction(ctx context.Context, actionID int64) (recentActionStored, error) {
	row := s.db.QueryRowContext(ctx, `SELECT id, action_type, resource_type, resource_key, actor_admin_id, actor_username, auth_source,
		summary, rollback_status, created_at, snapshot_expires_at, undone_at, undone_by_admin_id, snapshot, after_hash
		FROM recent_actions WHERE id = ? LIMIT 1`, actionID)
	return scanRecentActionStored(row)
}

func (s *Server) handleRecentActionDetail(w http.ResponseWriter, r *http.Request, actionID int64) {
	action, err := s.loadRecentAction(r.Context(), actionID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "recent action not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	response := map[string]any{"action": action.recentActionItem, "snapshot_available": len(action.Snapshot) > 0}
	if len(action.Snapshot) > 0 {
		snapshot, err := decodeRecentActionSnapshot(action.Snapshot)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not read recent action snapshot")
			return
		}
		response["before"] = redactRecentActionSnapshot(snapshot.Before)
		response["after"] = redactRecentActionSnapshot(snapshot.After)
		if len(snapshot.ConfigPatches) > 0 {
			response["config_changes"] = redactRecentActionConfigChanges(snapshot.ConfigPatches)
		}
	}
	writeJSON(w, http.StatusOK, response)
}

func (s *Server) handleRecentActionRollback(w http.ResponseWriter, r *http.Request, actionID int64) {
	action, err := s.loadRecentAction(r.Context(), actionID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "recent action not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if action.RollbackStatus != "available" || len(action.Snapshot) == 0 || (action.SnapshotExpiresAt != nil && *action.SnapshotExpiresAt <= dbTimestamp(time.Now().UTC())) {
		writeError(w, http.StatusConflict, "rollback is not available for this action")
		return
	}
	snapshot, err := decodeRecentActionSnapshot(action.Snapshot)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not read recent action snapshot")
		return
	}
	if err := s.configRepo.RestoreMutationSnapshot(r.Context(), actionID, action.AfterHash, snapshot.Before, snapshot.ConfigPatches); err != nil {
		if errors.Is(err, xrayconfig.ErrRollbackConflict) {
			var conflict *xrayconfig.RollbackConflictError
			if errors.As(err, &conflict) && len(conflict.Paths) > 0 {
				writeJSON(w, http.StatusConflict, map[string]any{
					"detail":         "rollback conflict: the same configuration path changed after this action",
					"conflict_paths": conflict.Paths,
				})
				return
			}
			writeError(w, http.StatusConflict, "rollback conflict: the affected resources changed after this action")
			return
		}
		var validation *xrayconfig.RollbackValidationError
		if errors.As(err, &validation) {
			writeError(w, http.StatusUnprocessableEntity, validation.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"detail": "recent action rolled back"})
}

func redactRecentActionConfigChanges(patches []xrayconfig.ConfigPatch) []map[string]any {
	changes := make([]map[string]any, 0)
	for _, patch := range patches {
		for _, change := range patch.Changes {
			changes = append(changes, map[string]any{
				"target_id":     patch.TargetID,
				"path":          change.Path,
				"kind":          change.Kind,
				"before":        redactRecentActionSnapshot(change.Before),
				"after":         redactRecentActionSnapshot(change.After),
				"before_exists": change.BeforeExists,
				"after_exists":  change.AfterExists,
			})
		}
	}
	return changes
}

type rowScanner interface{ Scan(...any) error }

func scanRecentActionItem(scanner rowScanner) (recentActionItem, error) {
	var item recentActionItem
	var actorID, undoneBy sql.NullInt64
	var expiresAt, undoneAt sql.NullString
	err := scanner.Scan(&item.ID, &item.ActionType, &item.ResourceType, &item.ResourceKey, &actorID, &item.ActorUsername, &item.AuthSource,
		&item.Summary, &item.RollbackStatus, &item.CreatedAt, &expiresAt, &undoneAt, &undoneBy)
	if err != nil {
		return recentActionItem{}, err
	}
	if actorID.Valid {
		value := actorID.Int64
		item.ActorAdminID = &value
	}
	if expiresAt.Valid {
		value := expiresAt.String
		item.SnapshotExpiresAt = &value
	}
	if undoneAt.Valid {
		value := undoneAt.String
		item.UndoneAt = &value
	}
	if undoneBy.Valid {
		value := undoneBy.Int64
		item.UndoneByAdminID = &value
	}
	return item, nil
}

func scanRecentActionStored(scanner rowScanner) (recentActionStored, error) {
	var stored recentActionStored
	var actorID, undoneBy sql.NullInt64
	var expiresAt, undoneAt sql.NullString
	err := scanner.Scan(&stored.ID, &stored.ActionType, &stored.ResourceType, &stored.ResourceKey, &actorID, &stored.ActorUsername, &stored.AuthSource,
		&stored.Summary, &stored.RollbackStatus, &stored.CreatedAt, &expiresAt, &undoneAt, &undoneBy, &stored.Snapshot, &stored.AfterHash)
	if err != nil {
		return recentActionStored{}, err
	}
	if actorID.Valid {
		value := actorID.Int64
		stored.ActorAdminID = &value
	}
	if expiresAt.Valid {
		value := expiresAt.String
		stored.SnapshotExpiresAt = &value
	}
	if undoneAt.Valid {
		value := undoneAt.String
		stored.UndoneAt = &value
	}
	if undoneBy.Valid {
		value := undoneBy.Int64
		stored.UndoneByAdminID = &value
	}
	return stored, nil
}

func redactRecentActionSnapshot(value any) any {
	switch typed := value.(type) {
	case nil, string, bool, float64, float32, int, int64, int32, uint, uint64:
		return typed
	case map[string]any:
		result := make(map[string]any, len(typed))
		for key, item := range typed {
			if isRecentActionSecretKey(key) {
				result[key] = "[redacted]"
				continue
			}
			result[key] = redactRecentActionSnapshot(item)
		}
		return result
	case []any:
		result := make([]any, len(typed))
		for i, item := range typed {
			result[i] = redactRecentActionSnapshot(item)
		}
		return result
	default:
		raw, err := json.Marshal(value)
		if err != nil {
			return value
		}
		var normalized any
		if err := json.Unmarshal(raw, &normalized); err != nil {
			return value
		}
		return redactRecentActionSnapshot(normalized)
	}
}

func isRecentActionSecretKey(key string) bool {
	key = strings.ToLower(strings.ReplaceAll(strings.ReplaceAll(strings.TrimSpace(key), "_", ""), "-", ""))
	for _, marker := range []string{"password", "private", "secret", "token", "certificate", "seed", "apikey", "uuid"} {
		if strings.Contains(key, marker) {
			return true
		}
	}
	return key == "key" || strings.HasSuffix(key, "key")
}

//go:build cgo

package api

import (
	"context"
	"database/sql"
	"testing"

	_ "github.com/mattn/go-sqlite3"
	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

func TestRecordRecentActionStoresCompressedBeforeAndAfter(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.Exec(`CREATE TABLE recent_actions (
		id INTEGER PRIMARY KEY, action_type TEXT NOT NULL, resource_type TEXT NOT NULL, resource_key TEXT NOT NULL,
		actor_admin_id INTEGER NULL, actor_username TEXT NOT NULL, auth_source TEXT NOT NULL, summary TEXT NOT NULL,
		snapshot BLOB NULL, after_hash TEXT NOT NULL, rollback_status TEXT NOT NULL, created_at DATETIME NOT NULL,
		snapshot_expires_at DATETIME NULL, undone_at DATETIME NULL, undone_by_admin_id INTEGER NULL
	)`); err != nil {
		t.Fatal(err)
	}
	server := &Server{db: db}
	principal := adminPrincipal{ID: 9, Username: "operator"}
	ctx := context.WithValue(context.Background(), adminContextKey, principal)
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	before := xrayconfig.MutationSnapshot{Version: 1}
	after := xrayconfig.MutationSnapshot{Version: 1, InboundTag: "cdn"}
	if err := server.recordRecentActionTx(ctx, tx, xrayconfig.Mutation{
		ActionType: "inbound.create", ResourceType: "inbound", ResourceKey: "cdn", Summary: "Created inbound", Before: before, After: after,
	}); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	action, err := server.loadRecentAction(ctx, 1)
	if err != nil {
		t.Fatal(err)
	}
	if action.ActorUsername != "operator" || action.RollbackStatus != "available" || len(action.Snapshot) == 0 {
		t.Fatalf("unexpected action: %#v", action)
	}
	snapshot, err := decodeRecentActionSnapshot(action.Snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if snapshot.Before.Version != 1 || snapshot.After.InboundTag != "cdn" {
		t.Fatalf("unexpected snapshot: %#v", snapshot)
	}
}

package nodecontroller

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
)

func TestFinishRuntimeUserGroupRecordsResultsAfterCycleDeadline(t *testing.T) {
	ctx := context.Background()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "finish.db")+"?_pragma=busy_timeout(30000)")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.ExecContext(ctx, `
CREATE TABLE node_operations (
	id INTEGER PRIMARY KEY,
	operation_type TEXT NOT NULL,
	node_id INTEGER NULL,
	user_id INTEGER NULL,
	payload TEXT NOT NULL DEFAULT '{}',
	status TEXT NOT NULL,
	attempts INTEGER NOT NULL DEFAULT 0,
	last_error TEXT NULL,
	idempotency_key TEXT NOT NULL DEFAULT '',
	created_at DATETIME NULL,
	updated_at DATETIME NULL
);
INSERT INTO node_operations (id, operation_type, node_id, user_id, status, attempts)
VALUES (1, 'add_user', 7, 100, 'running', 1), (2, 'add_user', 7, 101, 'running', 1);`); err != nil {
		t.Fatal(err)
	}

	expired, cancel := context.WithCancel(ctx)
	cancel()
	controller := NewController(NewRepository(db, "sqlite"))
	var result ProcessOperationsResult
	controller.finishRuntimeUserGroup(expired, []OperationRow{{ID: 1}}, nil, &result)
	controller.finishRuntimeUserGroup(expired, []OperationRow{{ID: 2}}, errors.New("node unavailable"), &result)

	assertRepositoryString(t, db, `SELECT status FROM node_operations WHERE id = 1`, "done")
	assertRepositoryString(t, db, `SELECT status FROM node_operations WHERE id = 2`, "retrying")
	if result.Done != 1 || result.Retrying != 1 {
		t.Fatalf("result = %#v, want one done and one retrying", result)
	}
}

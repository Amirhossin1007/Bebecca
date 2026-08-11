package nodecontroller

import (
	"context"
	"database/sql"
	"testing"

	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
)

func TestUpdateUserOperationUsesRuntimeConfigReconciliation(t *testing.T) {
	controller := Controller{}
	requiresSync, err := controller.userOperationRequiresConfigSync(
		context.Background(),
		NodeRow{},
		OperationRow{
			OperationType: "update_user",
			UserID:        sql.NullInt64{Int64: 42, Valid: true},
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if !requiresSync {
		t.Fatal("update_user must use runtime config reconciliation")
	}
}

func TestRuntimeHasCapability(t *testing.T) {
	state := &nodev1.RuntimeState{Capabilities: []string{"safe_user_reconciliation"}}
	if !runtimeHasCapability(state, "safe_user_reconciliation") {
		t.Fatal("expected advertised capability")
	}
	if runtimeHasCapability(&nodev1.RuntimeState{}, "safe_user_reconciliation") {
		t.Fatal("legacy nodes must not advertise safe reconciliation")
	}
}

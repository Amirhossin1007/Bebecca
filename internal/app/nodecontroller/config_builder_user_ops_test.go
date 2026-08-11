package nodecontroller

import (
	"context"
	"database/sql"
	"testing"
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

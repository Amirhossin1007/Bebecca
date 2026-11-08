package nodecontroller

import (
	"context"
	"database/sql"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/rebeccapanel/rebecca/internal/app/nodeclient"
	nodev1 "github.com/rebeccapanel/rebecca/internal/proto/node/v1"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

func TestIPLimitedUserIDsReturnsOnlyUsersWithALimit(t *testing.T) {
	ctx := context.Background()
	db, err := sql.Open("sqlite", "file:"+filepath.Join(t.TempDir(), "scope.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.ExecContext(ctx, `CREATE TABLE users (id INTEGER PRIMARY KEY, ip_limit INTEGER NULL)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO users (id, ip_limit) VALUES (1, 2), (2, 0), (3, NULL), (4, 5)`); err != nil {
		t.Fatal(err)
	}

	got, err := Repository{db: db}.IPLimitedUserIDs(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if want := []string{"1", "4"}; !reflect.DeepEqual(got, want) {
		t.Fatalf("limited user ids=%v want=%v", got, want)
	}
}

func TestIPScopeForNodeIsSentOnlyToNodesThatSupportIt(t *testing.T) {
	legacy := &nodeclient.Client{}
	if scope := ipScopeForNode(legacy, []string{"1"}); scope != nil {
		t.Fatalf("node without ip_scope_lookup got scope %v", scope)
	}

	current := &nodeclient.Client{}
	current.SetHandshake("1.7.1", []string{ipLookupScopeCapability})
	if scope := ipScopeForNode(current, nil); scope == nil {
		t.Fatal("supporting node with no limited users must still get an empty scope so it skips lookups")
	}
	if scope := ipScopeForNode(current, []string{"1", "4"}); !reflect.DeepEqual(scope.GetUids(), []string{"1", "4"}) {
		t.Fatalf("scope uids=%v", scope.GetUids())
	}
}

func TestIPLookupScopeSurvivesWireRoundTripAndAbsentScopeStaysNil(t *testing.T) {
	raw, err := proto.Marshal(&nodev1.CollectUsageRequest{IpScope: &nodev1.IPLookupScope{}})
	if err != nil {
		t.Fatal(err)
	}
	var withScope nodev1.CollectUsageRequest
	if err := proto.Unmarshal(raw, &withScope); err != nil {
		t.Fatal(err)
	}
	if withScope.GetIpScope() == nil {
		t.Fatal("empty scope must survive the wire as present, not absent")
	}

	raw, err = proto.Marshal(&nodev1.CollectUsageRequest{Reset_: true})
	if err != nil {
		t.Fatal(err)
	}
	var legacy nodev1.CollectUsageRequest
	if err := proto.Unmarshal(raw, &legacy); err != nil {
		t.Fatal(err)
	}
	if legacy.GetIpScope() != nil {
		t.Fatal("request without a scope must decode as legacy (nil)")
	}
}

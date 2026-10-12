package system

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

type fakeBuildCatalog struct {
	catalog BuildCatalog
}

func (f fakeBuildCatalog) Status(context.Context, string, *string, string) UpdateStatus {
	return UpdateStatus{}
}

func (f fakeBuildCatalog) Builds(context.Context, string) (BuildCatalog, error) {
	return f.catalog, nil
}

func TestValidateUpdateTargetRefusesDowngrades(t *testing.T) {
	checker := fakeBuildCatalog{catalog: BuildCatalog{
		Floor:  versionSwitchFloor,
		Stable: []BuildVersion{{Version: "v1.6.0", Channel: "stable"}},
		Dev:    []BuildVersion{{Version: "dev-b6f54d6", Channel: "dev", Commit: "b6f54d6eb6c0ffee1234567890abcdef12345678"}},
	}}
	cases := []struct {
		name    string
		channel string
		version string
		current string
		allowed bool
	}{
		{"release below the floor", "", "v1.5.0", "stable", false},
		{"release at the floor", "", "v1.6.0", "stable", true},
		{"dev build before the schema floor", "", "dev-0123456", "dev", false},
		{"dev build at the schema floor", "", "dev-b6f54d6", "dev", true},
		{"dev channel resolves to a listed dev build", "dev", "", "", true},
		{"stable channel resolves to a listed release", "stable", "", "", true},
		{"current channel follows the running stable channel", "current", "", "stable", true},
		{"current channel with an unknown running channel is refused", "", "", "", false},
		{"unknown release is not installable", "", "v9.9.9", "stable", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateUpdateTarget(context.Background(), checker, PanelUpdateRepo, tc.channel, tc.version, tc.current)
			if (err == nil) != tc.allowed {
				t.Fatalf("ValidateUpdateTarget(channel=%q, version=%q, current=%q) error = %v, want allowed=%v", tc.channel, tc.version, tc.current, err, tc.allowed)
			}
		})
	}
}

func TestValidateUpdateTargetRefusesWhenNothingIsAboveTheFloor(t *testing.T) {
	checker := fakeBuildCatalog{catalog: BuildCatalog{Floor: versionSwitchFloor}}
	for _, tc := range []struct{ channel, version string }{
		{"stable", ""},
		{"dev", ""},
		{"", "dev-b6f54d6"},
	} {
		if err := ValidateUpdateTarget(context.Background(), checker, PanelUpdateRepo, tc.channel, tc.version, "stable"); err == nil {
			t.Fatalf("empty catalog must refuse channel=%q version=%q", tc.channel, tc.version)
		}
	}
}

func TestNodeUpdatesUseTheNodeFloor(t *testing.T) {
	if floorForRepo(NodeUpdateRepo) != nodeVersionFloor || floorForRepo(PanelUpdateRepo) != versionSwitchFloor {
		t.Fatalf("floorForRepo must pick the floor of each repository")
	}
	checker := fakeBuildCatalog{catalog: BuildCatalog{
		Floor:  nodeVersionFloor,
		Stable: []BuildVersion{{Version: "v1.6.0", Channel: "stable"}},
	}}
	if err := ValidateUpdateTarget(context.Background(), checker, NodeUpdateRepo, "", "v1.5.0", "stable"); err == nil {
		t.Fatal("node target below the node floor must be refused")
	}
	if err := ValidateUpdateTarget(context.Background(), checker, NodeUpdateRepo, "", "v1.6.0", "stable"); err != nil {
		t.Fatalf("node target at the node floor must be allowed: %v", err)
	}
}

func TestResolveUpdateVersionPinsLatestToNewestListedRelease(t *testing.T) {
	checker := fakeBuildCatalog{catalog: BuildCatalog{
		Floor:  versionSwitchFloor,
		Stable: []BuildVersion{{Version: "v1.6.0", Channel: "stable"}, {Version: "v1.6.2", Channel: "stable"}, {Version: "v1.6.1", Channel: "stable"}},
	}}
	ctx := context.Background()
	for _, tc := range []struct{ channel, version, current string }{
		{"", "latest", ""},
		{"stable", "", ""},
		{"", "", "stable"},
	} {
		got, err := ResolveUpdateVersion(ctx, checker, PanelUpdateRepo, tc.channel, tc.version, tc.current)
		if err != nil || got != "v1.6.2" {
			t.Fatalf("ResolveUpdateVersion(channel=%q, version=%q, current=%q) = %q, %v; want v1.6.2", tc.channel, tc.version, tc.current, got, err)
		}
	}
	got, err := ResolveUpdateVersion(ctx, checker, PanelUpdateRepo, "", "v1.6.1", "")
	if err != nil || got != "v1.6.1" {
		t.Fatalf("explicit build = %q, %v; want v1.6.1", got, err)
	}
}

func TestUpdateFollowsCurrentChannel(t *testing.T) {
	if !UpdateFollowsCurrentChannel("", "") || !UpdateFollowsCurrentChannel("current", "") {
		t.Fatal("an empty or current channel request must follow the running channel")
	}
	if UpdateFollowsCurrentChannel("", "v1.6.0") || UpdateFollowsCurrentChannel("stable", "") || UpdateFollowsCurrentChannel("dev", "") {
		t.Fatal("an explicit build or channel must not follow the running channel")
	}
}

func TestGitHubCatalogServesLastCatalogWhenGitHubFails(t *testing.T) {
	var down atomic.Bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if down.Load() {
			http.Error(w, "rate limit exceeded", http.StatusForbidden)
			return
		}
		switch r.URL.Path {
		case "/repos/rebeccapanel/Rebecca-node/releases":
			_ = json.NewEncoder(w).Encode([]map[string]any{{"tag_name": "v1.6.0"}})
		case "/rebeccapanel/Rebecca-node/dev-build-manifest/dev-builds.json":
			_ = json.NewEncoder(w).Encode(map[string]any{"builds": []map[string]any{}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	now := time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC)
	checker := &GitHubUpdateChecker{
		APIBase:        server.URL,
		RawBase:        server.URL,
		HTTPClient:     server.Client(),
		ManifestBranch: "dev-build-manifest",
		ManifestPath:   "dev-builds.json",
		CacheTTL:       time.Minute,
		ErrorTTL:       time.Minute,
		Now:            func() time.Time { return now },
	}
	ctx := context.Background()
	if _, err := checker.Builds(ctx, NodeUpdateRepo); err != nil {
		t.Fatal(err)
	}
	down.Store(true)
	now = now.Add(2 * time.Minute)
	catalog, err := checker.Builds(ctx, NodeUpdateRepo)
	if err != nil {
		t.Fatalf("a failed refresh must serve the last catalog: %v", err)
	}
	if len(catalog.Stable) != 1 || catalog.Stable[0].Version != "v1.6.0" || catalog.Floor != nodeVersionFloor {
		t.Fatalf("unexpected stale catalog: %#v", catalog)
	}

	fresh := &GitHubUpdateChecker{APIBase: server.URL, RawBase: server.URL, HTTPClient: server.Client(), Now: func() time.Time { return now }}
	if _, err := fresh.Builds(ctx, NodeUpdateRepo); err == nil {
		t.Fatal("without an earlier catalog the failure must be returned")
	}
}

func TestGitHubStatusTargetSkipsReleasesBelowTheFloor(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/repos/rebeccapanel/Rebecca/releases/latest":
			_ = json.NewEncoder(w).Encode(map[string]any{"tag_name": "v1.5.1", "name": "v1.5.1"})
		case "/repos/rebeccapanel/Rebecca/releases":
			_ = json.NewEncoder(w).Encode([]map[string]any{{"tag_name": "v1.5.1"}, {"tag_name": "v1.6.0"}})
		case "/rebeccapanel/Rebecca/dev-build-manifest/dev-builds.json":
			_ = json.NewEncoder(w).Encode(map[string]any{"builds": []map[string]any{}})
		case "/repos/rebeccapanel/Rebecca/actions/workflows/binary-build.yml/runs":
			_ = json.NewEncoder(w).Encode(map[string]any{"workflow_runs": []map[string]any{}})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	checker := &GitHubUpdateChecker{
		APIBase:        server.URL,
		RawBase:        server.URL,
		HTTPClient:     server.Client(),
		ManifestBranch: "dev-build-manifest",
		ManifestPath:   "dev-builds.json",
		Now:            func() time.Time { return time.Date(2026, 10, 12, 0, 0, 0, 0, time.UTC) },
	}
	current := "v1.5.0"
	status := checker.Status(context.Background(), PanelUpdateRepo, &current, "stable")
	if status.Error != "" {
		t.Fatalf("unexpected status error: %s", status.Error)
	}
	if status.Target == nil || *status.Target != "v1.6.0" || !status.Available {
		t.Fatalf("target = %v available = %v, want v1.6.0 available", status.Target, status.Available)
	}
}

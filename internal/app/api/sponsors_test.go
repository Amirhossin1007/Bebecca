package api

import (
	"path/filepath"
	"testing"
	"time"
)

func TestSponsorManifestNormalizationSkipsInvalidAndExpiredItems(t *testing.T) {
	m := newSponsorManager("", filepath.Join(t.TempDir(), "cache"), nil)
	items, err := m.normalizeManifestItems("https://raw.githubusercontent.com/example/sponsors/main/manifest.json", []sponsorManifestAsset{
		{ID: "fresh", Placement: "header", Image: "header.svg", ValidUntil: time.Now().UTC().Add(time.Hour).Format(time.RFC3339)},
		{ID: "expired", Placement: "sidebar", Image: "expired.svg", ValidUntil: time.Now().UTC().Add(-time.Minute).Format(time.RFC3339)},
		{ID: "bad-url", Placement: "sidebar", Image: "https://example.com/logo.svg", ValidUntil: time.Now().UTC().Add(time.Hour).Format(time.RFC3339)},
		{ID: "bad-id/", Placement: "sidebar", Image: "logo.svg", ValidUntil: time.Now().UTC().Add(time.Hour).Format(time.RFC3339)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != "fresh" || items[0].SourceURL != "https://raw.githubusercontent.com/example/sponsors/main/header.svg" {
		t.Fatalf("unexpected normalized sponsor assets: %#v", items)
	}
}

func TestSponsorDateOnlyExpirationIncludesTheDate(t *testing.T) {
	parsed, err := parseSponsorTime("2099-12-31")
	if err != nil {
		t.Fatal(err)
	}
	if parsed.UTC().Format(time.RFC3339) != "2100-01-01T00:00:00Z" {
		t.Fatalf("date-only expiration parsed as %s", parsed.UTC().Format(time.RFC3339))
	}
}

func TestSponsorManifestSupportsMobileHeaders(t *testing.T) {
	m := newSponsorManager("", filepath.Join(t.TempDir(), "cache"), nil)
	items, err := m.normalizeManifestItems("https://raw.githubusercontent.com/example/sponsors/main/manifest.json", []sponsorManifestAsset{
		{ID: "mobile", Placement: "header_mobile", Image: "mobile.svg", ValidUntil: time.Now().UTC().Add(time.Hour).Format(time.RFC3339)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].Placement != "header_mobile" {
		t.Fatalf("unexpected mobile header assets: %#v", items)
	}
}

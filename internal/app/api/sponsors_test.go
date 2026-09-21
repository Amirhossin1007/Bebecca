package api

import (
	"context"
	"io"
	"net/http"
	"path/filepath"
	"strings"
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

func TestSponsorRefreshesWhenCachedURLChanges(t *testing.T) {
	cacheDir := filepath.Join(t.TempDir(), "cache")
	m := newSponsorManager(
		"https://raw.githubusercontent.com/example/sponsors/main/manifest.json",
		cacheDir,
		&http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			body := `{"enabled":true,"assets":[{"id":"fresh","placement":"header","image_url":"header.svg","valid_until":"2099-12-31"}]}`
			if strings.HasSuffix(req.URL.Path, "/header.svg") {
				body = `<svg xmlns="http://www.w3.org/2000/svg"></svg>`
			}
			return &http.Response{
				StatusCode: http.StatusOK,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(body)),
				Request:    req,
			}, nil
		})},
	)
	if err := m.saveCache(sponsorCache{
		CheckedAt:   time.Now().UTC(),
		ManifestURL: "https://raw.githubusercontent.com/example/sponsors/old/manifest.json",
		Assets:      []cachedSponsorAsset{},
	}); err != nil {
		t.Fatal(err)
	}
	assets, err := m.ensure(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(assets) != 1 || assets[0].ID != "fresh" {
		t.Fatalf("expected cache miss after URL change, got %#v", assets)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

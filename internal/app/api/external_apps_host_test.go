package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	externalapps "github.com/rebeccapanel/rebecca/internal/app/externalapps"
)

func TestExternalAppAwareHandlerServesOnlyMatchingSafeHost(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "apps", "site")
	if err := os.MkdirAll(filepath.Join(base, ".metadata"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("external app"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "config.php"), []byte("secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	record, err := json.Marshal(externalapps.Record{ID: "0123456789ab", Template: "archive", Domain: "app.example.com", Enabled: true, Runtime: "static", Root: root})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, ".metadata", "0123456789ab.json"), record, 0o600); err != nil {
		t.Fatal(err)
	}
	handler := &externalAppAwareHandler{
		apps: externalapps.New(externalapps.Config{BaseDir: base}, nil),
		next: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) }),
	}

	request := httptest.NewRequest(http.MethodGet, "https://app.example.com/", nil)
	request.Host = "app.example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "external app" {
		t.Fatalf("static response = %d %q", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodGet, "https://app.example.com/config.php", nil)
	request.Host = "app.example.com"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound {
		t.Fatalf("protected file status = %d", response.Code)
	}

	request = httptest.NewRequest(http.MethodGet, "https://unknown.example.com/", nil)
	request.Host = "unknown.example.com"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusTeapot {
		t.Fatalf("unknown host status = %d", response.Code)
	}
}

func TestExternalAppAwareHandlerRoutesMultipleAppsByPath(t *testing.T) {
	base := t.TempDir()
	for _, record := range []externalapps.Record{
		{ID: "0123456789ab", Template: "mirzabot", Domain: "bots.example.com", Path: "bot0123456789ab", Enabled: true, Runtime: "static", Root: filepath.Join(base, "apps", "0123456789ab")},
		{ID: "abcdef012345", Template: "mirzabot", Domain: "bots.example.com", Path: "botabcdef012345", Enabled: true, Runtime: "static", Root: filepath.Join(base, "apps", "abcdef012345")},
	} {
		if err := os.MkdirAll(record.Root, 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(record.Root, "index.html"), []byte(record.ID), 0o600); err != nil {
			t.Fatal(err)
		}
		data, err := json.Marshal(record)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(base, ".metadata"), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(base, ".metadata", record.ID+".json"), data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	handler := &externalAppAwareHandler{apps: externalapps.New(externalapps.Config{BaseDir: base}, nil), next: http.NotFoundHandler()}
	for path, want := range map[string]string{
		"/bot0123456789ab/": "0123456789ab",
		"/botabcdef012345/": "abcdef012345",
	} {
		request := httptest.NewRequest(http.MethodGet, "https://bots.example.com"+path, nil)
		request.Host = "bots.example.com"
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != want {
			t.Fatalf("path %s response=%d %q", path, response.Code, response.Body.String())
		}
	}
}

func TestExternalAppAwareHandlerRedirectsDirectoriesToTrailingSlash(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "apps", "0123456789ab")
	if err := os.MkdirAll(filepath.Join(root, "app", "assets"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("webhook"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "app", "index.html"), []byte(`<script src="./assets/app.js"></script>`), 0o600); err != nil {
		t.Fatal(err)
	}
	record := externalapps.Record{ID: "0123456789ab", Template: "mirzabot", Domain: "bot.example.com", Path: "bot0123456789ab", Enabled: true, Runtime: "static", Root: root}
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(base, ".metadata"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, ".metadata", record.ID+".json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	handler := &externalAppAwareHandler{apps: externalapps.New(externalapps.Config{BaseDir: base}, nil), next: http.NotFoundHandler()}
	request := httptest.NewRequest(http.MethodGet, "https://bot.example.com/bot0123456789ab/app?x=1", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusMovedPermanently || response.Header().Get("Location") != "/bot0123456789ab/app/?x=1" {
		t.Fatalf("directory redirect=%d %q", response.Code, response.Header().Get("Location"))
	}

	request = httptest.NewRequest(http.MethodPost, "https://bot.example.com/bot0123456789ab", nil)
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code == http.StatusMovedPermanently {
		t.Fatal("legacy webhook POST was redirected")
	}
}

func TestMirzaFastCGIUsesForwardedClientIP(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "https://bot.example.com/index.php", nil)
	request.RemoteAddr = "172.70.0.1:1234"
	request.Header.Set("CF-Connecting-IP", "149.154.167.220")
	params := externalAppFastCGIParams(request, externalapps.Record{Template: "mirzabot"}, "index.php", "/app/index.php")
	if params["REMOTE_ADDR"] != "149.154.167.220" {
		t.Fatalf("REMOTE_ADDR=%q", params["REMOTE_ADDR"])
	}
}

func TestExternalAppAwareHandlerUsesConfiguredDefaultDocument(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "apps", "site")
	if err := os.MkdirAll(filepath.Join(root, "public"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "public", "home.html"), []byte("configured home"), 0o600); err != nil {
		t.Fatal(err)
	}
	record := externalapps.Record{
		ID: "0123456789ab", Template: "archive", Domain: "app.example.com", Enabled: true,
		Runtime: "static", IndexFile: "public/home.html", FallbackToIndex: true, Root: root,
	}
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(base, ".metadata"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, ".metadata", record.ID+".json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	handler := &externalAppAwareHandler{apps: externalapps.New(externalapps.Config{BaseDir: base}, nil), next: http.NotFoundHandler()}
	request := httptest.NewRequest(http.MethodGet, "https://app.example.com/", nil)
	request.Host = "app.example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "configured home" {
		t.Fatalf("response=%d %q", response.Code, response.Body.String())
	}
	request = httptest.NewRequest(http.MethodGet, "https://app.example.com/client/route", nil)
	request.Host = "app.example.com"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || strings.TrimSpace(response.Body.String()) != "configured home" {
		t.Fatalf("fallback response=%d %q", response.Code, response.Body.String())
	}
}

func TestExternalAppAwareHandlerAppliesHostingSettings(t *testing.T) {
	base := t.TempDir()
	root := filepath.Join(base, "apps", "site")
	if err := os.MkdirAll(filepath.Join(root, "assets"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("home"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "assets", "app.js"), []byte("asset"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "404.html"), []byte("custom missing"), 0o600); err != nil {
		t.Fatal(err)
	}
	cacheSeconds := 120
	record := externalapps.Record{
		ID: "0123456789ab", Template: "archive", Domain: "app.example.com", Enabled: true,
		Runtime: "static", Root: root, MaxRequestBodyMB: 1, StaticCacheSeconds: &cacheSeconds, NotFoundFile: "404.html",
	}
	data, err := json.Marshal(record)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(base, ".metadata"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(base, ".metadata", record.ID+".json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	handler := &externalAppAwareHandler{apps: externalapps.New(externalapps.Config{BaseDir: base}, nil), next: http.NotFoundHandler()}

	request := httptest.NewRequest(http.MethodGet, "https://app.example.com/assets/app.js", nil)
	request.Host = "app.example.com"
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK || response.Header().Get("Cache-Control") != "public, max-age=120" {
		t.Fatalf("asset response=%d cache=%q", response.Code, response.Header().Get("Cache-Control"))
	}

	request = httptest.NewRequest(http.MethodGet, "https://app.example.com/missing", nil)
	request.Host = "app.example.com"
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusNotFound || strings.TrimSpace(response.Body.String()) != "custom missing" {
		t.Fatalf("404 response=%d %q", response.Code, response.Body.String())
	}

	request = httptest.NewRequest(http.MethodPost, "https://app.example.com/", strings.NewReader("small"))
	request.Host = "app.example.com"
	request.ContentLength = (1 << 20) + 1
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversized response=%d", response.Code)
	}
}

func TestExternalAppFastCGILocationDefaultsTo302(t *testing.T) {
	response := httptest.NewRecorder()
	if err := writeExternalAppFastCGIResponse(response, []byte("Location: /login\r\n\r\n")); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusFound || response.Header().Get("Location") != "/login" {
		t.Fatalf("redirect = %d %q", response.Code, response.Header().Get("Location"))
	}
}

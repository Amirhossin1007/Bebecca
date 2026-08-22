package api

import (
	"archive/zip"
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	certificateapp "github.com/rebeccapanel/rebecca/internal/app/certificates"
)

func TestExtractPHPAppArchiveAndDetectRuntime(t *testing.T) {
	archive := phpAppTestZIP(t, map[string]string{
		"site/index.php":        "<?php echo 'ok';",
		"site/assets/style.css": "body{}",
	})
	root, err := extractPHPAppArchive(archive, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(root) != "site" {
		t.Fatalf("root=%q", root)
	}
	runtime, err := detectPHPAppRuntime(root)
	if err != nil || runtime != "php" {
		t.Fatalf("runtime=%q err=%v", runtime, err)
	}
}

func TestExtractPHPAppArchiveRejectsUnsafeContent(t *testing.T) {
	t.Run("traversal", func(t *testing.T) {
		archive := phpAppTestZIP(t, map[string]string{"../escape.php": "bad"})
		if _, err := extractPHPAppArchive(archive, t.TempDir()); err == nil {
			t.Fatal("traversal archive was accepted")
		}
	})
	t.Run("missing index", func(t *testing.T) {
		archive := phpAppTestZIP(t, map[string]string{"site/readme.txt": "no index"})
		root, err := extractPHPAppArchive(archive, t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		if _, err := detectPHPAppRuntime(root); err == nil {
			t.Fatal("archive without an index was accepted")
		}
	})
}

func TestPHPAppAwareHandlerRoutesByHostAndProtectsFiles(t *testing.T) {
	root := t.TempDir()
	secondRoot := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "index.html"), []byte("hosted application"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "config.php"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	outside := filepath.Join(t.TempDir(), "outside.txt")
	if err := os.WriteFile(outside, []byte("outside secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(root, "leak.txt")); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(secondRoot, "index.html"), []byte("second application"), 0o644); err != nil {
		t.Fatal(err)
	}
	manager := &phpAppManager{apps: map[string]phpAppRecord{
		"app.example.com": {
			Template: "archive", Domain: "app.example.com", Enabled: true,
			Runtime: "static", Root: root,
		},
		"second.example.com": {
			Template: "archive", Domain: "second.example.com", Enabled: true,
			Runtime: "static", Root: secondRoot,
		},
	}}
	handler := &phpAppAwareHandler{
		apps: manager,
		next: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusTeapot)
		}),
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "https://app.example.com/", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "hosted application" {
		t.Fatalf("hosted status=%d body=%q", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatal("security headers were not set")
	}
	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "https://second.example.com/", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusOK || recorder.Body.String() != "second application" {
		t.Fatalf("second hosted status=%d body=%q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "https://app.example.com/config.php", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound {
		t.Fatalf("protected file status=%d", recorder.Code)
	}

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "https://app.example.com/leak.txt", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusNotFound || strings.Contains(recorder.Body.String(), "outside secret") {
		t.Fatalf("escaped symlink status=%d body=%q", recorder.Code, recorder.Body.String())
	}

	recorder = httptest.NewRecorder()
	request = httptest.NewRequest(http.MethodGet, "https://panel.example.com/", nil)
	handler.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusTeapot {
		t.Fatalf("unknown host status=%d", recorder.Code)
	}
}

func TestPHPAppAwareHandlerKeepsDisabledDomainReserved(t *testing.T) {
	manager := &phpAppManager{apps: map[string]phpAppRecord{
		"off.example.com": {Domain: "off.example.com", Enabled: false},
	}}
	handler := &phpAppAwareHandler{apps: manager, next: http.NotFoundHandler()}
	if !handler.HandlesHost("off.example.com:443") {
		t.Fatal("disabled app domain was not reserved")
	}
	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "https://off.example.com/dashboard/", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d", recorder.Code)
	}
}

func TestMirzaRequestSecretsAreIndependent(t *testing.T) {
	base := t.TempDir()
	manager := &phpAppManager{baseDir: base, apps: map[string]phpAppRecord{}}
	domain := "bot.example.com"
	if err := manager.writeSecrets(domain, phpAppSecrets{
		WebhookSecret: "webhook-secret",
		CronSecret:    "cron-secret",
	}); err != nil {
		t.Fatal(err)
	}
	record := phpAppRecord{Domain: domain, Template: "mirzabot"}

	webhook := httptest.NewRequest(http.MethodPost, "https://bot.example.com/index.php", nil)
	if err := manager.authorizeMirzaRequest(webhook, record, "index.php"); err == nil {
		t.Fatal("webhook without secret was accepted")
	}
	webhook.Header.Set("X-Telegram-Bot-Api-Secret-Token", "webhook-secret")
	if err := manager.authorizeMirzaRequest(webhook, record, "index.php"); err != nil {
		t.Fatal(err)
	}

	cron := httptest.NewRequest(http.MethodGet, "https://bot.example.com/cronbot/statusday.php", nil)
	cron.Header.Set("X-Rebecca-Cron-Secret", "webhook-secret")
	if err := manager.authorizeMirzaRequest(cron, record, "cronbot/statusday.php"); err == nil {
		t.Fatal("webhook secret was accepted as cron secret")
	}
	cron.Header.Set("X-Rebecca-Cron-Secret", "cron-secret")
	if err := manager.authorizeMirzaRequest(cron, record, "cronbot/statusday.php"); err != nil {
		t.Fatal(err)
	}
}

func TestMirzaBotTokenCannotBeReused(t *testing.T) {
	manager := &phpAppManager{baseDir: t.TempDir(), apps: map[string]phpAppRecord{
		"one.example.com": {Domain: "one.example.com", Template: "mirzabot"},
	}}
	if err := manager.writeSecrets("one.example.com", phpAppSecrets{BotToken: "existing-token"}); err != nil {
		t.Fatal(err)
	}
	if err := manager.ensureBotTokenAvailable("existing-token"); err == nil {
		t.Fatal("duplicate Telegram bot token was accepted")
	}
	if err := manager.ensureBotTokenAvailable("different-token"); err != nil {
		t.Fatal(err)
	}
}

func TestWriteMirzaCronUsesPerAppIdentityWithoutEmbeddingSecret(t *testing.T) {
	root := t.TempDir()
	record := phpAppRecord{
		Domain:     "bot.example.com",
		Root:       root,
		SystemUser: "rbphp_abcdef",
		CronConfig: filepath.Join(t.TempDir(), "rebecca-php-abcdef"),
	}
	if err := writeMirzaCron(record); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(record.CronConfig)
	if err != nil {
		t.Fatal(err)
	}
	text := string(content)
	if strings.Count(text, "https://bot.example.com/cronbot/") != len(mirzaCronTasks) {
		t.Fatalf("cron task count mismatch:\n%s", text)
	}
	if !strings.Contains(text, "rbphp_abcdef") || !strings.Contains(text, ".rebecca-cron-secret") {
		t.Fatalf("cron identity/secret file missing:\n%s", text)
	}
	if strings.Contains(text, "super-secret-value") {
		t.Fatal("cron secret was embedded in the world-readable cron definition")
	}
}

func TestWritePHPAppPoolBoundsResources(t *testing.T) {
	record := phpAppRecord{
		Root:       t.TempDir(),
		SystemUser: "rbphp_abcdef",
		Socket:     "/run/php/rebecca-abcdef.sock",
		PoolConfig: filepath.Join(t.TempDir(), "rebecca-abcdef.conf"),
	}
	if err := writePHPAppPool(record, false); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(record.PoolConfig)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "pm.max_children = 2") ||
		!strings.Contains(string(content), "memory_limit] = 256M") ||
		!strings.Contains(string(content), "env[PATH] = /usr/local/sbin") {
		t.Fatalf("PHP-FPM resource limits are missing:\n%s", content)
	}
}

func TestPHPAppFastCGIOutputLimit(t *testing.T) {
	if fastCGIOutputExceeds(maxPHPAppResponseBytes, int(maxPHPAppResponseBytes)-1, 1) {
		t.Fatal("response at the limit was rejected")
	}
	if !fastCGIOutputExceeds(maxPHPAppResponseBytes, int(maxPHPAppResponseBytes), 1) {
		t.Fatal("oversized response was accepted")
	}
}

func TestPHPAppFastCGILocationDefaultsToRedirect(t *testing.T) {
	response := httptest.NewRecorder()
	if err := writePHPAppFastCGIResponse(response, []byte("Location: /login\r\nContent-Type: text/plain\r\n\r\nok")); err != nil {
		t.Fatal(err)
	}
	if response.Code != http.StatusFound || response.Header().Get("Location") != "/login" {
		t.Fatalf("status=%d location=%q", response.Code, response.Header().Get("Location"))
	}
}

func TestMirzaBotConfigEscapesPHPStrings(t *testing.T) {
	config := mirzaBotConfig("db", "user", "pa'ss", "12345:abcdefghijklmnopqrstuvwxyz", "12345", "bot.example.com", "bot")
	if !strings.Contains(config, "$passworddb = 'pa\\'ss';") {
		t.Fatalf("password was not escaped: %s", config)
	}
	if strings.Contains(config, "PDOException $e) { error_log('Database connection failed: ") {
		t.Fatal("generated config exposes database errors")
	}
}

func TestMySQLOptionFileValueEscapesCredentials(t *testing.T) {
	input := "pa#ss;word\\\"\nnext"
	if value := mysqlOptionFileValue(input); value != strconv.Quote(input) {
		t.Fatalf("escaped option value = %q", value)
	}
}

func phpAppTestZIP(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := zip.NewWriter(&buffer)
	for name, content := range files {
		file, err := writer.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := file.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func TestPHPAppManagerReloadRejectsEscapedRoots(t *testing.T) {
	manager := &phpAppManager{baseDir: t.TempDir(), apps: map[string]phpAppRecord{}}
	if err := manager.prepareStorage(); err != nil {
		t.Fatal(err)
	}
	record := phpAppRecord{Template: "archive", Domain: "bad.example.com", Runtime: "static", Root: "/etc"}
	if err := writePrivateJSON(manager.recordPath(domainHash(record.Domain)), record); err != nil {
		t.Fatal(err)
	}
	manager.reload()
	if _, ok := manager.lookup(record.Domain); ok {
		t.Fatal("escaped application root was loaded")
	}
}

func TestPHPAppCertificateContainsPrimaryAndSAN(t *testing.T) {
	record := certificateapp.Record{Domain: "one.example.com", AltNames: []string{"two.example.com"}}
	if !phpAppCertificateContains(record, "one.example.com") || !phpAppCertificateContains(record, "two.example.com") {
		t.Fatal("managed certificate names were not available to PHP applications")
	}
	if phpAppCertificateContains(record, "other.example.com") {
		t.Fatal("unmanaged certificate name was accepted")
	}
}

func TestPHPAppCannotReplaceCurrentPanelHost(t *testing.T) {
	request := httptest.NewRequest(http.MethodPost, "https://panel.example.com/api/settings/php-apps/mirzabot", nil)
	if !phpAppUsesCurrentPanelHost(request, "panel.example.com") {
		t.Fatal("current panel hostname was accepted for an application")
	}
	if phpAppUsesCurrentPanelHost(request, "bot.example.com") {
		t.Fatal("independent application hostname was rejected")
	}
}

func TestDownloadMirzaBotUsesLatestStableReleaseCommit(t *testing.T) {
	const commit = "0123456789abcdef0123456789abcdef01234567"
	archive := phpAppTestZIP(t, map[string]string{
		"mirzabot/composer.json": "{}", "mirzabot/composer.lock": "{}",
		"mirzabot/table.php": "<?php", "mirzabot/config.php": "<?php", "mirzabot/index.php": "<?php",
	})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") != "Rebecca" {
			t.Errorf("user-agent=%q", r.Header.Get("User-Agent"))
		}
		switch r.URL.Path {
		case "/releases/latest":
			_, _ = w.Write([]byte(`{"tag_name":"0.3.1","draft":false,"prerelease":false}`))
		case "/commits/0.3.1":
			_, _ = w.Write([]byte(`{"sha":"` + commit + `"}`))
		case "/zip/" + commit:
			_, _ = w.Write(archive)
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()
	manager := &phpAppManager{httpClient: server.Client(), mirzaAPIBase: server.URL, mirzaArchive: server.URL}
	source, err := manager.downloadMirzaBot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if source.Version != "0.3.1" || source.SHA != commit || !bytes.Equal(source.Archive, archive) {
		t.Fatalf("source=%+v", source)
	}
	if _, err := extractMirzaBotArchive(source.Archive, t.TempDir()); err != nil {
		t.Fatal(err)
	}
}

func TestDownloadMirzaBotRejectsPrerelease(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"tag_name":"0.4.0","prerelease":true}`))
	}))
	defer server.Close()
	manager := &phpAppManager{httpClient: server.Client(), mirzaAPIBase: server.URL, mirzaArchive: server.URL}
	if _, err := manager.downloadMirzaBot(context.Background()); err == nil {
		t.Fatal("prerelease was accepted as latest stable")
	}
}

func TestLatestMirzaBotReleaseArchive(t *testing.T) {
	if os.Getenv("REBECCA_TEST_LATEST_MIRZABOT") != "1" {
		t.Skip("set REBECCA_TEST_LATEST_MIRZABOT=1 to verify the current stable GitHub release")
	}
	manager := newPHPAppManager(Config{PHPAppsBase: t.TempDir()}, nil)
	source, err := manager.downloadMirzaBot(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if !mirzaReleasePattern.MatchString(source.Version) || !mirzaCommitPattern.MatchString(source.SHA) {
		t.Fatalf("invalid release metadata: version=%q sha=%q", source.Version, source.SHA)
	}
	if _, err := extractMirzaBotArchive(source.Archive, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	t.Logf("validated MirzaBot %s at %s", source.Version, source.SHA)
}

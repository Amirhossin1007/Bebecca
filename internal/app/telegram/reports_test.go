package telegram

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReporterSendsLegacyUserCreatedWhenEnabled(t *testing.T) {
	ctx := context.Background()
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, "")

	payloads := make(chan map[string]any, 1)
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottoken/sendMessage" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		payloads <- payload
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	reporter := NewReporter(repo, sender)
	limit := int64(1024)
	reporter.UserCreated(ctx, UserReport{
		Username:      "alice",
		Owner:         "owner",
		Actor:         "pouria",
		DataLimit:     &limit,
		ResetStrategy: "month",
		Proxies:       []string{"vless", "vmess"},
	})

	var payload map[string]any
	select {
	case payload = <-payloads:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for Telegram report")
	}
	text, _ := payload["text"].(string)
	if payload["chat_id"].(float64) != -1001 || payload["message_thread_id"].(float64) != 42 {
		t.Fatalf("unexpected destination payload: %#v", payload)
	}
	for _, needle := range []string{"<b>#UserCreated</b>", "<b>Username:</b> <code>alice</code>", "<b>Belongs To:</b> <code>owner</code>", "<b>By:</b> <code>#pouria</code>"} {
		if !strings.Contains(text, needle) {
			t.Fatalf("message missing %q:\n%s", needle, text)
		}
	}
}

func TestReporterSkipsDisabledToggle(t *testing.T) {
	ctx := context.Background()
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, `api_token = 'token', use_telegram = 1, logs_chat_id = -1001, event_toggles = '{"user.created":false}'`)

	calls := 0
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	NewReporter(repo, sender).UserCreated(ctx, UserReport{Username: "alice", Actor: "pouria"})
	if calls != 0 {
		t.Fatalf("expected disabled toggle to skip Telegram, got %d calls", calls)
	}
	assertTelegramColumnEmpty(t, db, "last_error")
}

func TestReporterMissingChatIDDoesNotCrashOrRecordError(t *testing.T) {
	ctx := context.Background()
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, `api_token = 'token', use_telegram = 1, admin_chat_ids = '[]', logs_chat_id = NULL, event_toggles = '{}'`)

	calls := 0
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	NewReporter(repo, sender).Login(ctx, LoginReport{Username: "alice", Success: false})
	if calls != 0 {
		t.Fatalf("expected missing destination to skip Telegram, got %d calls", calls)
	}
	assertTelegramColumnEmpty(t, db, "last_error")
}

func TestReporterTelegramErrorDoesNotFailMutationPath(t *testing.T) {
	ctx := context.Background()
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, "")

	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`{"ok":false,"description":"temporary bad gateway"}`))
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	NewReporter(repo, sender).AdminDeleted(ctx, AdminReport{Username: "oldadmin", Actor: "pouria"})
	deadline := time.Now().Add(time.Second)
	for {
		var value sql.NullString
		if err := db.QueryRow(`SELECT last_error FROM telegram_settings WHERE id = 1`).Scan(&value); err != nil {
			t.Fatal(err)
		}
		if value.Valid && strings.Contains(value.String, "temporary bad gateway") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("expected last_error to contain %q, got %q", "temporary bad gateway", value.String)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

func TestReporterDoesNotBlockOnTelegramAndSurvivesRequestCancellation(t *testing.T) {
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, "")

	started := make(chan struct{})
	release := make(chan struct{})
	done := make(chan struct{})
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-release
		_, _ = w.Write([]byte(`{"ok":true}`))
		close(done)
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	requestCtx, cancel := context.WithCancel(context.Background())
	NewReporter(repo, sender).UserCreated(requestCtx, UserReport{Username: "alice"})
	cancel()

	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("background Telegram request did not start")
	}
	close(release)
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("background Telegram request was canceled with its caller")
	}
}

func TestReporterSkipsWhenTelegramDisabled(t *testing.T) {
	ctx := context.Background()
	db, repo := testTelegramRepo(t)
	seedTelegramSettings(t, db, `api_token = 'token', use_telegram = 0, admin_chat_ids = '[111]', event_toggles = '{}'`)

	calls := 0
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		_, _ = w.Write([]byte(`{"ok":true}`))
	}))
	defer api.Close()

	sender := NewSender(repo, api.URL)
	sender.retryDelays = nil
	NewReporter(repo, sender).NodeUsageReset(ctx, NodeReport{Name: "node-1", Actor: "pouria"})
	if calls != 0 {
		t.Fatalf("expected disabled Telegram to skip, got %d calls", calls)
	}
}

func assertNullOrEmpty(t *testing.T, db *sql.DB, column string) {
	t.Helper()
	var value sql.NullString
	if err := db.QueryRow(`SELECT ` + column + ` FROM telegram_settings WHERE id = 1`).Scan(&value); err != nil {
		t.Fatal(err)
	}
	if value.Valid && strings.TrimSpace(value.String) != "" {
		t.Fatalf("expected %s to be empty, got %q", column, value.String)
	}
}

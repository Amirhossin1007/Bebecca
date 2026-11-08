package admin

import (
	"context"
	"testing"
	"time"
)

func TestDeviceMayManageAccount(t *testing.T) {
	now := time.Date(2026, 6, 4, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name     string
		created  time.Time
		others   int
		expected bool
	}{
		{"only device is itself", now.Add(-time.Minute), 0, true},
		{"new device with other devices", now.Add(-time.Hour), 1, false},
		{"exactly 24 hours old with other devices", now.Add(-NewDeviceWaitPeriod), 2, true},
		{"old device with other devices", now.Add(-48 * time.Hour), 3, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := DeviceMayManageAccount(tc.created, tc.others, now); got != tc.expected {
				t.Fatalf("DeviceMayManageAccount = %v, want %v", got, tc.expected)
			}
		})
	}
}

func TestIsAuthRejectionSeparatesSessionFailuresFromTransientErrors(t *testing.T) {
	if !IsAuthRejection(ErrInvalidToken) || !IsAuthRejection(ErrSessionExpired) || !IsAuthRejection(ErrAdminDisabled) {
		t.Fatal("session and admin rejections must be recognised")
	}
	if IsAuthRejection(context.DeadlineExceeded) {
		t.Fatal("a transient error must not be treated as a rejected session")
	}
}

func TestSessionStaysValidAfterLongInactivity(t *testing.T) {
	ctx := context.Background()
	repo, db := testAdminRepository(t)
	insertAdmin(t, db, "pouria", RoleFullAccess, StatusActive)
	now := time.Date(2026, 6, 4, 12, 0, 0, 0, time.UTC)
	if _, err := repo.CreateSession(ctx, AdminSession{
		AdminID:    1,
		State:      SessionActive,
		CreatedAt:  now.Add(-10 * 24 * time.Hour),
		LastSeenAt: now.Add(-5 * 24 * time.Hour),
		ExpiresAt:  now.Add(60 * 24 * time.Hour),
	}, "idle-token"); err != nil {
		t.Fatal(err)
	}
	auth := NewAuthenticator(repo, WithClock(func() time.Time { return now }))
	if _, err := auth.AuthenticateSession(ctx, "idle-token"); err != nil {
		t.Fatalf("session idle for five days must stay valid until it expires: %v", err)
	}
}

func TestCountOtherActiveSessionsIgnoresCurrentRevokedAndExpired(t *testing.T) {
	ctx := context.Background()
	repo, db := testAdminRepository(t)
	insertAdmin(t, db, "pouria", RoleFullAccess, StatusActive)
	now := time.Date(2026, 6, 4, 12, 0, 0, 0, time.UTC)
	create := func(token string, state SessionState, expires time.Time) int64 {
		session, err := repo.CreateSession(ctx, AdminSession{
			AdminID: 1, State: state, CreatedAt: now.Add(-time.Hour), LastSeenAt: now, ExpiresAt: expires,
		}, token)
		if err != nil {
			t.Fatal(err)
		}
		return session.ID
	}
	current := create("current", SessionActive, now.Add(time.Hour))
	create("other", SessionActive, now.Add(time.Hour))
	create("expired", SessionActive, now.Add(-time.Hour))
	create("pending", SessionPending2FA, now.Add(time.Hour))
	revoked := create("revoked", SessionActive, now.Add(time.Hour))
	if _, err := db.Exec(`UPDATE admin_sessions SET revoked_at = ? WHERE id = ?`, dbTime(now), revoked); err != nil {
		t.Fatal(err)
	}

	count, err := repo.CountOtherActiveSessions(ctx, 1, current, now)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("other active sessions = %d, want 1", count)
	}
}

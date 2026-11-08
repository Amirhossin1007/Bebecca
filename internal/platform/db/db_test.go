package db

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestSQLiteConnectionsUseBusyTimeoutAndWAL(t *testing.T) {
	pool, err := Open("sqlite:///" + filepath.Join(t.TempDir(), "pragmas.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pool.DB.Close() })
	var busy int
	if err := pool.DB.QueryRow(`PRAGMA busy_timeout`).Scan(&busy); err != nil {
		t.Fatal(err)
	}
	if busy != 30000 {
		t.Fatalf("busy_timeout=%d want 30000", busy)
	}
	var mode string
	if err := pool.DB.QueryRow(`PRAGMA journal_mode`).Scan(&mode); err != nil {
		t.Fatal(err)
	}
	if mode != "wal" {
		t.Fatalf("journal_mode=%q want wal", mode)
	}
}

func TestSQLiteWriterWaitsForLockedDatabase(t *testing.T) {
	ctx := context.Background()
	pool, err := Open("sqlite:///" + filepath.Join(t.TempDir(), "locks.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = pool.DB.Close() })
	if _, err := pool.DB.ExecContext(ctx, `CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)`); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.DB.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO items (value) VALUES ('held')`); err != nil {
		t.Fatal(err)
	}
	written := make(chan error, 1)
	go func() {
		_, err := pool.DB.ExecContext(ctx, `INSERT INTO items (value) VALUES ('waiting')`)
		written <- err
	}()
	time.Sleep(300 * time.Millisecond)
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-written:
		if err != nil {
			t.Fatalf("a concurrent writer must wait for the lock instead of failing: %v", err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("concurrent writer did not finish after the lock was released")
	}
}

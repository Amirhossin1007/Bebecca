package certificates

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"encoding/pem"
	"errors"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func newNodeTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", "file:"+filepath.Join(t.TempDir(), "certificates.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	for _, statement := range []string{
		`CREATE TABLE admins (id INTEGER PRIMARY KEY, status TEXT NOT NULL)`,
		`CREATE TABLE subscription_domains (
			id INTEGER PRIMARY KEY AUTOINCREMENT, domain TEXT NOT NULL UNIQUE,
			admin_id INTEGER NULL, email TEXT NULL, provider TEXT NULL, alt_names TEXT NULL,
			last_issued_at DATETIME NULL, last_renewed_at DATETIME NULL,
			created_at DATETIME NULL, updated_at DATETIME NULL
		)`,
		`INSERT INTO admins (id, status) VALUES (7, 'active')`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	return db
}

func writeNodeTestCertificate(t *testing.T, name string, notAfter time.Time) ([]byte, []byte) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(now.UnixNano()),
		Subject:      pkix.Name{CommonName: name},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     notAfter,
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	if ip := net.ParseIP(name); ip != nil {
		template.IPAddresses = []net.IP{ip}
	} else {
		template.DNSNames = []string{name}
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER})
}

func writeNodeManagedCertificate(t *testing.T, db *sql.DB, base, name string, notAfter time.Time, metadata string) {
	t.Helper()
	dir := filepath.Join(ManagedBaseDir(base), name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	fullchain, privateKey := writeNodeTestCertificate(t, name, notAfter)
	if err := os.WriteFile(filepath.Join(dir, "fullchain.pem"), fullchain, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "privkey.pem"), privateKey, 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, ".metadata"), []byte(metadata), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO subscription_domains (domain, admin_id, email, provider, alt_names, created_at, updated_at) VALUES (?, 7, 'ops@example.com', 'letsencrypt', '[]', ?, ?)`, name, time.Now().UTC(), time.Now().UTC()); err != nil {
		t.Fatal(err)
	}
}

func TestIssueFromNodeStoresCertificateOnMaster(t *testing.T) {
	db := newNodeTestDB(t)
	base := t.TempDir()
	fullchain, privateKey := writeNodeTestCertificate(t, "203.0.113.10", time.Now().UTC().Add(6*24*time.Hour))
	manager := NewManager(db, Config{BaseDir: base})
	var gotNodeID int64
	var gotIdentifier, gotEmail string
	manager.SetNodeIssuer(func(ctx context.Context, nodeID int64, identifier, email string) ([]byte, []byte, error) {
		gotNodeID, gotIdentifier, gotEmail = nodeID, identifier, email
		return fullchain, privateKey, nil
	})
	adminID := int64(7)
	record, err := manager.IssueFromNode(context.Background(), NodeIssueRequest{
		NodeID: 3, Identifier: " 203.0.113.10 ", Email: "ops@example.com", AdminID: &adminID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotNodeID != 3 || gotIdentifier != "203.0.113.10" || gotEmail != "ops@example.com" {
		t.Fatalf("issuer got node=%d identifier=%q email=%q", gotNodeID, gotIdentifier, gotEmail)
	}
	if record.Domain != "203.0.113.10" || record.NodeID == nil || *record.NodeID != 3 || !record.AutoRenew || record.Status != "active" {
		t.Fatalf("unexpected record: %+v", record)
	}
	if _, err := os.Stat(filepath.Join(ManagedBaseDir(base), "203.0.113.10", "privkey.pem")); err != nil {
		t.Fatal(err)
	}
}

func TestIssueFromNodeStoresDomainCertificate(t *testing.T) {
	db := newNodeTestDB(t)
	base := t.TempDir()
	fullchain, privateKey := writeNodeTestCertificate(t, "api.example.com", time.Now().UTC().Add(90*24*time.Hour))
	manager := NewManager(db, Config{BaseDir: base})
	var gotIdentifier string
	manager.SetNodeIssuer(func(_ context.Context, _ int64, identifier, _ string) ([]byte, []byte, error) {
		gotIdentifier = identifier
		return fullchain, privateKey, nil
	})
	record, err := manager.IssueFromNode(context.Background(), NodeIssueRequest{
		NodeID: 3, Identifier: " API.Example.com ", Email: "ops@example.com",
	})
	if err != nil {
		t.Fatal(err)
	}
	if gotIdentifier != "api.example.com" || record.Domain != "api.example.com" || record.NodeID == nil || *record.NodeID != 3 || !record.AutoRenew {
		t.Fatalf("issuer got %q, unexpected record: %+v", gotIdentifier, record)
	}
	if _, err := os.Stat(filepath.Join(ManagedBaseDir(base), "api.example.com", "privkey.pem")); err != nil {
		t.Fatal(err)
	}
}

func TestIssueFromNodeRejectsInvalidIdentifier(t *testing.T) {
	db := newNodeTestDB(t)
	manager := NewManager(db, Config{BaseDir: t.TempDir()})
	manager.SetNodeIssuer(func(context.Context, int64, string, string) ([]byte, []byte, error) {
		t.Fatal("issuer must not run for an invalid identifier")
		return nil, nil, nil
	})
	if _, err := manager.IssueFromNode(context.Background(), NodeIssueRequest{NodeID: 3, Identifier: "https://example.com/x", Email: "ops@example.com"}); err == nil {
		t.Fatal("expected an invalid identifier to be rejected")
	}
}

func TestIssueFromNodeWrapsNodeFailure(t *testing.T) {
	db := newNodeTestDB(t)
	manager := NewManager(db, Config{BaseDir: t.TempDir()})
	manager.SetNodeIssuer(func(context.Context, int64, string, string) ([]byte, []byte, error) {
		return nil, nil, errors.New("port 80 is busy")
	})
	_, err := manager.IssueFromNode(context.Background(), NodeIssueRequest{NodeID: 3, Identifier: "203.0.113.10", Email: "ops@example.com"})
	if !errors.Is(err, ErrNodeIssue) {
		t.Fatalf("err = %v, want ErrNodeIssue", err)
	}
}

func TestRenewDueRenewsNodeCertificateInsideRenewWindow(t *testing.T) {
	db := newNodeTestDB(t)
	base := t.TempDir()
	writeNodeManagedCertificate(t, db, base, "203.0.113.10", time.Now().UTC().Add(time.Hour), "issued_via_node=3\nstatus=active\n")
	manager := NewManager(db, Config{BaseDir: base})
	calls := 0
	manager.SetNodeIssuer(func(context.Context, int64, string, string) ([]byte, []byte, error) {
		calls++
		fullchain, privateKey := writeNodeTestCertificate(t, "203.0.113.10", time.Now().UTC().Add(6*24*time.Hour))
		return fullchain, privateKey, nil
	})
	if errs := manager.RenewDue(context.Background(), time.Now().UTC().Add(30*24*time.Hour)); len(errs) != 0 {
		t.Fatal(errs)
	}
	if calls != 1 {
		t.Fatalf("issuer calls = %d, want 1", calls)
	}
}

func TestRenewDueRenewsNodeDomainCertificateBeforeRenewBefore(t *testing.T) {
	db := newNodeTestDB(t)
	base := t.TempDir()
	writeNodeManagedCertificate(t, db, base, "api.example.com", time.Now().UTC().Add(20*24*time.Hour), "issued_via_node=3\nstatus=active\n")
	manager := NewManager(db, Config{BaseDir: base})
	calls := 0
	manager.SetNodeIssuer(func(context.Context, int64, string, string) ([]byte, []byte, error) {
		calls++
		fullchain, privateKey := writeNodeTestCertificate(t, "api.example.com", time.Now().UTC().Add(90*24*time.Hour))
		return fullchain, privateKey, nil
	})
	if errs := manager.RenewDue(context.Background(), time.Now().UTC().Add(30*24*time.Hour)); len(errs) != 0 {
		t.Fatal(errs)
	}
	if calls != 1 {
		t.Fatalf("issuer calls = %d, want 1", calls)
	}
}

func TestRenewDueKeepsNodeCertificateOutsideRenewWindow(t *testing.T) {
	db := newNodeTestDB(t)
	base := t.TempDir()
	writeNodeManagedCertificate(t, db, base, "203.0.113.10", time.Now().UTC().Add(5*24*time.Hour), "issued_via_node=3\nstatus=active\n")
	manager := NewManager(db, Config{BaseDir: base})
	calls := 0
	manager.SetNodeIssuer(func(context.Context, int64, string, string) ([]byte, []byte, error) {
		calls++
		return nil, nil, errors.New("must not renew early")
	})
	if errs := manager.RenewDue(context.Background(), time.Now().UTC().Add(30*24*time.Hour)); len(errs) != 0 {
		t.Fatal(errs)
	}
	if calls != 0 {
		t.Fatalf("issuer calls = %d, want 0", calls)
	}
}

package certificates

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"database/sql"
	"encoding/pem"
	"errors"
	"io"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestResolverSelectsManagedCertificateBySNI(t *testing.T) {
	base := t.TempDir()
	fallbackCert, fallbackKey := writeCertificate(t, filepath.Join(base, "fallback"), "panel.example.com")
	writeCertificate(t, filepath.Join(base, "bot.example.com"), "bot.example.com")

	resolver, err := NewResolver(base, fallbackCert, fallbackKey)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := resolver.GetCertificate(clientHello("bot.example.com"))
	if err != nil {
		t.Fatal(err)
	}
	if err := selected.Leaf.VerifyHostname("bot.example.com"); err != nil {
		t.Fatalf("wrong SNI certificate selected: %v", err)
	}
	fallback, err := resolver.GetCertificate(clientHello("unknown.example.com"))
	if err != nil {
		t.Fatal(err)
	}
	if err := fallback.Leaf.VerifyHostname("panel.example.com"); err != nil {
		t.Fatalf("configured fallback was not selected: %v", err)
	}
}

func TestResolverSkipsRevokedCertificate(t *testing.T) {
	base := t.TempDir()
	fallbackCert, fallbackKey := writeCertificate(t, filepath.Join(base, "panel.example.com"), "panel.example.com")
	revokedDir := filepath.Join(base, "revoked.example.com")
	writeCertificate(t, revokedDir, "revoked.example.com")
	if err := os.WriteFile(filepath.Join(revokedDir, ".metadata"), []byte("status=revoked\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	resolver, err := NewResolver(base, fallbackCert, fallbackKey)
	if err != nil {
		t.Fatal(err)
	}
	selected, err := resolver.GetCertificate(clientHello("revoked.example.com"))
	if err != nil {
		t.Fatal(err)
	}
	if err := selected.Leaf.VerifyHostname("panel.example.com"); err != nil {
		t.Fatalf("revoked certificate remained active: %v", err)
	}
}

func TestResolverStopsServingRevokedConfiguredFallback(t *testing.T) {
	for _, status := range []string{"revoking", "revoked"} {
		t.Run(status, func(t *testing.T) {
			base := t.TempDir()
			revokedDir := filepath.Join(base, "panel.example.com")
			fallbackCert, fallbackKey := writeCertificate(t, revokedDir, "panel.example.com")
			writeCertificate(t, filepath.Join(base, "active.example.com"), "active.example.com")
			if err := os.WriteFile(filepath.Join(revokedDir, ".metadata"), []byte("status="+status+"\n"), 0o600); err != nil {
				t.Fatal(err)
			}

			resolver, err := NewResolver(base, fallbackCert, fallbackKey)
			if err != nil {
				t.Fatal(err)
			}
			selected, err := resolver.GetCertificate(clientHello("panel.example.com"))
			if err != nil {
				t.Fatal(err)
			}
			if selected.Leaf.VerifyHostname("panel.example.com") == nil {
				t.Fatalf("%s configured fallback remained active", status)
			}
		})
	}
}

func TestResolverStopsServingDeletedConfiguredFallback(t *testing.T) {
	base := t.TempDir()
	fallbackCert, fallbackKey := writeCertificate(t, filepath.Join(base, "panel.example.com"), "panel.example.com")
	writeCertificate(t, filepath.Join(base, "active.example.com"), "active.example.com")
	resolver, err := NewResolver(base, fallbackCert, fallbackKey)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.RemoveAll(filepath.Dir(fallbackCert)); err != nil {
		t.Fatal(err)
	}
	resolver.refreshEvery = 0
	selected, err := resolver.GetCertificate(clientHello("panel.example.com"))
	if err != nil {
		t.Fatal(err)
	}
	if selected.Leaf.VerifyHostname("panel.example.com") == nil {
		t.Fatal("deleted configured fallback remained active")
	}
}

func TestZeroSSLEABAndSecretConfig(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != http.MethodPost || r.URL.Query().Get("access_key") != "secret-access" {
			t.Fatalf("unexpected EAB request: %s %s", r.Method, r.URL.String())
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       io.NopCloser(strings.NewReader(`{"success":1,"eab_kid":"kid","eab_hmac_key":"hmac"}`)),
			Header:     make(http.Header),
		}, nil
	})}

	manager := NewManager(nil, Config{ZeroSSLEABEndpoint: "https://zerossl.example/eab", HTTPClient: client})
	kid, hmacKey, err := manager.zeroSSLEAB(context.Background(), "secret-access")
	if err != nil {
		t.Fatal(err)
	}
	if kid != "kid" || hmacKey != "hmac" {
		t.Fatalf("unexpected EAB credentials: %q %q", kid, hmacKey)
	}
	path, err := writeSecretCertbotConfig(t.TempDir(), kid, hmacKey)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("secret config mode=%o", info.Mode().Perm())
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(content), "eab-kid = kid") || !strings.Contains(string(content), "eab-hmac-key = hmac") {
		t.Fatalf("unexpected secret config: %s", content)
	}

	manager.httpClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		return nil, errors.New("secret-access must not leak")
	})}
	if _, _, err := manager.zeroSSLEAB(context.Background(), "secret-access"); err == nil || strings.Contains(err.Error(), "secret-access") {
		t.Fatalf("ZeroSSL access key leaked in error: %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestNormalizeDomainsRejectsWildcardAndDeduplicates(t *testing.T) {
	domains, err := normalizeDomains([]string{"Example.COM.", "example.com", "sub.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(domains, ",") != "example.com,sub.example.com" {
		t.Fatalf("domains=%v", domains)
	}
	if _, err := normalizeDomains([]string{"*.example.com"}); err == nil {
		t.Fatal("expected HTTP-01 wildcard rejection")
	}
}

func TestManagerImportsListsAndDeletesManualCertificate(t *testing.T) {
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

	base := filepath.Join(t.TempDir(), "managed")
	sourceCert, sourceKey := writeCertificate(t, filepath.Join(t.TempDir(), "source"), "bot.example.com")
	fullchain, err := os.ReadFile(sourceCert)
	if err != nil {
		t.Fatal(err)
	}
	privateKey, err := os.ReadFile(sourceKey)
	if err != nil {
		t.Fatal(err)
	}
	adminID := int64(7)
	manager := NewManager(db, Config{BaseDir: base})
	record, err := manager.Import(context.Background(), ImportRequest{
		Domain: "bot.example.com", AdminID: &adminID,
		Fullchain: string(fullchain), PrivateKey: string(privateKey),
	})
	if err != nil {
		t.Fatal(err)
	}
	if record.Status == "invalid" || record.Status == "missing" || record.Provider == nil || *record.Provider != "manual" || record.AutoRenew {
		t.Fatalf("unexpected imported record: %#v", record)
	}
	originalFullchain, err := os.ReadFile(filepath.Join(base, record.Domain, "fullchain.pem"))
	if err != nil {
		t.Fatal(err)
	}
	replacementCert, replacementKey := writeCertificate(t, filepath.Join(t.TempDir(), "replacement"), record.Domain)
	replacementFullchain, err := os.ReadFile(replacementCert)
	if err != nil {
		t.Fatal(err)
	}
	replacementPrivateKey, err := os.ReadFile(replacementKey)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TRIGGER fail_certificate_update BEFORE UPDATE ON subscription_domains BEGIN SELECT RAISE(FAIL, 'blocked'); END`); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Import(context.Background(), ImportRequest{
		Domain: record.Domain, AdminID: &adminID,
		Fullchain: string(replacementFullchain), PrivateKey: string(replacementPrivateKey),
	}); err == nil {
		t.Fatal("expected database failure while replacing certificate")
	}
	if _, err := db.Exec(`DROP TRIGGER fail_certificate_update`); err != nil {
		t.Fatal(err)
	}
	currentFullchain, err := os.ReadFile(filepath.Join(base, record.Domain, "fullchain.pem"))
	if err != nil {
		t.Fatal(err)
	}
	if string(currentFullchain) != string(originalFullchain) {
		t.Fatal("database failure did not restore the previous certificate")
	}
	for _, name := range []string{"fullchain.pem", "privkey.pem", ".metadata"} {
		info, err := os.Stat(filepath.Join(base, "bot.example.com", name))
		if err != nil {
			t.Fatal(err)
		}
		if info.Mode().Perm() != 0o600 {
			t.Fatalf("%s mode=%o", name, info.Mode().Perm())
		}
	}
	if _, err := manager.Revoke(context.Background(), record.Domain); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("manual revoke error=%v", err)
	}
	if _, err := db.Exec(`UPDATE subscription_domains SET provider = 'letsencrypt' WHERE domain = ?`, record.Domain); err != nil {
		t.Fatal(err)
	}
	metadata := readMetadata(filepath.Join(base, record.Domain, ".metadata"))
	metadata["provider"] = "letsencrypt"
	metadata["certbot_cert_name"] = "rebecca-bot.example.com"
	if err := writeMetadata(filepath.Join(base, record.Domain), metadata); err != nil {
		t.Fatal(err)
	}
	manager.certbotBinary = "certbot-test"
	manager.run = func(_ context.Context, name string, args ...string) ([]byte, error) {
		if name != "certbot-test" || len(args) == 0 || args[0] != "revoke" {
			t.Fatalf("unexpected revoke command: %s %v", name, args)
		}
		return nil, nil
	}
	record, err = manager.Revoke(context.Background(), record.Domain)
	if err != nil {
		t.Fatal(err)
	}
	if record.Status != "revoked" {
		t.Fatalf("revoked record status=%q", record.Status)
	}
	if _, err := manager.Renew(context.Background(), record.Domain); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("revoked renew error=%v", err)
	}
	if err := manager.Delete(context.Background(), record.Domain); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Get(context.Background(), record.Domain); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted record lookup error=%v", err)
	}
	if _, err := os.Stat(filepath.Join(base, record.Domain)); !os.IsNotExist(err) {
		t.Fatalf("deleted certificate directory remains: %v", err)
	}
}

func clientHello(serverName string) *tls.ClientHelloInfo {
	return &tls.ClientHelloInfo{ServerName: serverName}
}

func writeCertificate(t *testing.T, dir, domain string) (string, string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	template := &x509.Certificate{
		SerialNumber: big.NewInt(now.UnixNano()),
		Subject:      pkix.Name{CommonName: domain},
		DNSNames:     []string{domain},
		NotBefore:    now.Add(-time.Hour),
		NotAfter:     now.Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	certPath := filepath.Join(dir, "fullchain.pem")
	keyPath := filepath.Join(dir, "privkey.pem")
	if err := os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}), 0o600); err != nil {
		t.Fatal(err)
	}
	return certPath, keyPath
}

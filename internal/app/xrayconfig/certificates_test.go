package xrayconfig

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestStreamCertificateDiagnosticsCheckPairValidityAndVerificationOnlyCA(t *testing.T) {
	public, private, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC().Truncate(time.Second)
	template := x509.Certificate{SerialNumber: big.NewInt(1), NotBefore: now.Add(-time.Hour), NotAfter: now.Add(time.Hour)}
	der, err := x509.CreateCertificate(rand.Reader, &template, &template, public, private)
	if err != nil {
		t.Fatal(err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		t.Fatal(err)
	}
	certificatePEM := string(pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}))
	keyPEM := string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}))
	inbound := func(cert map[string]any) map[string]any { return listOfMaps(tlsInboundPayload(cert)["inbounds"])[0] }
	for _, certificate := range []any{certificatePEM, strings.Split(certificatePEM, "\n")} {
		item := inbound(map[string]any{"certificate": certificate, "key": keyPEM})
		if err := StreamCertificateError(item, now); err != nil {
			t.Fatalf("valid inline certificate: %v", err)
		}
		if err := StreamCertificateError(item, now.Add(2*time.Hour)); err == nil || !strings.Contains(err.Error(), "expired") {
			t.Fatalf("expiry not detected: %v", err)
		}
		if err := StreamCertificateError(item, now.Add(-2*time.Hour)); err == nil || !strings.Contains(err.Error(), "not valid before") {
			t.Fatalf("future validity not detected: %v", err)
		}
	}
	dir := t.TempDir()
	certFile, keyFile := filepath.Join(dir, "cert.pem"), filepath.Join(dir, "key.pem")
	if err := os.WriteFile(certFile, []byte(certificatePEM), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyFile, []byte(keyPEM), 0600); err != nil {
		t.Fatal(err)
	}
	if err := StreamCertificateError(inbound(map[string]any{"certificateFile": certFile, "keyFile": keyFile}), now); err != nil {
		t.Fatal(err)
	}
	if err := StreamCertificateError(inbound(map[string]any{"certificate": certificatePEM, "key": "not-a-private-key"}), now); err == nil || !strings.Contains(err.Error(), "mismatched") {
		t.Fatalf("invalid pair not detected: %v", err)
	}
	if err := StreamCertificateError(inbound(map[string]any{"certificate": certificatePEM, "usage": "verify"}), now); err != nil {
		t.Fatalf("verification-only CA incorrectly required a private key: %v", err)
	}
}

func tlsInboundPayload(certificate map[string]any) map[string]any {
	return map[string]any{
		"inbounds": []any{
			map[string]any{
				"tag":      "VLESS_TLS",
				"protocol": "vless",
				"streamSettings": map[string]any{
					"security": "tls",
					"tlsSettings": map[string]any{
						"certificates": []any{certificate},
					},
				},
			},
		},
	}
}

func TestValidateCertificateFilesMissingFile(t *testing.T) {
	payload := tlsInboundPayload(map[string]any{
		"certificateFile": "/nonexistent/fullchain.pem",
		"keyFile":         "/nonexistent/privkey.pem",
	})

	err := ValidateCertificateFiles(payload)
	if err == nil {
		t.Fatal("expected error for missing certificate file, got nil")
	}
	if !strings.Contains(err.Error(), "does not exist") || !strings.Contains(err.Error(), "directory") {
		t.Fatalf("expected missing file/directory error, got %q", err.Error())
	}
	if !strings.Contains(err.Error(), "VLESS_TLS") {
		t.Fatalf("expected error to reference inbound tag, got %q", err.Error())
	}
}

func TestValidateCertificateFilesExistingFiles(t *testing.T) {
	dir := t.TempDir()
	certPath := filepath.Join(dir, "fullchain.pem")
	keyPath := filepath.Join(dir, "privkey.pem")
	if err := os.WriteFile(certPath, []byte("-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(keyPath, []byte("-----BEGIN PRIVATE KEY-----\nxyz\n-----END PRIVATE KEY-----\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	payload := tlsInboundPayload(map[string]any{
		"certificateFile": certPath,
		"keyFile":         keyPath,
	})

	if err := ValidateCertificateFiles(payload); err != nil {
		t.Fatalf("expected no error for existing certificate files, got %v", err)
	}
}

func TestValidateCertificateFilesEmptyFile(t *testing.T) {
	dir := t.TempDir()
	certPath := filepath.Join(dir, "fullchain.pem")
	if err := os.WriteFile(certPath, nil, 0o600); err != nil {
		t.Fatal(err)
	}

	payload := tlsInboundPayload(map[string]any{
		"certificateFile": certPath,
	})

	err := ValidateCertificateFiles(payload)
	if err == nil || !strings.Contains(err.Error(), "is empty") {
		t.Fatalf("expected 'is empty' error, got %v", err)
	}
}

func TestValidateCertificateFilesInlineContentSkipsFileCheck(t *testing.T) {
	// Inline certificate/key content should not require any file on disk.
	payload := tlsInboundPayload(map[string]any{
		"certificate": []any{"-----BEGIN CERTIFICATE-----", "abc", "-----END CERTIFICATE-----"},
		"key":         "-----BEGIN PRIVATE KEY-----\nxyz\n-----END PRIVATE KEY-----",
	})

	if err := ValidateCertificateFiles(payload); err != nil {
		t.Fatalf("expected no error for inline certificate content, got %v", err)
	}
}

func TestValidateCertificateFilesRejectsPathTraversal(t *testing.T) {
	payload := tlsInboundPayload(map[string]any{
		"certificateFile": "/etc/rebecca/../../etc/shadow",
	})

	err := ValidateCertificateFiles(payload)
	if err == nil || !strings.Contains(err.Error(), "..") {
		t.Fatalf("expected path traversal rejection, got %v", err)
	}
}

func TestValidateCertificateFilesNoTLS(t *testing.T) {
	payload := map[string]any{
		"inbounds": []any{
			map[string]any{
				"tag":      "VLESS_TCP",
				"protocol": "vless",
				"streamSettings": map[string]any{
					"security": "none",
				},
			},
		},
	}

	if err := ValidateCertificateFiles(payload); err != nil {
		t.Fatalf("expected no error when TLS is not configured, got %v", err)
	}
}

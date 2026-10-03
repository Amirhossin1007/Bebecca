package xrayconfig

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// StreamCertificateError checks TLS material without applying a configuration.
// Verification-only CA entries have no private key and are not server pairs.
func StreamCertificateError(item map[string]any, now time.Time) error {
	if err := validateStreamCertificateFiles(item); err != nil {
		return err
	}
	for _, certificate := range certificateMapList(mapValue(mapValue(item["streamSettings"])["tlsSettings"])["certificates"]) {
		usage := stringValue(certificate["usage"])
		if usage != "" && usage != "encipherment" {
			continue
		}
		cert, err := diagnosticCertificateContent(certificate, "certificate", []string{"certificateFile", "certFile", "certfile"})
		if err != nil {
			return err
		}
		key, err := diagnosticCertificateContent(certificate, "key", []string{"keyFile", "keyfile"})
		if err != nil {
			return err
		}
		pair, err := tls.X509KeyPair(cert, key)
		if err != nil {
			return fmt.Errorf("TLS certificate/private key is missing, invalid or mismatched: %w", err)
		}
		leaf, err := x509.ParseCertificate(pair.Certificate[0])
		if err != nil {
			return fmt.Errorf("parse TLS certificate: %w", err)
		}
		if now.Before(leaf.NotBefore) {
			return fmt.Errorf("TLS certificate is not valid before %s", leaf.NotBefore.UTC().Format(time.RFC3339))
		}
		if !now.Before(leaf.NotAfter) {
			return fmt.Errorf("TLS certificate expired at %s", leaf.NotAfter.UTC().Format(time.RFC3339))
		}
	}
	return nil
}

func diagnosticCertificateContent(certificate map[string]any, key string, aliases []string) ([]byte, error) {
	if hasCertificateContent(certificate[key]) {
		if content, ok := certificate[key].(string); ok {
			return []byte(content), nil
		}
		return []byte(strings.Join(stringList(certificate[key]), "\n")), nil
	}
	path := firstNonEmptyCertificatePath(certificate, aliases)
	if path == "" {
		return nil, nil
	}
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("read TLS %s file: %w", key, err)
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, (1<<20)+1))
	if len(data) > 1<<20 {
		return nil, fmt.Errorf("TLS %s file exceeds 1 MiB", key)
	}
	return data, err
}

// ValidateCertificateFiles ensures every TLS certificate that references a file
// path points to a readable, non-empty file on the local filesystem.
//
// The panel inlines these files (see nodecontroller.buildRuntimeConfig) when it
// builds the runtime config that is pushed to nodes. If a path is wrong or the
// file is missing, that inlining fails later and the node crashes on startup.
// Validating at save time rejects the bad config up front so an operator can fix
// the path before it is ever accepted.
func ValidateCertificateFiles(payload map[string]any) error {
	for _, section := range []string{"inbounds", "outbounds"} {
		for _, item := range listOfMaps(payload[section]) {
			if err := validateStreamCertificateFiles(item); err != nil {
				tag := stringValue(item["tag"])
				if tag == "" {
					tag = "<untagged>"
				}
				return fmt.Errorf("%s %q TLS certificate: %w", strings.TrimSuffix(section, "s"), tag, err)
			}
		}
	}
	return nil
}

func validateStreamCertificateFiles(item map[string]any) error {
	stream := mapValue(item["streamSettings"])
	if len(stream) == 0 {
		return nil
	}
	tlsSettings := mapValue(stream["tlsSettings"])
	if len(tlsSettings) == 0 {
		return nil
	}
	certificates := certificateMapList(tlsSettings["certificates"])
	if len(certificates) == 0 {
		return nil
	}
	for index, certificate := range certificates {
		if err := validateCertificateFile(certificate, "certificate", []string{"certificateFile", "certFile", "certfile"}); err != nil {
			return fmt.Errorf("certificate[%d]: %w", index, err)
		}
		if err := validateCertificateFile(certificate, "key", []string{"keyFile", "keyfile"}); err != nil {
			return fmt.Errorf("certificate[%d]: %w", index, err)
		}
	}
	return nil
}

func validateCertificateFile(certificate map[string]any, contentKey string, pathKeys []string) error {
	// Inline certificate content takes precedence; there is no file to check.
	if hasCertificateContent(certificate[contentKey]) {
		return nil
	}
	path := firstNonEmptyCertificatePath(certificate, pathKeys)
	if path == "" {
		return nil
	}
	// The path comes from the saved config (operator-controlled). Reject path
	// traversal before touching the filesystem so a stored config cannot probe
	// arbitrary locations via "..", and normalize the value before use.
	if strings.Contains(path, "..") {
		return fmt.Errorf("%s path %q must not contain %q", contentKey, path, "..")
	}
	cleanPath := filepath.Clean(path)
	info, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("%s file %q does not exist or its directory does not exist", contentKey, path)
		}
		return fmt.Errorf("%s file %q is not accessible: %w", contentKey, path, err)
	}
	if info.IsDir() {
		return fmt.Errorf("%s path %q is a directory, not a file", contentKey, path)
	}
	if info.Size() == 0 {
		return fmt.Errorf("%s file %q is empty", contentKey, path)
	}
	return nil
}

func certificateMapList(value any) []map[string]any {
	switch typed := value.(type) {
	case map[string]any:
		return []map[string]any{typed}
	default:
		return listOfMaps(value)
	}
}

func hasCertificateContent(value any) bool {
	switch typed := value.(type) {
	case []string:
		for _, line := range typed {
			if strings.TrimSpace(line) != "" {
				return true
			}
		}
		return false
	case []any:
		for _, item := range typed {
			if strings.TrimSpace(stringValue(item)) != "" {
				return true
			}
		}
		return false
	case string:
		return strings.TrimSpace(typed) != ""
	default:
		return false
	}
}

func firstNonEmptyCertificatePath(certificate map[string]any, pathKeys []string) string {
	for _, key := range pathKeys {
		if path := strings.TrimSpace(stringValue(certificate[key])); path != "" {
			return path
		}
	}
	return ""
}

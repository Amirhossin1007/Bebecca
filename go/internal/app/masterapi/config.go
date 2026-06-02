package masterapi

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const defaultAddress = "127.0.0.1:18080"

type Config struct {
	Address                    string
	Database                   string
	TLSCert                    string
	TLSKey                     string
	NodeOperationsPollInterval string
}

func LoadConfig() (Config, error) {
	env := loadEnvFiles()
	lookup := func(keys ...string) string {
		for _, key := range keys {
			if value := strings.TrimSpace(os.Getenv(key)); value != "" {
				return value
			}
			if value := strings.TrimSpace(env[key]); value != "" {
				return value
			}
		}
		return ""
	}

	addr := lookup("REBECCA_MASTER_API_ADDR", "REBECCA_GO_API_ADDR")
	if addr == "" {
		host := lookup("REBECCA_MASTER_API_HOST", "REBECCA_GO_API_HOST")
		port := lookup("REBECCA_MASTER_API_PORT", "REBECCA_GO_API_PORT")
		switch {
		case host != "" && port != "":
			addr = host + ":" + port
		case port != "":
			addr = "127.0.0.1:" + port
		default:
			addr = defaultAddress
		}
	}

	cfg := Config{
		Address:                    addr,
		Database:                   lookup("SQLALCHEMY_DATABASE_URL", "DATABASE_URL"),
		TLSCert:                    lookup("REBECCA_MASTER_API_TLS_CERTFILE", "UVICORN_SSL_CERTFILE", "SSL_CERTFILE"),
		TLSKey:                     lookup("REBECCA_MASTER_API_TLS_KEYFILE", "UVICORN_SSL_KEYFILE", "SSL_KEYFILE"),
		NodeOperationsPollInterval: lookup("REBECCA_NODE_OPERATIONS_POLL_INTERVAL"),
	}
	if cfg.Database == "" {
		return Config{}, fmt.Errorf("SQLALCHEMY_DATABASE_URL is required")
	}
	return cfg, nil
}

func loadEnvFiles() map[string]string {
	result := map[string]string{}
	for _, path := range candidateEnvFiles() {
		mergeEnvFile(result, path)
	}
	return result
}

func candidateEnvFiles() []string {
	seen := map[string]bool{}
	add := func(paths []string, path string) []string {
		path = strings.TrimSpace(path)
		if path == "" {
			return paths
		}
		abs, err := filepath.Abs(path)
		if err == nil {
			path = abs
		}
		if seen[path] {
			return paths
		}
		seen[path] = true
		return append(paths, path)
	}

	paths := []string{}
	paths = add(paths, os.Getenv("REBECCA_ENV_FILE"))
	paths = add(paths, os.Getenv("REBECCA_PYTHON_ENV_FILE"))
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		paths = add(paths, filepath.Join(dir, ".env"))
		paths = add(paths, filepath.Join(filepath.Dir(dir), ".env"))
	}
	if cwd, err := os.Getwd(); err == nil {
		paths = add(paths, filepath.Join(cwd, ".env"))
		paths = add(paths, filepath.Join(filepath.Dir(cwd), ".env"))
	}
	return paths
}

func mergeEnvFile(dst map[string]string, path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
		value = strings.TrimSpace(value)
		value = strings.Trim(value, `"'`)
		if key != "" {
			if _, exists := dst[key]; exists {
				continue
			}
			dst[key] = value
		}
	}
}

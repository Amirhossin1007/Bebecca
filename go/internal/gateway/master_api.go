package gateway

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/rebeccapanel/rebecca/go/internal/app/masterapi"
)

type MasterAPIRuntime struct {
	errc chan error
}

func StartMasterAPI(ctx context.Context, cfg Config) (*MasterAPIRuntime, string, error) {
	if !cfg.MasterAPIEnabled {
		return nil, "", fmt.Errorf("disabled by REBECCA_MASTER_API_ENABLED")
	}

	apiCfg, err := masterapi.LoadConfig()
	if err != nil {
		return nil, "", err
	}
	apiCfg.Address = cfg.MasterAPIAddr

	// The gateway sidecar is an internal loopback API. It should stay plain HTTP
	// unless an explicit Master API certificate is configured.
	if strings.TrimSpace(os.Getenv("REBECCA_MASTER_API_TLS_CERTFILE")) == "" {
		apiCfg.TLSCert = ""
	}
	if strings.TrimSpace(os.Getenv("REBECCA_MASTER_API_TLS_KEYFILE")) == "" {
		apiCfg.TLSKey = ""
	}

	server, err := masterapi.New(apiCfg)
	if err != nil {
		return nil, "", err
	}

	runtime := &MasterAPIRuntime{errc: make(chan error, 1)}
	go func() {
		runtime.errc <- server.Serve(ctx)
	}()

	url := cfg.ResolvedMasterAPIURL()
	if err := waitForMasterAPI(ctx, url, cfg.MasterAPIStartWait); err != nil {
		return runtime, "", err
	}
	return runtime, url, nil
}

func (r *MasterAPIRuntime) Err() <-chan error {
	if r == nil {
		return nil
	}
	return r.errc
}

func waitForMasterAPI(ctx context.Context, baseURL string, timeout time.Duration) error {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	healthURL := strings.TrimRight(baseURL, "/") + "/__rebecca_master_api/healthz"
	client := &http.Client{Timeout: 2 * time.Second}
	deadline := time.Now().Add(timeout)
	for {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, healthURL, nil)
		if err != nil {
			return err
		}
		res, err := client.Do(req)
		if err == nil {
			_ = res.Body.Close()
			if res.StatusCode >= 200 && res.StatusCode < 300 {
				return nil
			}
		}
		if time.Now().After(deadline) {
			if err != nil {
				return fmt.Errorf("master api did not become healthy at %s within %s: %w", healthURL, timeout, err)
			}
			return fmt.Errorf("master api did not become healthy at %s within %s", healthURL, timeout)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(250 * time.Millisecond):
		}
	}
}

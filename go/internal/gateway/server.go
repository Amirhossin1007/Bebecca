package gateway

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Server struct {
	cfg    Config
	server *http.Server
}

func NewServer(cfg Config) (*Server, error) {
	target, err := url.Parse("http://" + cfg.PythonAddr())
	if err != nil {
		return nil, err
	}

	pythonProxy := httputil.NewSingleHostReverseProxy(target)
	pythonProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		http.Error(w, fmt.Sprintf("python runtime unavailable: %s", err), http.StatusBadGateway)
	}

	var masterProxy *httputil.ReverseProxy
	if cfg.NativeNodeRoutes && strings.TrimSpace(cfg.MasterAPIURL) != "" {
		masterTarget, err := url.Parse(strings.TrimRight(cfg.MasterAPIURL, "/"))
		if err != nil {
			return nil, err
		}
		masterProxy = httputil.NewSingleHostReverseProxy(masterTarget)
		masterProxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
			http.Error(w, fmt.Sprintf("native Go Master API unavailable: %s", err), http.StatusServiceUnavailable)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/__rebecca_go/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = w.Write([]byte("ok\n"))
	})
	mux.HandleFunc("/__rebecca_go/master_api_healthz", func(w http.ResponseWriter, r *http.Request) {
		if masterProxy == nil || strings.TrimSpace(cfg.MasterAPIURL) == "" {
			http.Error(w, "native node routes are not enabled", http.StatusServiceUnavailable)
			return
		}
		req, err := http.NewRequestWithContext(
			r.Context(),
			http.MethodGet,
			strings.TrimRight(cfg.MasterAPIURL, "/")+"/__rebecca_master_api/healthz",
			nil,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		defer res.Body.Close()
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(res.StatusCode)
		if res.StatusCode >= 200 && res.StatusCode < 300 {
			_, _ = w.Write([]byte("ok\n"))
		}
	})
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if masterProxy != nil && isNativeNodeRoute(r) {
			masterProxy.ServeHTTP(w, r)
			return
		}
		pythonProxy.ServeHTTP(w, r)
	})

	return &Server{
		cfg: cfg,
		server: &http.Server{
			Addr:              cfg.Addr,
			Handler:           mux,
			ReadHeaderTimeout: 15 * time.Second,
		},
	}, nil
}

func isNativeNodeRoute(r *http.Request) bool {
	if strings.EqualFold(r.Header.Get("Upgrade"), "websocket") {
		return false
	}
	path := strings.TrimRight(r.URL.Path, "/")
	switch path {
	case "/api/nodes":
		return r.Method == http.MethodGet
	case "/api/nodes/usage":
		return r.Method == http.MethodGet
	}

	if !strings.HasPrefix(path, "/api/node/") {
		return false
	}
	rest := strings.TrimPrefix(path, "/api/node/")
	parts := strings.Split(rest, "/")
	if len(parts) == 0 || parts[0] == "" {
		return false
	}
	if _, err := strconv.ParseInt(parts[0], 10, 64); err != nil {
		return false
	}
	suffix := strings.Join(parts[1:], "/")
	switch suffix {
	case "":
		return r.Method == http.MethodGet
	case "reconnect", "restart", "sync", "xray/update", "geo/update", "service/restart", "service/update":
		return r.Method == http.MethodPost
	case "logs", "usage/daily":
		return r.Method == http.MethodGet
	default:
		return false
	}
}

func (s *Server) Run() error {
	var err error
	if s.cfg.TLSCertFile != "" && s.cfg.TLSKeyFile != "" {
		err = s.server.ListenAndServeTLS(s.cfg.TLSCertFile, s.cfg.TLSKeyFile)
	} else {
		err = s.server.ListenAndServe()
	}
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func (s *Server) Shutdown(ctx context.Context) error {
	if s == nil || s.server == nil {
		return nil
	}
	return s.server.Shutdown(ctx)
}

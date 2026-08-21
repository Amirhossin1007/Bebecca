package api

import (
	"errors"
	"mime"
	"net"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
)

const maxPHPAppResponseBytes = 64 << 20

type phpAppAwareHandler struct {
	apps *phpAppManager
	next http.Handler
}

func (h *phpAppAwareHandler) HandlesHost(host string) bool {
	if h == nil || h.apps == nil {
		return false
	}
	_, ok := h.apps.lookup(host)
	return ok
}

func (h *phpAppAwareHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if h == nil || h.apps == nil {
		h.next.ServeHTTP(w, r)
		return
	}
	record, ok := h.apps.lookup(r.Host)
	if !ok {
		h.next.ServeHTTP(w, r)
		return
	}
	setPHPAppSecurityHeaders(w.Header())
	if !record.Enabled {
		w.Header().Set("Cache-Control", "no-store")
		http.Error(w, "Application is disabled", http.StatusServiceUnavailable)
		return
	}
	if r.ContentLength > maxPHPAppRequestBodyBytes {
		http.Error(w, "Request body is too large", http.StatusRequestEntityTooLarge)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxPHPAppRequestBodyBytes)
	if err := h.apps.serve(w, r, record); err != nil {
		http.Error(w, "Application is unavailable", http.StatusBadGateway)
	}
}

func (m *phpAppManager) serve(w http.ResponseWriter, r *http.Request, record phpAppRecord) error {
	rel, fullPath, info, err := resolvePHPAppPath(record, r.URL.Path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			http.NotFound(w, r)
			return nil
		}
		return err
	}
	if info.IsDir() {
		http.NotFound(w, r)
		return nil
	}
	if strings.EqualFold(filepath.Ext(rel), ".php") {
		if record.Runtime != "php" || !phpScriptAllowed(record, rel) {
			http.NotFound(w, r)
			return nil
		}
		if record.Template == "mirzabot" {
			if err := m.authorizeMirzaRequest(r, record, rel); err != nil {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return nil
			}
		}
		return servePHPAppFastCGI(w, r, record, rel, fullPath)
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return nil
	}
	servePHPAppStatic(w, r, record, rel)
	return nil
}

func resolvePHPAppPath(record phpAppRecord, requestPath string) (string, string, os.FileInfo, error) {
	if strings.ContainsRune(requestPath, '\x00') || strings.Contains(requestPath, "\\") {
		return "", "", nil, os.ErrNotExist
	}
	cleanPath := path.Clean("/" + requestPath)
	rel := strings.TrimPrefix(cleanPath, "/")
	if rel == "." {
		rel = ""
	}
	if phpAppPathDenied(rel) {
		return "", "", nil, os.ErrNotExist
	}
	root, err := os.OpenRoot(record.Root)
	if err != nil {
		return "", "", nil, err
	}
	defer root.Close()
	rootPath := filepath.FromSlash(rel)
	if rootPath == "" {
		rootPath = "."
	}
	info, err := root.Stat(rootPath)
	if err == nil && info.IsDir() {
		for _, index := range []string{"index.php", "index.html"} {
			candidate := filepath.Join(rootPath, index)
			candidateInfo, candidateErr := root.Stat(candidate)
			if candidateErr == nil && !candidateInfo.IsDir() {
				rel = path.Join(rel, index)
				info = candidateInfo
				break
			}
		}
	}
	if err != nil {
		return "", "", nil, os.ErrNotExist
	}
	if phpAppPathDenied(rel) {
		return "", "", nil, os.ErrNotExist
	}
	return filepath.ToSlash(rel), filepath.Join(record.Root, filepath.FromSlash(rel)), info, nil
}

func phpAppPathDenied(rel string) bool {
	if rel == "" {
		return false
	}
	parts := strings.Split(strings.ToLower(filepath.ToSlash(rel)), "/")
	for _, part := range parts {
		if part == "" || part == "." || part == ".." || strings.HasPrefix(part, ".") {
			return true
		}
	}
	switch parts[0] {
	case "vendor":
		return true
	}
	switch strings.ToLower(path.Base(rel)) {
	case "config.php", "table.php", "composer.json", "composer.lock", "install.sh":
		return true
	default:
		return false
	}
}

func phpScriptAllowed(record phpAppRecord, rel string) bool {
	if record.Template != "mirzabot" {
		return true
	}
	rel = strings.ToLower(filepath.ToSlash(rel))
	if rel == "index.php" {
		return true
	}
	for _, prefix := range []string{"api/", "app/", "cronbot/", "panel/", "payment/", "sub/", "vpnbot/"} {
		if strings.HasPrefix(rel, prefix) {
			return true
		}
	}
	return false
}

func (m *phpAppManager) authorizeMirzaRequest(r *http.Request, record phpAppRecord, rel string) error {
	rel = strings.ToLower(filepath.ToSlash(rel))
	if rel != "index.php" && !strings.HasPrefix(rel, "cronbot/") {
		return nil
	}
	secrets, err := m.readSecrets(record.Domain)
	if err != nil {
		return err
	}
	var actual, expected string
	if rel == "index.php" && r.Method == http.MethodPost {
		actual = strings.TrimSpace(r.Header.Get("X-Telegram-Bot-Api-Secret-Token"))
		expected = secrets.WebhookSecret
	} else if strings.HasPrefix(rel, "cronbot/") {
		actual = strings.TrimSpace(r.Header.Get("X-Rebecca-Cron-Secret"))
		expected = secrets.CronSecret
	} else {
		return nil
	}
	if expected == "" || !subtleConstantStringEqual(actual, expected) {
		return errors.New("invalid application secret")
	}
	return nil
}

func servePHPAppStatic(w http.ResponseWriter, r *http.Request, record phpAppRecord, rel string) {
	if contentType := mime.TypeByExtension(strings.ToLower(filepath.Ext(rel))); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if strings.EqualFold(filepath.Ext(rel), ".html") {
		w.Header().Set("Cache-Control", "no-cache")
	} else {
		w.Header().Set("Cache-Control", "public, max-age=3600")
	}
	file, err := os.OpenInRoot(record.Root, filepath.FromSlash(rel))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, info.Name(), info.ModTime(), file)
}

func servePHPAppFastCGI(w http.ResponseWriter, r *http.Request, record phpAppRecord, scriptRel, scriptPath string) error {
	params := phpAppFastCGIParams(r, record, scriptRel, scriptPath)
	stdout, stderr, err := fastCGIRequestLimited("unix", record.Socket, params, r.Body, maxPHPAppResponseBytes)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			http.Error(w, "Request body is too large", http.StatusRequestEntityTooLarge)
			return nil
		}
		return err
	}
	if len(stderr) > 0 && len(stdout) == 0 {
		return errors.New("PHP-FPM returned an error")
	}
	return writePHPAppFastCGIResponse(w, stdout)
}

func phpAppFastCGIParams(r *http.Request, record phpAppRecord, scriptRel, scriptPath string) map[string]string {
	serverName := canonicalPHPAppHost(r.Host)
	serverPort := "80"
	if _, port, err := net.SplitHostPort(r.Host); err == nil {
		serverPort = port
	} else if requestScheme(r) == "https" {
		serverPort = "443"
	}
	scriptName := "/" + strings.TrimLeft(filepath.ToSlash(scriptRel), "/")
	params := map[string]string{
		"GATEWAY_INTERFACE": "CGI/1.1",
		"SERVER_SOFTWARE":   "Rebecca",
		"REQUEST_METHOD":    r.Method,
		"QUERY_STRING":      r.URL.RawQuery,
		"REQUEST_URI":       r.URL.RequestURI(),
		"SCRIPT_FILENAME":   scriptPath,
		"SCRIPT_NAME":       scriptName,
		"PHP_SELF":          scriptName,
		"DOCUMENT_ROOT":     record.Root,
		"REDIRECT_STATUS":   "200",
		"SERVER_NAME":       serverName,
		"SERVER_PORT":       serverPort,
		"SERVER_PROTOCOL":   r.Proto,
		"REMOTE_ADDR":       remoteHost(r.RemoteAddr),
		"HTTPS":             "off",
	}
	if requestScheme(r) == "https" {
		params["HTTPS"] = "on"
	}
	if r.ContentLength > 0 {
		params["CONTENT_LENGTH"] = strconv.FormatInt(r.ContentLength, 10)
	}
	if contentType := r.Header.Get("Content-Type"); contentType != "" {
		params["CONTENT_TYPE"] = contentType
	}
	for key, values := range r.Header {
		if len(values) == 0 {
			continue
		}
		cgiName := "HTTP_" + strings.ToUpper(strings.ReplaceAll(key, "-", "_"))
		switch cgiName {
		case "HTTP_CONTENT_TYPE", "HTTP_CONTENT_LENGTH", "HTTP_CONNECTION", "HTTP_PROXY":
			continue
		}
		params[cgiName] = strings.Join(values, ", ")
	}
	return params
}

func writePHPAppFastCGIResponse(w http.ResponseWriter, stdout []byte) error {
	headers, body, err := splitFastCGIHeaders(stdout)
	if err != nil {
		return err
	}
	statusCode := http.StatusOK
	statusSet := false
	hasLocation := false
	for key, values := range headers {
		if strings.EqualFold(key, "Status") && len(values) > 0 {
			if fields := strings.Fields(values[0]); len(fields) > 0 {
				if code, err := strconv.Atoi(fields[0]); err == nil && code >= 100 && code <= 999 {
					statusCode = code
					statusSet = true
				}
			}
			continue
		}
		if phpAppHopByHopHeader(key) || strings.EqualFold(key, "X-Powered-By") || strings.EqualFold(key, "Content-Length") {
			continue
		}
		if strings.EqualFold(key, "Location") {
			hasLocation = true
		}
		for _, value := range values {
			w.Header().Add(key, value)
		}
	}
	if hasLocation && !statusSet {
		statusCode = http.StatusFound
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(statusCode)
	_, err = w.Write(body)
	return err
}

func phpAppHopByHopHeader(key string) bool {
	switch strings.ToLower(strings.TrimSpace(key)) {
	case "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade":
		return true
	default:
		return false
	}
}

func setPHPAppSecurityHeaders(header http.Header) {
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("Referrer-Policy", "same-origin")
	header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	header.Set("X-Frame-Options", "SAMEORIGIN")
}

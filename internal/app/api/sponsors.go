package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	sponsorCacheFile       = "manifest.json"
	sponsorCacheTTL        = 7 * 24 * time.Hour
	sponsorManifestMaxSize = 1 << 20
	sponsorAssetMaxSize    = 2 << 20
	sponsorHeaderMax       = 3
	sponsorSidebarMax      = 5
)

var sponsorIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{1,80}$`)

type sponsorManager struct {
	manifestURL string
	cacheDir    string
	client      *http.Client
	mu          sync.Mutex
}

type sponsorCache struct {
	CheckedAt    time.Time            `json:"checked_at"`
	ManifestURL  string               `json:"manifest_url,omitempty"`
	ManifestHash string               `json:"manifest_hash,omitempty"`
	Assets       []cachedSponsorAsset `json:"assets"`
}

type cachedSponsorAsset struct {
	ID          string    `json:"id"`
	Placement   string    `json:"placement"`
	SourceURL   string    `json:"source_url"`
	TargetURL   string    `json:"target_url,omitempty"`
	Alt         string    `json:"alt,omitempty"`
	Label       string    `json:"label,omitempty"`
	LocalPath   string    `json:"local_path"`
	ContentType string    `json:"content_type"`
	ValidUntil  time.Time `json:"valid_until"`
}

type sponsorManifest struct {
	Enabled      *bool                  `json:"enabled"`
	Assets       []sponsorManifestAsset `json:"assets"`
	Header       []sponsorManifestAsset `json:"header"`
	HeaderMobile []sponsorManifestAsset `json:"header_mobile"`
	Sidebar      []sponsorManifestAsset `json:"sidebar"`
}

type sponsorManifestAsset struct {
	ID         string `json:"id"`
	Placement  string `json:"placement"`
	ImageURL   string `json:"image_url"`
	Image      string `json:"image"`
	TargetURL  string `json:"target_url"`
	Link       string `json:"link"`
	Alt        string `json:"alt"`
	Label      string `json:"label"`
	ValidUntil string `json:"valid_until"`
	ExpiresAt  string `json:"expires_at"`
}

type sponsorAssetResponse struct {
	ID         string `json:"id"`
	Placement  string `json:"placement"`
	ImageURL   string `json:"image_url"`
	TargetURL  string `json:"target_url,omitempty"`
	Alt        string `json:"alt,omitempty"`
	Label      string `json:"label,omitempty"`
	ValidUntil string `json:"valid_until"`
}

type sponsorResponse struct {
	Header       []sponsorAssetResponse `json:"header"`
	HeaderMobile []sponsorAssetResponse `json:"header_mobile"`
	Sidebar      []sponsorAssetResponse `json:"sidebar"`
	SidebarLogo  []sponsorAssetResponse `json:"sidebar_logo"`
}

func newSponsorManager(manifestURL, cacheDir string, client *http.Client) *sponsorManager {
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &sponsorManager{
		manifestURL: strings.TrimSpace(manifestURL),
		cacheDir:    strings.TrimSpace(cacheDir),
		client:      client,
	}
}

func (m *sponsorManager) response(ctx context.Context) (sponsorResponse, error) {
	assets, err := m.ensure(ctx)
	if err != nil {
		return sponsorResponse{}, err
	}
	result := sponsorResponse{
		Header:       make([]sponsorAssetResponse, 0),
		HeaderMobile: make([]sponsorAssetResponse, 0),
		Sidebar:      make([]sponsorAssetResponse, 0),
		SidebarLogo:  make([]sponsorAssetResponse, 0),
	}
	counts := map[string]int{}
	for _, asset := range assets {
		limit := sponsorSidebarMax
		if asset.Placement == "header" || asset.Placement == "header_mobile" {
			limit = sponsorHeaderMax
		}
		if counts[asset.Placement] >= limit {
			continue
		}
		counts[asset.Placement]++
		item := sponsorAssetResponse{
			ID:         asset.ID,
			Placement:  asset.Placement,
			ImageURL:   "/api/sponsor/assets/" + url.PathEscape(asset.ID),
			TargetURL:  asset.TargetURL,
			Alt:        asset.Alt,
			Label:      asset.Label,
			ValidUntil: asset.ValidUntil.UTC().Format(time.RFC3339),
		}
		switch asset.Placement {
		case "header":
			result.Header = append(result.Header, item)
		case "header_mobile":
			result.HeaderMobile = append(result.HeaderMobile, item)
		case "sidebar_logo":
			result.SidebarLogo = append(result.SidebarLogo, item)
		default:
			result.Sidebar = append(result.Sidebar, item)
		}
	}
	return result, nil
}

func (m *sponsorManager) ensure(ctx context.Context) ([]cachedSponsorAsset, error) {
	if m == nil || m.manifestURL == "" || m.cacheDir == "" {
		return nil, nil
	}
	m.mu.Lock()
	defer m.mu.Unlock()

	cached, cacheErr := m.loadCache()
	cacheMatchesSource := cached.ManifestURL == m.manifestURL
	valid := m.validAssets(cached.Assets)
	if cacheMatchesSource && len(valid) == len(cached.Assets) && len(cached.Assets) > 0 {
		if cacheErr == nil && !cached.CheckedAt.IsZero() && time.Since(cached.CheckedAt) < sponsorCacheTTL {
			return valid, nil
		}
	}
	if cacheMatchesSource && len(cached.Assets) == 0 && cacheErr == nil && !cached.CheckedAt.IsZero() && time.Since(cached.CheckedAt) < sponsorCacheTTL {
		return nil, nil
	}

	refreshed, err := m.refresh(ctx, cached)
	if err != nil {
		if len(valid) > 0 {
			return valid, nil
		}
		return nil, err
	}
	return refreshed, nil
}

func (m *sponsorManager) loadCache() (sponsorCache, error) {
	data, err := os.ReadFile(filepath.Join(m.cacheDir, sponsorCacheFile))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return sponsorCache{}, nil
		}
		return sponsorCache{}, err
	}
	var cache sponsorCache
	if err := json.Unmarshal(data, &cache); err != nil {
		return sponsorCache{}, err
	}
	return cache, nil
}

func (m *sponsorManager) validAssets(assets []cachedSponsorAsset) []cachedSponsorAsset {
	result := make([]cachedSponsorAsset, 0, len(assets))
	for _, asset := range assets {
		if asset.ID == "" || !sponsorIDPattern.MatchString(asset.ID) ||
			(asset.Placement != "header" && asset.Placement != "header_mobile" && asset.Placement != "sidebar" && asset.Placement != "sidebar_logo") ||
			asset.ValidUntil.IsZero() || !time.Now().Before(asset.ValidUntil) ||
			!m.isCachePath(asset.LocalPath) {
			m.removeCachePath(asset.LocalPath)
			continue
		}
		if info, err := os.Stat(asset.LocalPath); err != nil || info.Size() == 0 {
			m.removeCachePath(asset.LocalPath)
			continue
		}
		result = append(result, asset)
	}
	return result
}

func (m *sponsorManager) refresh(ctx context.Context, old sponsorCache) ([]cachedSponsorAsset, error) {
	manifest, manifestHash, err := m.fetchManifest(ctx)
	if err != nil {
		return nil, err
	}
	validOld := m.validAssets(old.Assets)
	if manifestHash == old.ManifestHash && len(validOld) == len(old.Assets) {
		old.CheckedAt = time.Now().UTC()
		old.ManifestURL = m.manifestURL
		if err := m.saveCache(old); err != nil {
			return nil, err
		}
		return validOld, nil
	}
	assets := make([]cachedSponsorAsset, 0, len(manifest))
	for _, item := range manifest {
		data, contentType, err := m.fetchAsset(ctx, item.SourceURL)
		if err != nil {
			continue
		}
		localPath := filepath.Join(m.cacheDir, item.ID+fileExtension(contentType))
		if err := writeSponsorFile(localPath, data); err != nil {
			continue
		}
		item.LocalPath = localPath
		item.ContentType = contentType
		assets = append(assets, item)
	}
	for _, item := range old.Assets {
		keep := false
		for _, next := range assets {
			if item.LocalPath == next.LocalPath {
				keep = true
				break
			}
		}
		if !keep {
			m.removeCachePath(item.LocalPath)
		}
	}
	if err := m.saveCache(sponsorCache{CheckedAt: time.Now().UTC(), ManifestURL: m.manifestURL, ManifestHash: manifestHash, Assets: assets}); err != nil {
		return nil, err
	}
	return assets, nil
}

func (m *sponsorManager) fetchManifest(ctx context.Context) ([]cachedSponsorAsset, string, error) {
	manifestURL, err := validateGitHubURL(m.manifestURL)
	if err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, manifestURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.Request != nil {
		if _, err := validateGitHubURL(resp.Request.URL.String()); err != nil {
			return nil, "", errors.New("sponsor manifest redirect left GitHub")
		}
	}
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("sponsor manifest returned HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, sponsorManifestMaxSize+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) > sponsorManifestMaxSize {
		return nil, "", errors.New("sponsor manifest is too large")
	}
	var document sponsorManifest
	if err := json.Unmarshal(data, &document); err != nil {
		return nil, "", fmt.Errorf("invalid sponsor manifest: %w", err)
	}
	hash := sha256.Sum256(data)
	manifestHash := hex.EncodeToString(hash[:])
	if document.Enabled != nil && !*document.Enabled {
		return []cachedSponsorAsset{}, manifestHash, nil
	}
	items := make([]sponsorManifestAsset, 0, len(document.Assets)+len(document.Header)+len(document.HeaderMobile)+len(document.Sidebar))
	items = append(items, document.Assets...)
	for _, item := range document.Header {
		if item.Placement == "" {
			item.Placement = "header"
		}
		items = append(items, item)
	}
	for _, item := range document.HeaderMobile {
		if item.Placement == "" {
			item.Placement = "header_mobile"
		}
		items = append(items, item)
	}
	for _, item := range document.Sidebar {
		if item.Placement == "" {
			item.Placement = "sidebar"
		}
		items = append(items, item)
	}
	normalized, err := m.normalizeManifestItems(manifestURL, items)
	if err != nil {
		return nil, "", err
	}
	return normalized, manifestHash, nil
}

func (m *sponsorManager) normalizeManifestItems(manifestURL string, items []sponsorManifestAsset) ([]cachedSponsorAsset, error) {
	result := make([]cachedSponsorAsset, 0, len(items))
	seen := map[string]struct{}{}
	counts := map[string]int{}
	for _, item := range items {
		id := strings.TrimSpace(item.ID)
		placement := strings.ToLower(strings.TrimSpace(item.Placement))
		if !sponsorIDPattern.MatchString(id) || (placement != "header" && placement != "header_mobile" && placement != "sidebar" && placement != "sidebar_logo") {
			continue
		}
		limit := sponsorSidebarMax
		if placement == "header" || placement == "header_mobile" {
			limit = sponsorHeaderMax
		}
		if counts[placement] >= limit {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		imageURL := strings.TrimSpace(item.ImageURL)
		if imageURL == "" {
			imageURL = strings.TrimSpace(item.Image)
		}
		sourceURL, err := resolveGitHubURL(manifestURL, imageURL)
		if err != nil {
			continue
		}
		validUntil, err := parseSponsorTime(item.ValidUntil)
		if err != nil {
			validUntil, err = parseSponsorTime(item.ExpiresAt)
		}
		if err != nil || !time.Now().Before(validUntil) {
			continue
		}
		targetURL := strings.TrimSpace(item.TargetURL)
		if targetURL == "" {
			targetURL = strings.TrimSpace(item.Link)
		}
		if targetURL != "" && !validTargetURL(targetURL) {
			targetURL = ""
		}
		seen[id] = struct{}{}
		counts[placement]++
		result = append(result, cachedSponsorAsset{
			ID:         id,
			Placement:  placement,
			SourceURL:  sourceURL,
			TargetURL:  targetURL,
			Alt:        strings.TrimSpace(item.Alt),
			Label:      strings.TrimSpace(item.Label),
			ValidUntil: validUntil.UTC(),
		})
	}
	return result, nil
}

func (m *sponsorManager) fetchAsset(ctx context.Context, sourceURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := m.client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("sponsor asset returned HTTP %d", resp.StatusCode)
	}
	if resp.Request != nil {
		if _, err := validateGitHubURL(resp.Request.URL.String()); err != nil {
			return nil, "", errors.New("sponsor asset redirect left GitHub")
		}
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, sponsorAssetMaxSize+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 || len(data) > sponsorAssetMaxSize {
		return nil, "", errors.New("invalid sponsor asset size")
	}
	contentType := imageContentType(sourceURL, data, resp.Header.Get("Content-Type"))
	if contentType == "" {
		return nil, "", errors.New("unsupported sponsor asset type")
	}
	return data, contentType, nil
}

func (m *sponsorManager) saveCache(cache sponsorCache) error {
	if err := os.MkdirAll(m.cacheDir, 0o700); err != nil {
		return err
	}
	data, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}
	return writeSponsorFile(filepath.Join(m.cacheDir, sponsorCacheFile), data)
}

func (m *sponsorManager) isCachePath(path string) bool {
	if path == "" || m.cacheDir == "" {
		return false
	}
	base, err := filepath.Abs(m.cacheDir)
	if err != nil {
		return false
	}
	target, err := filepath.Abs(path)
	if err != nil {
		return false
	}
	rel, err := filepath.Rel(base, target)
	return err == nil && rel != "." && rel != ".." && !strings.HasPrefix(rel, ".."+string(os.PathSeparator))
}

func (m *sponsorManager) removeCachePath(path string) {
	if m.isCachePath(path) {
		_ = os.Remove(path)
	}
}

func writeSponsorFile(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".sponsor-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(0o600); err != nil {
		_ = tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		_ = tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

func validateGitHubURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme != "https" || u.Hostname() == "" {
		return "", errors.New("sponsor URL must use HTTPS")
	}
	host := strings.ToLower(u.Hostname())
	if host != "github.com" && host != "raw.githubusercontent.com" && !strings.HasSuffix(host, ".githubusercontent.com") {
		return "", errors.New("sponsor URL must point to GitHub")
	}
	return u.String(), nil
}

func resolveGitHubURL(baseURL, raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", errors.New("missing sponsor image URL")
	}
	u, err := url.Parse(value)
	if err != nil {
		return "", err
	}
	if !u.IsAbs() {
		base, err := url.Parse(baseURL)
		if err != nil {
			return "", err
		}
		u = base.ResolveReference(u)
	}
	return validateGitHubURL(u.String())
}

func validTargetURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "https" || u.Scheme == "http") && u.Hostname() != ""
}

func parseSponsorTime(raw string) (time.Time, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return time.Time{}, errors.New("missing sponsor expiration")
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	if parsed, err := time.ParseInLocation("2006-01-02", value, time.UTC); err == nil {
		return parsed.Add(24 * time.Hour), nil
	}
	return time.Time{}, errors.New("invalid sponsor expiration")
}

func imageContentType(sourceURL string, data []byte, declared string) string {
	ext := strings.ToLower(filepath.Ext(strings.Split(sourceURL, "?")[0]))
	switch ext {
	case ".svg":
		return "image/svg+xml"
	case ".webp":
		return "image/webp"
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".avif":
		return "image/avif"
	}
	if strings.HasPrefix(strings.ToLower(declared), "image/") {
		return strings.ToLower(strings.Split(declared, ";")[0])
	}
	if strings.HasPrefix(string(data), "<svg") || strings.Contains(string(data[:minInt(len(data), 256)]), "<svg") {
		return "image/svg+xml"
	}
	return ""
}

func fileExtension(contentType string) string {
	switch contentType {
	case "image/svg+xml":
		return ".svg"
	case "image/webp":
		return ".webp"
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/avif":
		return ".avif"
	default:
		return ".bin"
	}
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Server) handleSponsor(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	result := sponsorResponse{Header: []sponsorAssetResponse{}, HeaderMobile: []sponsorAssetResponse{}, Sidebar: []sponsorAssetResponse{}, SidebarLogo: []sponsorAssetResponse{}}
	if s.sponsors != nil {
		if loaded, err := s.sponsors.response(r.Context()); err == nil {
			result = loaded
		}
	}
	w.Header().Set("Cache-Control", "private, max-age=300")
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleSponsorAsset(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/sponsor/assets/"), "/")
	if !sponsorIDPattern.MatchString(id) || s.sponsors == nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	assets, err := s.sponsors.ensure(r.Context())
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	for _, asset := range assets {
		if asset.ID != id || !s.sponsors.isCachePath(asset.LocalPath) {
			continue
		}
		file, err := os.Open(asset.LocalPath)
		if err != nil {
			break
		}
		defer file.Close()
		info, err := file.Stat()
		if err != nil {
			break
		}
		w.Header().Set("Content-Type", asset.ContentType)
		w.Header().Set("Cache-Control", "private, max-age=3600")
		http.ServeContent(w, r, filepath.Base(asset.LocalPath), info.ModTime(), file)
		return
	}
	writeError(w, http.StatusNotFound, "not found")
}

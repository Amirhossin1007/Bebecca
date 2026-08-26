package api

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"github.com/rebeccapanel/rebecca/internal/app/nodecontroller"
)

const maxHAProxyTemplateUpload = 32 << 20

func (s *Server) handleHAProxyRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/haproxy" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	repo := s.haproxyRepository()
	switch r.Method {
	case http.MethodGet:
		configs, err := repo.HAProxyConfigs(r.Context())
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		nodes, err := repo.HAProxyNodes(r.Context())
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		uploads, err := repo.HAProxyUploadedTemplates(r.Context())
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		certificates, err := s.certificateManager.List(r.Context())
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"configs": configs, "nodes": nodes,
			"templates": nodecontroller.HAProxyTemplates(), "uploaded_templates": uploads, "certificates": certificates,
		})
	case http.MethodPost:
		var payload nodecontroller.HAProxyConfig
		if err := decodeOptionalJSON(r, &payload); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		payload.ID = 0
		saved, targets, err := repo.SaveHAProxyConfig(r.Context(), payload)
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		if err := s.queueHAProxyTargets(r.Context(), repo, targets); err != nil {
			writeHAProxyError(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, saved)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleHAProxyPath(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/haproxy/"), "/")
	if strings.HasPrefix(path, "candidates/") {
		s.handleHAProxyCandidates(w, r, strings.TrimPrefix(path, "candidates/"))
		return
	}
	if path == "templates" {
		s.handleHAProxyTemplateUpload(w, r)
		return
	}
	if path == "preview" {
		s.handleHAProxyPreview(w, r)
		return
	}
	configID, err := strconv.ParseInt(path, 10, 64)
	if err != nil || configID <= 0 || strings.Contains(path, "/") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	repo := s.haproxyRepository()
	switch r.Method {
	case http.MethodGet:
		config, err := repo.HAProxyConfig(r.Context(), configID)
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, config)
	case http.MethodPut:
		var payload nodecontroller.HAProxyConfig
		if err := decodeOptionalJSON(r, &payload); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		payload.ID = configID
		saved, targets, err := repo.SaveHAProxyConfig(r.Context(), payload)
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		if err := s.queueHAProxyTargets(r.Context(), repo, targets); err != nil {
			writeHAProxyError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, saved)
	case http.MethodDelete:
		targets, err := repo.DeleteHAProxyConfig(r.Context(), configID)
		if err != nil {
			writeHAProxyError(w, err)
			return
		}
		if err := s.queueHAProxyTargets(r.Context(), repo, targets); err != nil {
			writeHAProxyError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"ok": true})
	default:
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (s *Server) handleHAProxyPreview(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var payload nodecontroller.HAProxyConfig
	if err := decodeOptionalJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	preview, err := s.haproxyRepository().PreviewHAProxyConfig(r.Context(), payload)
	if err != nil {
		writeHAProxyError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, preview)
}

func (s *Server) handleHAProxyCandidates(w http.ResponseWriter, r *http.Request, rawID string) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	nodeID, err := strconv.ParseInt(rawID, 10, 64)
	if err != nil || nodeID <= 0 {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	candidates, err := s.haproxyRepository().HAProxyCandidates(r.Context(), nodeID)
	if err != nil {
		writeHAProxyError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"candidates": candidates})
}

func (s *Server) handleHAProxyTemplateUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	if err := r.ParseMultipartForm(maxHAProxyTemplateUpload + 1<<20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid template upload")
		return
	}
	file, header, err := r.FormFile("archive")
	if err != nil {
		writeError(w, http.StatusBadRequest, "template ZIP is required")
		return
	}
	defer file.Close()
	archive, err := io.ReadAll(io.LimitReader(file, maxHAProxyTemplateUpload+1))
	if err != nil || len(archive) > maxHAProxyTemplateUpload {
		writeError(w, http.StatusRequestEntityTooLarge, "template ZIP is limited to 32 MiB")
		return
	}
	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		name = header.Filename
	}
	template, err := s.haproxyRepository().SaveHAProxyTemplate(r.Context(), name, archive)
	if err != nil {
		writeHAProxyError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, template)
}

func (s *Server) queueHAProxyTargets(ctx context.Context, repo nodecontroller.Repository, targets []int64) error {
	for _, nodeID := range targets {
		id := nodeID
		if err := repo.QueueSyncConfig(ctx, &id, map[string]any{"source": "haproxy"}); err != nil {
			return err
		}
	}
	s.kickNodeOperationsSoon()
	return nil
}

func (s *Server) handleNodeHAProxyTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/internal/node/haproxy-template/"), "/")
	nodeID, err := strconv.ParseInt(r.URL.Query().Get("node_id"), 10, 64)
	if err != nil || nodeID <= 0 || len(id) != 64 || strings.Contains(id, "/") {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if err := s.validateHAProxyTemplateToken(r.Context(), nodeID, bearerToken(r)); err != nil {
		writeStatusError(w, err)
		return
	}
	name, archive, err := s.haproxyRepository().HAProxyTemplateArchive(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "template not found")
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename=%q`, strings.ReplaceAll(name, `"`, "")))
	w.Header().Set("ETag", `"`+id+`"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(archive)
}

func (s *Server) haproxyRepository() nodecontroller.Repository {
	return nodecontroller.NewRepository(s.db, s.dialect, s.cfg.CertificateBase)
}

func (s *Server) validateHAProxyTemplateToken(ctx context.Context, nodeID int64, token string) error {
	var cert string
	err := s.db.QueryRowContext(ctx, `SELECT COALESCE(certificate, '') FROM nodes WHERE id = ? AND LOWER(COALESCE(status, '')) <> 'deleted' LIMIT 1`, nodeID).Scan(&cert)
	if err == sql.ErrNoRows {
		return statusError{status: http.StatusForbidden, detail: "node not found"}
	}
	if err != nil {
		return err
	}
	secret, err := s.nodeSessionCallbackSecret(ctx)
	if err != nil {
		return err
	}
	expected := nodecontroller.NodeSessionEventToken(secret, nodeID, cert)
	if expected == "" || subtle.ConstantTimeCompare([]byte(expected), []byte(strings.TrimSpace(token))) != 1 {
		return statusError{status: http.StatusForbidden, detail: "invalid node token"}
	}
	return nil
}

func writeHAProxyError(w http.ResponseWriter, err error) {
	message := strings.ToLower(err.Error())
	if strings.Contains(message, "not found") {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	if strings.Contains(message, "no such table") || strings.Contains(message, "doesn't exist") {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeError(w, http.StatusBadRequest, err.Error())
}

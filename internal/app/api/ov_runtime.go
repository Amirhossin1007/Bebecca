package api

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/rebeccapanel/rebecca/internal/app/xrayconfig"
)

func (s *Server) handleOVRuntime(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/inbounds/openvpn/runtime" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	target, err := OVRuntimeTarget(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	inbounds, err := s.configRepo.FullInbounds(r.Context())
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	response, err := s.nodeController.OVRuntimeForTarget(r.Context(), target, inbounds)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func OVRuntimeTarget(r *http.Request) (string, error) {
	query := r.URL.Query()
	if raw := strings.TrimSpace(query.Get("node_id")); raw != "" {
		nodeID, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || nodeID <= 0 {
			return "", fmt.Errorf("invalid node_id")
		}
		return xrayconfig.NodeTargetID(nodeID), nil
	}
	target := strings.TrimSpace(query.Get("target"))
	if target == "" {
		return "", nil
	}
	normalized, nodeID, err := xrayconfig.ParseTargetID(target)
	if err != nil {
		return "", err
	}
	if normalized == xrayconfig.MasterTargetID {
		return xrayconfig.MasterTargetID, nil
	}
	if nodeID == nil {
		return "", fmt.Errorf("invalid target")
	}
	return xrayconfig.NodeTargetID(*nodeID), nil
}

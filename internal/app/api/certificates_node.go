package api

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"

	certificateapp "github.com/rebeccapanel/rebecca/internal/app/certificates"
	"github.com/rebeccapanel/rebecca/internal/app/nodecontroller"
)

func (s *Server) handleCertificateIssueNode(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
		return
	}
	var payload struct {
		NodeID int64  `json:"node_id"`
		Domain string `json:"domain"`
		Email  string `json:"email"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, certificateRequestLimit)
	if err := decodeOptionalJSON(r, &payload); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if payload.NodeID <= 0 {
		writeError(w, http.StatusBadRequest, "node_id is required")
		return
	}
	node, err := s.nodeController.Get(r.Context(), nodecontroller.Request{NodeID: payload.NodeID})
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	identifier := strings.TrimSpace(payload.Domain)
	if identifier == "" {
		identifier = node.Address
	}
	record, err := s.certificateManager.IssueFromNode(r.Context(), certificateapp.NodeIssueRequest{
		NodeID:     payload.NodeID,
		Identifier: identifier,
		Email:      payload.Email,
	})
	writeCertificateResponse(w, record, err)
}

func (s *Server) issueNodeCertificate(ctx context.Context, nodeID int64, identifier, email string) ([]byte, []byte, error) {
	node, err := s.nodeController.Get(ctx, nodecontroller.Request{NodeID: nodeID})
	if err != nil {
		return nil, nil, err
	}
	if net.ParseIP(identifier) != nil && !sameIPAddress(node.Address, identifier) {
		return nil, nil, fmt.Errorf("node address is %s, not %s; issue a new certificate for the current address", node.Address, identifier)
	}
	return s.nodeController.IssueCertificate(ctx, nodeID, identifier, email)
}

func sameIPAddress(a, b string) bool {
	ipA := net.ParseIP(a)
	ipB := net.ParseIP(b)
	return ipA != nil && ipB != nil && ipA.Equal(ipB)
}

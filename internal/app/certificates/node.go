package certificates

import (
	"context"
	"fmt"
	"net"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	nodeIssuedMetadataKey        = "issued_via_node"
	nodeCertificateProvider      = "letsencrypt"
	nodeIPCertificateRenewWindow = 48 * time.Hour
)

type NodeIssuer func(ctx context.Context, nodeID int64, identifier, email string) ([]byte, []byte, error)

type NodeIssueRequest struct {
	NodeID     int64
	Identifier string
	Email      string
	AdminID    *int64
}

func (m *Manager) SetNodeIssuer(issuer NodeIssuer) {
	m.nodeIssuer = issuer
}

func (m *Manager) IssueFromNode(ctx context.Context, request NodeIssueRequest) (Record, error) {
	if m.nodeIssuer == nil {
		return Record{}, fmt.Errorf("%w: node certificate issuance is not configured", ErrUnsupported)
	}
	identifier, err := normalizeRecordName(request.Identifier)
	if err != nil {
		return Record{}, err
	}
	email, err := normalizeEmail(request.Email)
	if err != nil {
		return Record{}, err
	}
	if !m.operationMutex.TryLock() {
		return Record{}, ErrBusy
	}
	defer m.operationMutex.Unlock()
	if err := m.ensureAdmin(ctx, request.AdminID); err != nil {
		return Record{}, err
	}
	fullchain, privateKey, err := m.nodeIssuer(ctx, request.NodeID, identifier, email)
	if err != nil {
		return Record{}, fmt.Errorf("%w: %v", ErrNodeIssue, err)
	}
	now := time.Now().UTC()
	metadata := map[string]string{
		nodeIssuedMetadataKey: strconv.FormatInt(request.NodeID, 10),
		"status":              "active",
	}
	return m.store(ctx, identifier, request.AdminID, &email, nodeCertificateProvider, nil, fullchain, privateKey, metadata, now, time.Time{})
}

func (m *Manager) renewNodeLocked(ctx context.Context, record Record) (Record, error) {
	if m.nodeIssuer == nil {
		return Record{}, fmt.Errorf("%w: node certificate issuance is not configured", ErrUnsupported)
	}
	metadata := readMetadata(filepath.Join(m.baseDir, record.Domain, ".metadata"))
	fullchain, privateKey, err := m.nodeIssuer(ctx, *record.NodeID, record.Domain, valueOrEmpty(record.Email))
	if err != nil {
		return Record{}, fmt.Errorf("%w: %v", ErrNodeIssue, err)
	}
	now := time.Now().UTC()
	metadata["renewed_at"] = strconv.FormatInt(now.Unix(), 10)
	metadata["status"] = "active"
	return m.store(ctx, record.Domain, record.AdminID, record.Email, normalizeProvider(valueOrEmpty(record.Provider)), record.AltNames, fullchain, privateKey, metadata, time.Time{}, now)
}

func normalizeRecordName(value string) (string, error) {
	if ip := net.ParseIP(strings.TrimSpace(value)); ip != nil {
		return ip.String(), nil
	}
	return normalizeDomain(value)
}

func nodeIPCertificate(record Record) bool {
	return record.NodeID != nil && net.ParseIP(record.Domain) != nil
}

package masterapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type contextKey string

const adminContextKey contextKey = "admin"

type adminPrincipal struct {
	ID       int64
	Username string
	Role     string
}

type authPayload struct {
	Subject string          `json:"sub"`
	Role    string          `json:"role"`
	Access  string          `json:"access"`
	Issued  json.RawMessage `json:"iat"`
	Expires json.RawMessage `json:"exp"`
}

func (s *Server) requireSudo(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		admin, err := s.authenticate(r.Context(), r)
		if err != nil {
			writeError(w, http.StatusUnauthorized, err.Error())
			return
		}
		if admin.Role != "sudo" && admin.Role != "full_access" {
			writeError(w, http.StatusForbidden, "You're not allowed")
			return
		}
		ctx := context.WithValue(r.Context(), adminContextKey, admin)
		next(w, r.WithContext(ctx))
	}
}

func (s *Server) authenticate(ctx context.Context, r *http.Request) (adminPrincipal, error) {
	token := bearerToken(r)
	if token == "" {
		return adminPrincipal{}, errors.New("missing bearer token")
	}
	secret, err := s.adminSecret(ctx)
	if err != nil {
		return adminPrincipal{}, err
	}
	payload, issuedAt, err := verifyAdminJWT(token, secret)
	if err != nil {
		return adminPrincipal{}, err
	}
	username := strings.TrimSpace(payload.Subject)
	if username == "" {
		return adminPrincipal{}, errors.New("invalid token subject")
	}
	role := normalizeRole(payload.Role)
	if role == "" {
		role = normalizeRole(payload.Access)
	}
	if role == "" {
		return adminPrincipal{}, errors.New("invalid token role")
	}

	admin, resetAt, err := s.adminByUsername(ctx, username)
	if err != nil {
		return adminPrincipal{}, err
	}
	if admin.Role != "sudo" && admin.Role != "full_access" && role != admin.Role {
		return adminPrincipal{}, errors.New("token role does not match admin role")
	}
	if resetAt != nil && issuedAt != nil && resetAt.After(*issuedAt) {
		return adminPrincipal{}, errors.New("token was issued before password reset")
	}
	return admin, nil
}

func bearerToken(r *http.Request) string {
	header := strings.TrimSpace(r.Header.Get("Authorization"))
	if strings.HasPrefix(strings.ToLower(header), "bearer ") {
		return strings.TrimSpace(header[7:])
	}
	if token := strings.TrimSpace(r.URL.Query().Get("token")); token != "" {
		return token
	}
	return ""
}

func (s *Server) adminSecret(ctx context.Context) (string, error) {
	var adminSecret, legacySecret sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT admin_secret_key, secret_key FROM jwt ORDER BY id LIMIT 1`).Scan(&adminSecret, &legacySecret)
	if err == sql.ErrNoRows {
		return "", errors.New("jwt secret is not initialized")
	}
	if err != nil {
		return "", err
	}
	if adminSecret.Valid && strings.TrimSpace(adminSecret.String) != "" {
		return strings.TrimSpace(adminSecret.String), nil
	}
	if legacySecret.Valid && strings.TrimSpace(legacySecret.String) != "" {
		return strings.TrimSpace(legacySecret.String), nil
	}
	return "", errors.New("admin jwt secret is empty")
}

func (s *Server) adminByUsername(ctx context.Context, username string) (adminPrincipal, *time.Time, error) {
	var admin adminPrincipal
	var status string
	var resetRaw any
	err := s.db.QueryRowContext(
		ctx,
		`SELECT id, username, role, status, password_reset_at FROM admins WHERE LOWER(username) = LOWER(?) LIMIT 1`,
		username,
	).Scan(&admin.ID, &admin.Username, &admin.Role, &status, &resetRaw)
	if err == sql.ErrNoRows {
		return adminPrincipal{}, nil, errors.New("admin not found")
	}
	if err != nil {
		return adminPrincipal{}, nil, err
	}
	if status != "active" {
		return adminPrincipal{}, nil, errors.New("admin is not active")
	}
	resetAt := parseOptionalDBTime(resetRaw)
	return admin, resetAt, nil
}

func verifyAdminJWT(token string, secret string) (authPayload, *time.Time, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return authPayload{}, nil, errors.New("invalid token format")
	}
	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return authPayload{}, nil, errors.New("invalid token header")
	}
	var header struct {
		Algorithm string `json:"alg"`
	}
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return authPayload{}, nil, errors.New("invalid token header")
	}
	if header.Algorithm != "HS256" {
		return authPayload{}, nil, errors.New("unsupported token algorithm")
	}

	signed := parts[0] + "." + parts[1]
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(signed))
	expected := mac.Sum(nil)
	actual, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || !hmac.Equal(expected, actual) {
		return authPayload{}, nil, errors.New("invalid token signature")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return authPayload{}, nil, errors.New("invalid token payload")
	}
	var payload authPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return authPayload{}, nil, errors.New("invalid token payload")
	}

	now := time.Now().UTC()
	if exp, ok, err := parseJWTTime(payload.Expires); err != nil {
		return authPayload{}, nil, fmt.Errorf("invalid token expiration: %w", err)
	} else if ok && now.After(exp) {
		return authPayload{}, nil, errors.New("token expired")
	}

	issuedAt := (*time.Time)(nil)
	if iat, ok, err := parseJWTTime(payload.Issued); err == nil && ok {
		issuedAt = &iat
	}
	return payload, issuedAt, nil
}

func normalizeRole(value string) string {
	value = strings.TrimSpace(value)
	if value == "admin" {
		return "standard"
	}
	switch value {
	case "standard", "sudo", "full_access":
		return value
	default:
		return ""
	}
}

func parseJWTTime(raw json.RawMessage) (time.Time, bool, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return time.Time{}, false, nil
	}
	var number float64
	if err := json.Unmarshal(raw, &number); err == nil {
		seconds := int64(number)
		nanos := int64((number - float64(seconds)) * 1e9)
		return time.Unix(seconds, nanos).UTC(), true, nil
	}
	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return time.Time{}, false, err
	}
	if numeric, err := strconv.ParseFloat(text, 64); err == nil {
		seconds := int64(numeric)
		nanos := int64((numeric - float64(seconds)) * 1e9)
		return time.Unix(seconds, nanos).UTC(), true, nil
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
	} {
		if parsed, err := time.Parse(layout, text); err == nil {
			return parsed.UTC(), true, nil
		}
	}
	return time.Time{}, false, fmt.Errorf("unsupported timestamp")
}

func parseOptionalDBTime(value any) *time.Time {
	switch typed := value.(type) {
	case nil:
		return nil
	case time.Time:
		utc := typed.UTC()
		return &utc
	case []byte:
		return parseOptionalDBTime(string(typed))
	case string:
		value = typed
	default:
		return nil
	}
	text := strings.TrimSpace(value.(string))
	if text == "" {
		return nil
	}
	for _, layout := range []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05.999999",
		"2006-01-02 15:04:05",
	} {
		if parsed, err := time.Parse(layout, text); err == nil {
			utc := parsed.UTC()
			return &utc
		}
	}
	return nil
}

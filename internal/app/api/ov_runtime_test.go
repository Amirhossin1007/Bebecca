package api

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestOVRuntimeEndpointReturnsInboundList(t *testing.T) {
	server := newEntityNoteTestServer(t)
	root := entityNoteLogin(t, server, "root")
	rec := sqliteJSONRequest(server, http.MethodGet, "/api/inbounds/openvpn/runtime", root, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		Inbounds []json.RawMessage `json:"inbounds"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || body.Inbounds == nil {
		t.Fatalf("response must carry an inbounds list: %s", rec.Body.String())
	}
	if rec := sqliteJSONRequest(server, http.MethodGet, "/api/inbounds/openvpn/runtime?node_id=-1", root, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("invalid node_id status=%d want 400", rec.Code)
	}
}

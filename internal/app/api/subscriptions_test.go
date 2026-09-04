package api

import (
	"net/http/httptest"
	"testing"
)

func TestRequestAbsoluteURLPreservesForwardedPort(t *testing.T) {
	for _, test := range []struct {
		name          string
		host          string
		forwardedPort string
	}{
		{name: "forwarded port", host: "127.0.0.1:8000", forwardedPort: "8443"},
		{name: "original host port", host: "domain.com:8443"},
	} {
		t.Run(test.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "http://domain.com/sub/gjjghghjjghj", nil)
			req.Host = test.host
			req.Header.Set("X-Forwarded-Proto", "https")
			req.Header.Set("X-Forwarded-Host", "domain.com")
			req.Header.Set("X-Forwarded-Port", test.forwardedPort)

			if got, want := requestAbsoluteURL(req), "https://domain.com:8443/sub/gjjghghjjghj"; got != want {
				t.Fatalf("requestAbsoluteURL() = %q, want %q", got, want)
			}
		})
	}
}

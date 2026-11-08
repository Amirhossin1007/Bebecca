package api

import "testing"

func TestManagedOutboundProvider(t *testing.T) {
	for _, test := range []struct {
		name     string
		outbound map[string]any
		want     string
	}{
		{name: "metadata", outbound: map[string]any{"rebecca_proxy": "tor"}, want: "tor"},
		{name: "legacy tag", outbound: map[string]any{"tag": "psiphon-de"}, want: "psiphon"},
		{name: "unmanaged", outbound: map[string]any{"tag": "direct"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if got := managedOutboundProvider(test.outbound); got != test.want {
				t.Fatalf("managedOutboundProvider() = %q, want %q", got, test.want)
			}
		})
	}
}

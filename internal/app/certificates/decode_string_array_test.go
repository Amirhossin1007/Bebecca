package certificates

import "testing"

func TestDecodeStringArrayNullIsEmpty(t *testing.T) {
	if got := decodeStringArray("null"); got == nil || len(got) != 0 {
		t.Fatalf("decodeStringArray(null) = %#v", got)
	}
}

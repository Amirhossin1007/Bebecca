package jsonvalue

import "testing"

func TestJSONValueCoercion(t *testing.T) {
	if String(nil) != "" || String(" a ") != "a" || String(float64(3)) != "3" || String(1.5) != "1.5" || String(true) != "true" {
		t.Fatal("String coercion changed")
	}
	if Int("42") != 42 || Int(float64(7)) != 7 || Int("x") != 0 {
		t.Fatal("Int coercion changed")
	}
	if !Bool("YES") || !Bool(float64(1)) || Bool("no") || Bool(nil) {
		t.Fatal("Bool coercion changed")
	}
	if FirstNonEmpty(nil, " ", "b", "c") != "b" {
		t.Fatal("FirstNonEmpty must skip blank values")
	}
	if FirstNonEmptyAny(nil, "", []any{}, "x") != "x" || FirstNonEmptyAny(nil) != nil {
		t.Fatal("FirstNonEmptyAny must skip empty values")
	}
	target := map[string]any{}
	CopyOptional(target, "port", map[string]any{"listen_port": 443}, "listen_port")
	if target["port"] != 443 {
		t.Fatalf("CopyOptional alias: %v", target)
	}
}

func TestNonEmptyStringsAndListAny(t *testing.T) {
	if got := NonEmptyStrings("a", "", "b"); len(got) != 2 || got[0] != "a" || got[1] != "b" {
		t.Fatalf("NonEmptyStrings=%v", got)
	}
	if got := ListAny([]map[string]any{{"k": 1}}); len(got) != 1 {
		t.Fatalf("ListAny map slice=%v", got)
	}
	if ListAny("x") != nil {
		t.Fatal("ListAny must return nil for scalars")
	}
}

package xrayconfig

import (
	"reflect"
	"testing"
)

func propagationTestConfig() map[string]any {
	return map[string]any{
		"outbounds": []any{
			map[string]any{"tag": "A", "protocol": "freedom"},
			map[string]any{"tag": "B", "protocol": "blackhole"},
		},
		"routing": map[string]any{
			"rules": []any{
				map[string]any{"type": "field", "domain": []any{"example.com"}, "outboundTag": "A"},
			},
			"balancers": []any{
				map[string]any{"tag": "bal", "selector": []any{"A", "B"}},
			},
		},
		"observatory": map[string]any{"subjectSelector": []any{"A"}},
	}
}

func TestPropagationStatusReportsMissingDifferentAndConflict(t *testing.T) {
	cfg := propagationTestConfig()
	rule := map[string]any{"type": "field", "domain": []any{"example.com"}, "outboundTag": "A"}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationRules, Before: rule}); status != PropagationOK {
		t.Fatalf("identical rule status = %s", status)
	}
	other := map[string]any{"type": "field", "domain": []any{"other.com"}, "outboundTag": "A"}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationRules, Before: other}); status != PropagationMissing {
		t.Fatalf("missing rule status = %s", status)
	}
	changed := map[string]any{"tag": "A", "protocol": "vmess"}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationOutbounds, Before: changed, After: changed}); status != PropagationDifferent {
		t.Fatalf("different outbound status = %s", status)
	}
	missing := map[string]any{"tag": "Z", "protocol": "freedom"}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationOutbounds, Before: missing, After: missing}); status != PropagationMissing {
		t.Fatalf("missing outbound status = %s", status)
	}
	added := map[string]any{"tag": "B", "protocol": "freedom"}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationOutbounds, After: added}); status != PropagationConflict {
		t.Fatalf("add with existing tag status = %s", status)
	}
}

func TestPropagationIgnoresEmptyFieldsWhenMatching(t *testing.T) {
	cfg := propagationTestConfig()
	withEmpty := map[string]any{"type": "field", "domain": []any{"example.com"}, "outboundTag": "A", "inboundTag": []any{}, "user": ""}
	if status := propagationStatus(cfg, PropagationOp{Section: PropagationRules, Before: withEmpty}); status != PropagationOK {
		t.Fatalf("rule with empty fields status = %s", status)
	}
}

func TestApplyPropagationRenamesOutboundReferences(t *testing.T) {
	cfg := propagationTestConfig()
	before := map[string]any{"tag": "A", "protocol": "freedom"}
	after := map[string]any{"tag": "C", "protocol": "freedom"}
	if err := applyPropagation(cfg, PropagationOp{Section: PropagationOutbounds, Before: before, After: after}); err != nil {
		t.Fatal(err)
	}
	if got := cfg["outbounds"].([]any)[0].(map[string]any)["tag"]; got != "C" {
		t.Fatalf("outbound tag = %v", got)
	}
	rules := cfg["routing"].(map[string]any)["rules"].([]any)
	if got := rules[0].(map[string]any)["outboundTag"]; got != "C" {
		t.Fatalf("rule outboundTag = %v", got)
	}
	selector := cfg["routing"].(map[string]any)["balancers"].([]any)[0].(map[string]any)["selector"]
	if !reflect.DeepEqual(selector, []any{"C", "B"}) {
		t.Fatalf("balancer selector = %v", selector)
	}
	if got := cfg["observatory"].(map[string]any)["subjectSelector"]; !reflect.DeepEqual(got, []any{"C"}) {
		t.Fatalf("observatory selector = %v", got)
	}
}

func TestApplyPropagationRenamesBalancerReferences(t *testing.T) {
	cfg := propagationTestConfig()
	cfg["routing"].(map[string]any)["rules"] = []any{
		map[string]any{"type": "field", "domain": []any{"example.com"}, "balancerTag": "bal"},
	}
	before := map[string]any{"tag": "bal", "selector": []any{"A", "B"}}
	after := map[string]any{"tag": "bal2", "selector": []any{"A", "B"}}
	if err := applyPropagation(cfg, PropagationOp{Section: PropagationBalancers, Before: before, After: after}); err != nil {
		t.Fatal(err)
	}
	rules := cfg["routing"].(map[string]any)["rules"].([]any)
	if got := rules[0].(map[string]any)["balancerTag"]; got != "bal2" {
		t.Fatalf("rule balancerTag = %v", got)
	}
}

func TestApplyPropagationReplacesRuleAndAppendsOutbound(t *testing.T) {
	cfg := propagationTestConfig()
	before := map[string]any{"type": "field", "domain": []any{"example.com"}, "outboundTag": "A"}
	after := map[string]any{"type": "field", "domain": []any{"example.org"}, "outboundTag": "A"}
	if err := applyPropagation(cfg, PropagationOp{Section: PropagationRules, Before: before, After: after}); err != nil {
		t.Fatal(err)
	}
	if got := cfg["routing"].(map[string]any)["rules"].([]any)[0].(map[string]any)["domain"]; !reflect.DeepEqual(got, []any{"example.org"}) {
		t.Fatalf("replaced rule domain = %v", got)
	}
	added := map[string]any{"tag": "D", "protocol": "freedom"}
	if err := applyPropagation(cfg, PropagationOp{Section: PropagationOutbounds, After: added}); err != nil {
		t.Fatal(err)
	}
	if outbounds := cfg["outbounds"].([]any); len(outbounds) != 3 || outbounds[2].(map[string]any)["tag"] != "D" {
		t.Fatalf("outbounds after add = %v", outbounds)
	}
}

func TestApplyPropagationRejectsItemThatDoesNotMatch(t *testing.T) {
	cfg := propagationTestConfig()
	before := map[string]any{"tag": "A", "protocol": "vmess"}
	if err := applyPropagation(cfg, PropagationOp{Section: PropagationOutbounds, Before: before, After: before}); err == nil {
		t.Fatal("expected a different outbound to be rejected")
	}
}

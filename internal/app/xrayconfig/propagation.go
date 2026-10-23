package xrayconfig

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/rebeccapanel/rebecca/internal/app/jsonvalue"
)

const (
	PropagationRules     = "routing.rules"
	PropagationOutbounds = "outbounds"
	PropagationBalancers = "balancers"

	PropagationOK        = "ok"
	PropagationMissing   = "missing"
	PropagationDifferent = "different"
	PropagationConflict  = "conflict"
)

type PropagationOp struct {
	Source  string         `json:"source"`
	Section string         `json:"section"`
	Before  map[string]any `json:"before"`
	After   map[string]any `json:"after"`
	Targets []string       `json:"targets"`
}

type PropagationResult struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Status  string `json:"status"`
	Applied bool   `json:"applied"`
	Error   string `json:"error,omitempty"`
}

type propagationTarget struct {
	id     string
	name   string
	config map[string]any
	status string
}

func validPropagationSection(section string) bool {
	return section == PropagationRules || section == PropagationOutbounds || section == PropagationBalancers
}

func propagationItems(cfg map[string]any, section string) []any {
	if section == PropagationOutbounds {
		items, _ := cfg["outbounds"].([]any)
		return items
	}
	routing, _ := cfg["routing"].(map[string]any)
	items, _ := routing[propagationKey(section)].([]any)
	return items
}

func setPropagationItems(cfg map[string]any, section string, items []any) {
	if section == PropagationOutbounds {
		cfg["outbounds"] = items
		return
	}
	routing, _ := cfg["routing"].(map[string]any)
	if routing == nil {
		routing = map[string]any{}
		cfg["routing"] = routing
	}
	routing[propagationKey(section)] = items
}

func propagationKey(section string) string {
	if section == PropagationBalancers {
		return "balancers"
	}
	return "rules"
}

func canonicalPropagationJSON(value any) string {
	raw, _ := json.Marshal(canonicalPropagationValue(value))
	return string(raw)
}

func canonicalPropagationValue(value any) any {
	switch typed := value.(type) {
	case map[string]any:
		out := make(map[string]any, len(typed))
		for key, item := range typed {
			normalized := canonicalPropagationValue(item)
			if isEmptyPropagationValue(normalized) {
				continue
			}
			out[key] = normalized
		}
		return out
	case []any:
		out := make([]any, 0, len(typed))
		for _, item := range typed {
			out = append(out, canonicalPropagationValue(item))
		}
		return out
	default:
		return value
	}
}

func isEmptyPropagationValue(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return typed == ""
	case []any:
		return len(typed) == 0
	case map[string]any:
		return len(typed) == 0
	}
	return false
}

func propagationTagExists(items []any, tag string) bool {
	for _, item := range items {
		if entry, ok := item.(map[string]any); ok && jsonvalue.String(entry["tag"]) == tag {
			return true
		}
	}
	return false
}

func locatePropagationItem(items []any, section string, before map[string]any) (int, string) {
	if section == PropagationRules {
		want := canonicalPropagationJSON(before)
		for index, item := range items {
			if canonicalPropagationJSON(item) == want {
				return index, PropagationOK
			}
		}
		return -1, PropagationMissing
	}
	tag := jsonvalue.String(before["tag"])
	for index, item := range items {
		entry, ok := item.(map[string]any)
		if !ok || jsonvalue.String(entry["tag"]) != tag {
			continue
		}
		if canonicalPropagationJSON(entry) == canonicalPropagationJSON(before) {
			return index, PropagationOK
		}
		return index, PropagationDifferent
	}
	return -1, PropagationMissing
}

func propagationStatus(cfg map[string]any, op PropagationOp) string {
	items := propagationItems(cfg, op.Section)
	if op.Before == nil {
		if op.After != nil && op.Section != PropagationRules && propagationTagExists(items, jsonvalue.String(op.After["tag"])) {
			return PropagationConflict
		}
		return PropagationOK
	}
	_, status := locatePropagationItem(items, op.Section, op.Before)
	if status != PropagationOK {
		return status
	}
	if op.After != nil && op.Section != PropagationRules {
		newTag := jsonvalue.String(op.After["tag"])
		if newTag != jsonvalue.String(op.Before["tag"]) && propagationTagExists(items, newTag) {
			return PropagationConflict
		}
	}
	return PropagationOK
}

func applyPropagation(cfg map[string]any, op PropagationOp) error {
	if op.After == nil {
		return errors.New("propagation needs the edited item")
	}
	items := propagationItems(cfg, op.Section)
	if op.Before == nil {
		setPropagationItems(cfg, op.Section, append(items, deepCopyMap(op.After)))
		return nil
	}
	index, status := locatePropagationItem(items, op.Section, op.Before)
	if status != PropagationOK {
		return fmt.Errorf("item is %s on this node", status)
	}
	items[index] = deepCopyMap(op.After)
	setPropagationItems(cfg, op.Section, items)
	if op.Section != PropagationRules {
		oldTag, newTag := jsonvalue.String(op.Before["tag"]), jsonvalue.String(op.After["tag"])
		if oldTag != newTag {
			renamePropagationReferences(cfg, op.Section, oldTag, newTag)
		}
	}
	return nil
}

func renamePropagationReferences(cfg map[string]any, section string, oldTag string, newTag string) {
	rules := propagationItems(cfg, PropagationRules)
	if section == PropagationOutbounds {
		for _, item := range rules {
			renamePropagationField(item, "outboundTag", oldTag, newTag)
		}
		for _, item := range propagationItems(cfg, PropagationBalancers) {
			if balancer, ok := item.(map[string]any); ok {
				renamePropagationList(balancer["selector"], oldTag, newTag)
			}
		}
		for _, key := range []string{"observatory", "burstObservatory"} {
			if observatory, ok := cfg[key].(map[string]any); ok {
				renamePropagationList(observatory["subjectSelector"], oldTag, newTag)
			}
		}
		return
	}
	for _, item := range rules {
		renamePropagationField(item, "balancerTag", oldTag, newTag)
	}
}

func renamePropagationField(item any, key string, oldTag string, newTag string) {
	entry, ok := item.(map[string]any)
	if !ok {
		return
	}
	if value, ok := entry[key].(string); ok && value == oldTag {
		entry[key] = newTag
	}
}

func renamePropagationList(value any, oldTag string, newTag string) {
	list, ok := value.([]any)
	if !ok {
		return
	}
	for index, item := range list {
		if text, ok := item.(string); ok && text == oldTag {
			list[index] = newTag
		}
	}
}

func (r Repository) propagationTargets(ctx context.Context, op PropagationOp) ([]propagationTarget, error) {
	if !validPropagationSection(op.Section) {
		return nil, errors.New("invalid propagation section")
	}
	targets, err := r.ListConfigTargets(ctx)
	if err != nil {
		return nil, err
	}
	result := []propagationTarget{}
	for _, target := range targets {
		if target.Type != "node" || target.Mode != ConfigModeCustom || target.ID == op.Source {
			continue
		}
		cfg, err := r.GetTargetRawConfig(ctx, target.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, propagationTarget{
			id:     target.ID,
			name:   target.Name,
			config: cfg,
			status: propagationStatus(cfg, op),
		})
	}
	return result, nil
}

func (r Repository) PreviewPropagation(ctx context.Context, op PropagationOp) ([]PropagationResult, error) {
	targets, err := r.propagationTargets(ctx, op)
	if err != nil {
		return nil, err
	}
	results := make([]PropagationResult, 0, len(targets))
	for _, target := range targets {
		results = append(results, PropagationResult{ID: target.id, Name: target.name, Status: target.status})
	}
	return results, nil
}

func (r Repository) ApplyPropagation(ctx context.Context, op PropagationOp) ([]PropagationResult, error) {
	targets, err := r.propagationTargets(ctx, op)
	if err != nil {
		return nil, err
	}
	selected := make(map[string]bool, len(op.Targets))
	for _, id := range op.Targets {
		selected[id] = true
	}
	results := []PropagationResult{}
	for _, target := range targets {
		if !selected[target.id] {
			continue
		}
		result := PropagationResult{ID: target.id, Name: target.name, Status: target.status}
		if target.status != PropagationOK {
			results = append(results, result)
			continue
		}
		next := deepCopyMap(target.config)
		if err := applyPropagation(next, op); err != nil {
			result.Error = err.Error()
		} else if _, err := r.SaveTargetRawConfig(ctx, target.id, next); err != nil {
			result.Error = err.Error()
		} else {
			result.Applied = true
		}
		results = append(results, result)
	}
	return results, nil
}

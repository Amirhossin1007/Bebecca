package xrayconfig

import (
	"context"
	"fmt"
	"time"

	"github.com/rebeccapanel/rebecca/internal/app/outboundsub"
)

type ConfigIssue struct {
	TargetID     string `json:"target_id"`
	ResourceType string `json:"resource_type"`
	Resource     string `json:"resource"`
	Message      string `json:"message"`
	Severity     string `json:"severity,omitempty"`
}

func inboundValidationError(inbound map[string]any) error {
	if err := validateExecutableInbound(inbound); err != nil {
		return err
	}
	if err := StreamCertificateError(inbound, time.Now()); err != nil {
		return err
	}
	_, err := (&Config{}).resolveInbound(inbound)
	return err
}

func (r Repository) subscriptionOutboundTags(ctx context.Context) []string {
	// Runtime construction also falls back to the saved outbounds when this
	// optional legacy table is unavailable. Do not invent subscription targets.
	tags, _ := outboundsub.NewService(r.db, r.dialect).ActiveTags(ctx)
	return tags
}

func routingIssues(target string, config map[string]any, extraTags []string) []ConfigIssue {
	known := map[string]bool{"API": true}
	known[stringValue(mapValue(config["api"])["tag"])] = true
	for _, tag := range extraTags {
		known[tag] = true
	}
	for _, outbound := range listOfMaps(config["outbounds"]) {
		known[stringValue(outbound["tag"])] = true
	}
	issues := []ConfigIssue{}
	for index, rule := range listOfMaps(mapValue(config["routing"])["rules"]) {
		tag := stringValue(rule["outboundTag"])
		if tag == "" || known[tag] {
			continue
		}
		message := fmt.Sprintf("Routing rule %d references missing outbound %q; matching traffic cannot reach its configured outbound", index+1, tag)
		inbounds := stringList(rule["inboundTag"])
		if len(inbounds) == 0 {
			issues = append(issues, ConfigIssue{TargetID: target, ResourceType: "xray_config", Resource: fmt.Sprintf("Routing rule %d", index+1), Message: message})
		} else {
			for _, inbound := range inbounds {
				issues = append(issues, ConfigIssue{TargetID: target, ResourceType: "inbound", Resource: inbound, Message: message})
			}
		}
	}
	return issues
}

func routingInboundErrors(config map[string]any, extraTags []string) map[string]string {
	result := map[string]string{}
	for _, issue := range routingIssues("", config, extraTags) {
		if issue.ResourceType == "inbound" {
			result[issue.Resource] = issue.Message
		}
	}
	return result
}

// ConfigIssues inspects saved data, including SQL restores that bypassed API validation.
// Reading diagnostics never mutates or applies a runtime configuration.
func (r Repository) ConfigIssues(ctx context.Context) ([]ConfigIssue, error) {
	stored, err := r.IterStoredConfigs(ctx)
	if err != nil {
		return nil, err
	}
	issues := []ConfigIssue{}
	existingTags := map[string]bool{}
	subscriptionTags := r.subscriptionOutboundTags(ctx)
	for _, item := range stored {
		messages := map[string]bool{}
		tags := map[string]bool{}
		for _, inbound := range listOfMaps(item.Config["inbounds"]) {
			tag := stringValue(inbound["tag"])
			existingTags[tag] = true
			err := inboundValidationError(inbound)
			if tags[tag] {
				err = fmt.Errorf("duplicate inbound tag: %s", tag)
			}
			tags[tag] = true
			if err != nil {
				messages[err.Error()] = true
				issues = append(issues, ConfigIssue{TargetID: item.TargetID, ResourceType: "inbound", Resource: tag, Message: err.Error()})
			}
		}
		if _, err := Parse(item.Config, r.manageableParseOptions()); err != nil && !messages[err.Error()] {
			issues = append(issues, ConfigIssue{TargetID: item.TargetID, ResourceType: "xray_config", Resource: item.TargetID, Message: err.Error()})
		}
		issues = append(issues, routingIssues(item.TargetID, item.Config, subscriptionTags)...)
		issues = append(issues, outboundIssues(item.TargetID, item.Config)...)
	}
	rows, err := r.db.QueryContext(ctx, `SELECT DISTINCT inbound_tag FROM hosts WHERE inbound_tag IS NOT NULL`)
	if err != nil {
		return issues, err
	}
	defer rows.Close()
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return nil, err
		}
		if tag != "" && !existingTags[tag] {
			issues = append(issues, ConfigIssue{TargetID: MasterTargetID, ResourceType: "host", Resource: tag, Message: fmt.Sprintf("Host references inbound %q, but this inbound does not exist in any saved Xray configuration", tag)})
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return issues, nil
}

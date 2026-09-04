package settings

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

const subscriptionPlaceholdersKey = "subscription_placeholders"

func defaultSubscriptionPlaceholderPolicy() SubscriptionPlaceholderPolicy {
	return SubscriptionPlaceholderPolicy{
		ExpiredRemark:  "Subscription expired",
		LimitedRemark:  "Traffic limit reached",
		DisabledRemark: "Subscription disabled",
	}
}

func normalizeSubscriptionPlaceholderPolicy(policy SubscriptionPlaceholderPolicy) (SubscriptionPlaceholderPolicy, error) {
	defaults := defaultSubscriptionPlaceholderPolicy()
	policy.ExpiredRemark = strings.TrimSpace(policy.ExpiredRemark)
	policy.LimitedRemark = strings.TrimSpace(policy.LimitedRemark)
	policy.DisabledRemark = strings.TrimSpace(policy.DisabledRemark)
	if policy.ExpiredRemark == "" {
		policy.ExpiredRemark = defaults.ExpiredRemark
	}
	if policy.LimitedRemark == "" {
		policy.LimitedRemark = defaults.LimitedRemark
	}
	if policy.DisabledRemark == "" {
		policy.DisabledRemark = defaults.DisabledRemark
	}
	if len(policy.ExpiredRemark) > 255 || len(policy.LimitedRemark) > 255 || len(policy.DisabledRemark) > 255 {
		return policy, fmt.Errorf("placeholder messages must be 255 characters or fewer")
	}
	return policy, nil
}

func decodeSubscriptionPlaceholderPolicies(raw string) map[string]SubscriptionPlaceholderPolicy {
	settings := map[string]json.RawMessage{}
	if json.Unmarshal([]byte(raw), &settings) != nil {
		return map[string]SubscriptionPlaceholderPolicy{}
	}
	policies := map[string]SubscriptionPlaceholderPolicy{}
	_ = json.Unmarshal(settings[subscriptionPlaceholdersKey], &policies)
	return policies
}

func (r Repository) SubscriptionPlaceholderSettings(ctx context.Context, adminID *int64) ([]SubscriptionPlaceholderSetting, error) {
	query := `SELECT a.id, a.username, s.id, s.name, COALESCE(a.subscription_settings, '{}')
FROM admins a
JOIN admins_services linked ON linked.admin_id = a.id
JOIN services s ON s.id = linked.service_id
WHERE COALESCE(a.status, '') != 'deleted'`
	args := []any{}
	if adminID != nil {
		query += " AND a.id = ?"
		args = append(args, *adminID)
	}
	query += " ORDER BY a.username ASC, s.name ASC"
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []SubscriptionPlaceholderSetting{}
	for rows.Next() {
		var item SubscriptionPlaceholderSetting
		var raw string
		if err := rows.Scan(&item.AdminID, &item.AdminUsername, &item.ServiceID, &item.ServiceName, &raw); err != nil {
			return nil, err
		}
		policy := defaultSubscriptionPlaceholderPolicy()
		if configured, ok := decodeSubscriptionPlaceholderPolicies(raw)[strconv.FormatInt(item.ServiceID, 10)]; ok {
			policy, _ = normalizeSubscriptionPlaceholderPolicy(configured)
		}
		item.SubscriptionPlaceholderPolicy = policy
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r Repository) UpdateSubscriptionPlaceholderSetting(ctx context.Context, adminID, serviceID int64, policy SubscriptionPlaceholderPolicy) (SubscriptionPlaceholderSetting, error) {
	policy, err := normalizeSubscriptionPlaceholderPolicy(policy)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	defer tx.Rollback()

	query := `SELECT a.username, s.name, COALESCE(a.subscription_settings, '{}')
FROM admins a
JOIN admins_services linked ON linked.admin_id = a.id
JOIN services s ON s.id = linked.service_id
WHERE a.id = ? AND s.id = ? AND COALESCE(a.status, '') != 'deleted'`
	if r.dialect == "mysql" {
		query += " FOR UPDATE"
	}
	var username, serviceName, raw string
	if err := tx.QueryRowContext(ctx, query, adminID, serviceID).Scan(&username, &serviceName, &raw); err != nil {
		if err == sql.ErrNoRows {
			return SubscriptionPlaceholderSetting{}, ErrAdminNotFound
		}
		return SubscriptionPlaceholderSetting{}, err
	}

	settings := map[string]json.RawMessage{}
	if err := json.Unmarshal([]byte(raw), &settings); err != nil {
		settings = map[string]json.RawMessage{}
	}
	policies := decodeSubscriptionPlaceholderPolicies(raw)
	policies[strconv.FormatInt(serviceID, 10)] = policy
	encodedPolicies, _ := json.Marshal(policies)
	settings[subscriptionPlaceholdersKey] = encodedPolicies
	encodedSettings, _ := json.Marshal(settings)
	if _, err := tx.ExecContext(ctx, `UPDATE admins SET subscription_settings = ? WHERE id = ?`, string(encodedSettings), adminID); err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	if err := tx.Commit(); err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	return SubscriptionPlaceholderSetting{
		AdminID: adminID, AdminUsername: username, ServiceID: serviceID, ServiceName: serviceName,
		SubscriptionPlaceholderPolicy: policy,
	}, nil
}

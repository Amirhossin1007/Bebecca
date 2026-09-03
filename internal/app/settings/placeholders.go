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

func decodeSubscriptionPlaceholderPolicy(raw string) (SubscriptionPlaceholderPolicy, bool) {
	var policy SubscriptionPlaceholderPolicy
	if json.Unmarshal([]byte(raw), &policy) != nil {
		return policy, false
	}
	normalized, err := normalizeSubscriptionPlaceholderPolicy(policy)
	return normalized, err == nil
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
	result := []SubscriptionPlaceholderSetting{}
	if adminID == nil {
		rows, err := r.db.QueryContext(ctx, `SELECT id, name, COALESCE(subscription_placeholder_settings, '{}') FROM services ORDER BY name ASC`)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var item SubscriptionPlaceholderSetting
			var raw string
			if err := rows.Scan(&item.ServiceID, &item.ServiceName, &raw); err != nil {
				rows.Close()
				return nil, err
			}
			item.IsDefault = true
			item.SubscriptionPlaceholderPolicy = defaultSubscriptionPlaceholderPolicy()
			if policy, ok := decodeSubscriptionPlaceholderPolicy(raw); ok {
				item.SubscriptionPlaceholderPolicy = policy
			}
			result = append(result, item)
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
	}

	query := `SELECT a.id, a.username, s.id, s.name, COALESCE(a.subscription_settings, '{}'), COALESCE(s.subscription_placeholder_settings, '{}')
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
	for rows.Next() {
		var item SubscriptionPlaceholderSetting
		var id int64
		var adminRaw, serviceRaw string
		if err := rows.Scan(&id, &item.AdminUsername, &item.ServiceID, &item.ServiceName, &adminRaw, &serviceRaw); err != nil {
			return nil, err
		}
		item.AdminID = &id
		policy := defaultSubscriptionPlaceholderPolicy()
		if configured, ok := decodeSubscriptionPlaceholderPolicy(serviceRaw); ok {
			policy = configured
		}
		if configured, ok := decodeSubscriptionPlaceholderPolicies(adminRaw)[strconv.FormatInt(item.ServiceID, 10)]; ok {
			policy, _ = normalizeSubscriptionPlaceholderPolicy(configured)
		} else {
			item.Inherited = true
		}
		item.SubscriptionPlaceholderPolicy = policy
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r Repository) UpdateServiceSubscriptionPlaceholderSetting(ctx context.Context, serviceID int64, policy SubscriptionPlaceholderPolicy) (SubscriptionPlaceholderSetting, error) {
	policy, err := normalizeSubscriptionPlaceholderPolicy(policy)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	encoded, _ := json.Marshal(policy)
	result, err := r.db.ExecContext(ctx, `UPDATE services SET subscription_placeholder_settings = ? WHERE id = ?`, string(encoded), serviceID)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return SubscriptionPlaceholderSetting{}, ErrServiceNotFound
	}
	var serviceName string
	if err := r.db.QueryRowContext(ctx, `SELECT name FROM services WHERE id = ?`, serviceID).Scan(&serviceName); err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	return SubscriptionPlaceholderSetting{ServiceID: serviceID, ServiceName: serviceName, IsDefault: true, SubscriptionPlaceholderPolicy: policy}, nil
}

func (r Repository) UpdateSubscriptionPlaceholderSetting(ctx context.Context, adminID, serviceID int64, policy SubscriptionPlaceholderPolicy, inherit bool) (SubscriptionPlaceholderSetting, error) {
	policy, err := normalizeSubscriptionPlaceholderPolicy(policy)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SubscriptionPlaceholderSetting{}, err
	}
	defer tx.Rollback()

	query := `SELECT a.username, s.name, COALESCE(a.subscription_settings, '{}'), COALESCE(s.subscription_placeholder_settings, '{}')
FROM admins a
JOIN admins_services linked ON linked.admin_id = a.id
JOIN services s ON s.id = linked.service_id
WHERE a.id = ? AND s.id = ? AND COALESCE(a.status, '') != 'deleted'`
	if r.dialect == "mysql" {
		query += " FOR UPDATE"
	}
	var username, serviceName, adminRaw, serviceRaw string
	if err := tx.QueryRowContext(ctx, query, adminID, serviceID).Scan(&username, &serviceName, &adminRaw, &serviceRaw); err != nil {
		if err == sql.ErrNoRows {
			return SubscriptionPlaceholderSetting{}, ErrAdminNotFound
		}
		return SubscriptionPlaceholderSetting{}, err
	}

	settings := map[string]json.RawMessage{}
	if json.Unmarshal([]byte(adminRaw), &settings) != nil {
		settings = map[string]json.RawMessage{}
	}
	policies := decodeSubscriptionPlaceholderPolicies(adminRaw)
	key := strconv.FormatInt(serviceID, 10)
	if inherit {
		delete(policies, key)
		if configured, ok := decodeSubscriptionPlaceholderPolicy(serviceRaw); ok {
			policy = configured
		} else {
			policy = defaultSubscriptionPlaceholderPolicy()
		}
	} else {
		policies[key] = policy
	}
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
		AdminID: &adminID, AdminUsername: username, ServiceID: serviceID, ServiceName: serviceName, Inherited: inherit,
		SubscriptionPlaceholderPolicy: policy,
	}, nil
}

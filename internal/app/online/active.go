package online

import "time"

const (
	ActiveWindow         = 20 * time.Second
	XrayUserPredicate    = "EXISTS (SELECT 1 FROM user_online_ips uoi WHERE uoi.user_id = u.id AND uoi.last_seen_at >= ? AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = uoi.node_id AND LOWER(COALESCE(n.status, '')) = 'deleted'))"
	SessionUserPredicate = "EXISTS (SELECT 1 FROM vpn_user_sessions vus WHERE vus.user_id = u.id AND vus.ended_at IS NULL AND vus.last_seen_at >= ? AND NOT EXISTS (SELECT 1 FROM nodes n WHERE n.id = vus.node_id AND LOWER(COALESCE(n.status, '')) = 'deleted'))"
	LastSeenExpression   = "COALESCE((SELECT up.online_at FROM user_presence up WHERE up.user_id = u.id), u.online_at)"
	LastSeenPredicate    = LastSeenExpression + " >= ?"
	UserPredicate        = "(" + XrayUserPredicate + " OR " + SessionUserPredicate + " OR " + LastSeenPredicate + ")"
)

func Cutoff(now time.Time) time.Time {
	return now.UTC().Add(-ActiveWindow)
}

import type { UserCreate } from "types/User";

export type FormType = Pick<
	UserCreate,
	| "username"
	| "status"
	| "expire"
	| "data_limit"
	| "ip_limit"
	| "data_limit_reset_strategy"
	| "on_hold_expire_duration"
	| "note"
	| "telegram_id"
	| "contact_number"
	| "flow"
	| "credential_key"
> & {
	credential_key: string | null;
	manual_key_entry: boolean;
	service_id: number | null;
	next_plan_enabled: boolean;
	next_plan_data_limit: number | null;
	next_plan_expire: number | null;
	next_plan_add_remaining_traffic: boolean;
	next_plan_fire_on_either: boolean;
	speed_limit: number | null;
	group_id: number | null;
	tags: string[];
};

export type TabValue = "details" | "usage" | "links";

export const BYTES_PER_GB = 1073741824;
export const CREDENTIAL_KEY_REGEX =
	/^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
export const ALLOWED_FLOWS = [
	"",
	"xtls-rprx-vision",
	"xtls-rprx-vision-udp443",
];
export const USERNAME_REGEX = /^[A-Za-z0-9._@-]{3,32}$/;
export const ON_HOLD_QUICK_DAYS = [7, 30, 60, 90, 180, 365];

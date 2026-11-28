import type { UserCreate } from "types/User";

export type UserDialogProps = Record<string, never>;

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

export type AutoRenewRule = {
	id: string;
	dataLimit: number | null;
	expire: number | null;
	addRemaining: boolean;
	fireOnEither: boolean;
};

export type RuleDraft = {
	index: number | null;
	data: string;
	days: string;
	addRemaining: boolean;
	fireOnEither: boolean;
};

export type SubscriptionLinkItem = {
	key: string;
	label: string;
	url: string;
};

export type ConfigLinkItem = {
	link: string;
	label: string;
};

import dayjs from "dayjs";
import type { User } from "types/User";
import type { FormType } from "./userDialog.types";

export const BYTES_PER_GB = 1073741824;
export const SUCCESS_CLOSE_DELAY_MS = 1000;
export const COPY_FEEDBACK_MS = 1200;
export const ON_HOLD_QUICK_DAYS = [7, 30, 60, 90, 180, 365] as const;

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export const createId = (): string =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: Math.random().toString(36).slice(2);

export const formatUserToForm = (user: User): FormType => {
	const nextPlan = user.next_plans?.[0] ?? null;
	return {
		...user,
		flow: user.flow ?? "",
		data_limit: user.data_limit
			? Number((user.data_limit / BYTES_PER_GB).toFixed(5))
			: user.data_limit,
		ip_limit: user.ip_limit && user.ip_limit > 0 ? user.ip_limit : null,
		speed_limit:
			user.speed_limit_kbps && user.speed_limit_kbps > 0
				? Number((user.speed_limit_kbps / 1000).toFixed(2))
				: null,
		on_hold_expire_duration: user.on_hold_expire_duration
			? Number(user.on_hold_expire_duration / (24 * 60 * 60))
			: user.on_hold_expire_duration,
		service_id: user.service_id ?? null,
		credential_key: user.credential_key ?? null,
		manual_key_entry: false,
		next_plan_enabled: Boolean(nextPlan),
		next_plan_data_limit: nextPlan?.data_limit
			? Number((nextPlan.data_limit / BYTES_PER_GB).toFixed(5))
			: null,
		next_plan_expire: nextPlan?.expire ?? null,
		next_plan_add_remaining_traffic: nextPlan?.add_remaining_traffic ?? false,
		next_plan_fire_on_either: nextPlan?.fire_on_either ?? true,
		telegram_id: user.telegram_id ?? "",
		contact_number: user.contact_number ?? "",
		group_id: user.group?.id ?? null,
		tags: user.tags ?? [],
	};
};

export const getDefaultUserFormValues = (): FormType => ({
	data_limit: null,
	ip_limit: null,
	speed_limit: null,
	expire: null,
	credential_key: null,
	manual_key_entry: false,
	flow: "",
	username: "",
	data_limit_reset_strategy: "no_reset",
	status: "active",
	on_hold_expire_duration: null,
	note: "",
	service_id: null,
	next_plan_enabled: false,
	next_plan_data_limit: null,
	next_plan_expire: null,
	next_plan_add_remaining_traffic: false,
	next_plan_fire_on_either: true,
	telegram_id: "",
	contact_number: "",
	group_id: null,
	tags: [],
});

const normalizeDecimalText = (value: string) =>
	value
		.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
		.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
		.replace(/[٫٬,]/g, ".")
		.trim();

export const parseDecimalInput = (value: unknown): number | null => {
	if (value === null || typeof value === "undefined") return null;
	const raw = String(value).trim();
	if (!raw) return null;
	const normalized = normalizeDecimalText(raw);
	if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number.NaN;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export const gigabytesToBytes = (gigabytes: number): number =>
	Math.round(gigabytes * BYTES_PER_GB);

export const deriveDaysFromSeconds = (value: unknown): number | null => {
	if (typeof value !== "number" || value <= 0) return null;
	const diff = dayjs.unix(value).utc().local().diff(dayjs(), "day", true);
	return Number.isFinite(diff) ? Math.max(0, Math.round(diff)) : null;
};

export const convertDaysToSecondsFromNow = (days: number): number =>
	dayjs().add(days, "day").endOf("day").utc().unix();

export const isDecimalDraft = (raw: string): boolean =>
	/^[0-9]*\.?[0-9]*$/.test(raw);

export const formatUserDialogLink = (link?: string | null): string => {
	if (!link) return "";
	return link.startsWith("/") ? window.location.origin + link : link;
};

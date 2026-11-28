import { z } from "zod";
import { gigabytesToBytes, parseDecimalInput } from "./userDialog.helpers";

const CREDENTIAL_KEY_REGEX =
	/^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const ALLOWED_FLOWS = ["", "xtls-rprx-vision", "xtls-rprx-vision-udp443"];
const USERNAME_REGEX = /^[A-Za-z0-9._@-]{3,32}$/;

export const buildUserDialogSchema = (isEditing: boolean) => {
	const baseSchema = {
		username: isEditing
			? z.string().min(1)
			: z.string().regex(USERNAME_REGEX, {
					message:
						"Username only can be 3 to 32 characters and contain a-z, A-Z, 0-9, underscores, hyphens, dots, or @.",
				}),
		flow: z
			.string()
			.optional()
			.transform((val) =>
				val === "" || typeof val === "undefined" ? null : val,
			)
			.refine(
				(val) => val === null || ALLOWED_FLOWS.includes(val),
				"Unsupported flow",
			),
		service_id: z
			.union([z.string(), z.number()])
			.nullable()
			.transform((value) => {
				if (value === "" || value === null || typeof value === "undefined")
					return null;
				const parsed = Number(value);
				return Number.isNaN(parsed) ? null : parsed;
			}),
		data_limit: z
			.union([z.string(), z.number(), z.null()])
			.transform((value, ctx) => {
				const parsed = parseDecimalInput(value);
				if (parsed === null) return 0;
				if (!Number.isFinite(parsed) || parsed < 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Enter a valid non-negative data limit.",
					});
					return z.NEVER;
				}
				return gigabytesToBytes(parsed);
			}),
		expire: z.number().nullable(),
		data_limit_reset_strategy: z.string(),
		note: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => (typeof value === "string" ? value : "")),
		group_id: z
			.number()
			.nullable()
			.optional()
			.transform((value) => value ?? null),
		tags: z
			.array(z.string())
			.optional()
			.transform((value) => value ?? []),
		telegram_id: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => (typeof value === "string" ? value : "")),
		contact_number: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => (typeof value === "string" ? value : "")),
		next_plan_enabled: z.boolean().default(false),
		next_plan_data_limit: z
			.union([z.string(), z.number(), z.null()])
			.transform((value, ctx) => {
				const parsed = parseDecimalInput(value);
				if (parsed === null) return null;
				if (!Number.isFinite(parsed) || parsed < 0) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						message: "Enter a valid non-negative data limit.",
					});
					return z.NEVER;
				}
				return parsed;
			}),
		next_plan_expire: z
			.union([z.number(), z.string(), z.null()])
			.transform((value) => {
				if (value === "" || value === null || typeof value === "undefined")
					return null;
				const parsed = Number(value);
				return Number.isNaN(parsed) ? null : parsed;
			}),
		next_plan_add_remaining_traffic: z.boolean().default(false),
		next_plan_fire_on_either: z.boolean().default(true),
		speed_limit: z
			.union([z.number().min(0), z.null()])
			.optional()
			.transform((value) => {
				if (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
					return null;
				return Math.round(value * 100) / 100;
			}),
		ip_limit: z
			.union([z.number().min(0), z.null()])
			.optional()
			.transform((value) =>
				typeof value === "number" && Number.isFinite(value) ? value : null,
			),
		manual_key_entry: z.boolean().default(false),
		credential_key: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => {
				if (!value || typeof value !== "string") return null;
				const trimmed = value.trim();
				return trimmed === "" ? null : trimmed;
			})
			.nullable(),
	};

	return z
		.discriminatedUnion("status", [
			z.object({ status: z.literal("active"), ...baseSchema }),
			z.object({ status: z.literal("disabled"), ...baseSchema }),
			z.object({ status: z.literal("limited"), ...baseSchema }),
			z.object({ status: z.literal("expired"), ...baseSchema }),
			z.object({
				status: z.literal("on_hold"),
				on_hold_expire_duration: z.coerce
					.number()
					.min(0.1, "Required")
					.transform((days) => days * (24 * 60 * 60)),
				...baseSchema,
			}),
		])
		.superRefine((values, ctx) => {
			if (!values.manual_key_entry) return;
			const key = values.credential_key;
			if (!key) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["credential_key"],
					message: "Credential key is required when manual entry is enabled.",
				});
				return;
			}
			if (!CREDENTIAL_KEY_REGEX.test(key)) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["credential_key"],
					message:
						"Credential key must be a 32-character hexadecimal string or UUID.",
				});
			}
		});
};

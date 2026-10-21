import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "components/shadcn/toast";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { useColorMode } from "lib/color-mode";
import { Input as ChakraInput, InputGroup, InputRightAddon, InputRightElement, Textarea } from "components/shadcn/input";
import { Modal, ModalCloseButton, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Alert, AlertDescription, AlertIcon } from "components/shadcn/alert";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Tooltip } from "components/shadcn/tooltip";
import { Button, IconButton } from "components/shadcn/button";
import { Switch } from "components/shadcn/selection";
import { Collapse } from "components/shadcn/collapse";
import { Spinner } from "components/shadcn/feedback";
import { Badge } from "components/shadcn/badge";
import { withClass } from "components/shadcn/icon";
import { cn } from "lib/cn";
import { PanelSelect as Select } from "components/common/PanelSelect";
import {
	CheckIcon,
	ClipboardIcon,
	ChevronDownIcon as HeroChevronDownIcon,
	LinkIcon,
	LockClosedIcon,
	PencilIcon,
	QrCodeIcon,
	QuestionMarkCircleIcon,
	SparklesIcon,
	UserPlusIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetStrategy } from "constants/UserSettings";
import { type FilterUsageType, useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import dayjs from "dayjs";
import useGetUser from "hooks/useGetUser";
import {
	type ChangeEvent,
	type FC,
	type HTMLAttributes,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import ReactApexChart from "react-apexcharts";
import { Controller, FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { fetch as apiFetch } from "service/http";
import {
	AdminRole,
	AdminTrafficLimitMode,
	UserPermissionToggle,
} from "types/Admin";
import type {
	User,
	UserCreate,
	UserCreateWithService,
	UserListItem,
} from "types/User";
import {
	canDeleteUserByTrafficCap,
	canViewUserTraffic,
	getAdminTrafficScope,
	isUserManagementLocked,
} from "utils/adminTraffic";
import { copyTextToClipboard } from "utils/clipboard";
import { getConfigLabelFromLink } from "utils/configLabel";
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";
import { generateUserLinks } from "utils/userLinks";

import { z } from "zod";
import { NumericInput } from "./common/NumericInput";
import { AnimatedSubmitButton } from "./common/AnimatedSubmitButton";
import { DeleteIcon } from "./common/DeleteIcon";
import { DateTimePicker } from "./DateTimePicker";
import { addQuickExpiry } from "utils/expiry";
import { DeleteConfirmDialog } from "./dialogs/ConfirmDialog";
import { Icon } from "./Icon";
import { createUsageConfig, UsageFilter } from "./UsageFilter";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
} from "./xray/XrayDialog";

const AddUserIcon = withClass(UserPlusIcon, "w-4 h-4");

const EditUserIcon = withClass(PencilIcon, "w-4 h-4");

const CopyActionIcon = withClass(ClipboardIcon, "w-4 h-4");
const CopiedActionIcon = withClass(CheckIcon, "w-4 h-4");
const QRActionIcon = withClass(QrCodeIcon, "w-4 h-4");
const SubscriptionActionIcon = withClass(LinkIcon, "w-4 h-4");

const LimitLockIcon = withClass(LockClosedIcon, "w-16 md:w-20 h-16 md:h-20");

const SectionChevronIcon = withClass(HeroChevronDownIcon, "w-4 h-4");

export type UserDialogProps = {};
type SubmitStatus = "idle" | "loading" | "success" | "error";

const SERVICE_NOTICE_DURATION_MS = 10000;

const createAutoRenewId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}
	return Math.random().toString(36).slice(2);
};

type BaseFormFields = Pick<
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
>;

export type FormType = BaseFormFields & {
	credential_key: string | null;

	manual_key_entry: boolean;

	service_id: number | null;

	next_plan_enabled: boolean;

	next_plan_data_limit: number | null;

	next_plan_expire: number | null;

	next_plan_add_remaining_traffic: boolean;

	next_plan_fire_on_either: boolean;

	speed_limit: number | null;
};

const formatUser = (user: User): FormType => {
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
	};
};

const getDefaultValues = (): FormType => {
	return {
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
	};
};

const CREDENTIAL_KEY_REGEX =
	/^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

const allowedFlows = ["", "xtls-rprx-vision", "xtls-rprx-vision-udp443"];

const usernameRegex = /^[A-Za-z0-9._@-]{3,32}$/;
const BYTES_PER_GB = 1073741824;
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const alwaysVisibleStepper = "[&_.rb-number-stepper]:opacity-100 [&_.rb-number-stepper]:pointer-events-auto";

/** Chakra's SlideFade with unmountOnExit: slides in from 8px above and fades, and reverses on close. */
const SlideNotice = ({ open, children }: { open: boolean; children: ReactNode }) => (
	<AnimatePresence>
		{open && (
			<motion.div
				initial={{ opacity: 0, y: -8 }}
				animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
				exit={{ opacity: 0, y: -8, transition: { duration: 0.1, ease: [0.4, 0, 1, 1] } }}
			>
				{children}
			</motion.div>
		)}
	</AnimatePresence>
);

const normalizeDecimalText = (value: string) =>
	value
		.replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
		.replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
		.replace(/[٫٬,]/g, ".")
		.trim();

const parseDecimalInput = (value: unknown): number | null => {
	if (value === null || typeof value === "undefined") {
		return null;
	}
	const raw = String(value).trim();
	if (!raw) {
		return null;
	}
	const normalized = normalizeDecimalText(raw);
	if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
		return Number.NaN;
	}
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const gigabytesToBytes = (gigabytes: number) =>
	Math.round(gigabytes * BYTES_PER_GB);

const buildSchema = (isEditing: boolean) => {
	const baseSchema = {
		username: isEditing
			? z.string().min(1)
			: z.string().regex(usernameRegex, {
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
				(val) => val === null || allowedFlows.includes(val),
				"Unsupported flow",
			),

		service_id: z

			.union([z.string(), z.number()])

			.nullable()

			.transform((value) => {
				if (value === "" || value === null || typeof value === "undefined") {
					return null;
				}

				const parsed = Number(value);

				return Number.isNaN(parsed) ? null : parsed;
			}),

		data_limit: z

			.union([z.string(), z.number(), z.null()])

			.transform((value, ctx) => {
				const parsed = parseDecimalInput(value);
				if (parsed === null) {
					return 0;
				}
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

		note: z.union([z.string(), z.null(), z.undefined()]).transform((value) => {
			if (typeof value !== "string") return "";
			return value;
		}),

		telegram_id: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => {
				if (typeof value !== "string") return "";
				return value;
			}),

		contact_number: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => {
				if (typeof value !== "string") return "";
				return value;
			}),

		next_plan_enabled: z.boolean().default(false),

		next_plan_data_limit: z

			.union([z.string(), z.number(), z.null()])

			.transform((value, ctx) => {
				const parsed = parseDecimalInput(value);
				if (parsed === null) {
					return null;
				}
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
				if (value === "" || value === null || typeof value === "undefined") {
					return null;
				}

				const parsed = Number(value);

				return Number.isNaN(parsed) ? null : parsed;
			}),

		next_plan_add_remaining_traffic: z.boolean().default(false),

		next_plan_fire_on_either: z.boolean().default(true),

		speed_limit: z
			.union([z.number().min(0), z.null()])
			.optional()
			.transform((value) => {
				if (
					typeof value !== "number" ||
					!Number.isFinite(value) ||
					value <= 0
				) {
					return null;
				}
				return Math.round(value * 100) / 100;
			}),
		ip_limit: z
			.union([z.number().min(0), z.null()])
			.optional()
			.transform((value) => {
				if (typeof value !== "number") {
					return null;
				}
				return Number.isFinite(value) ? value : null;
			}),

		manual_key_entry: z.boolean().default(false),

		credential_key: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((value) => {
				if (!value || typeof value !== "string") {
					return null;
				}
				const trimmed = value.trim();
				return trimmed === "" ? null : trimmed;
			})
			.nullable(),
	};

	return z
		.discriminatedUnion("status", [
			z.object({
				status: z.literal("active"),

				...baseSchema,
			}),

			z.object({
				status: z.literal("disabled"),

				...baseSchema,
			}),

			z.object({
				status: z.literal("limited"),

				...baseSchema,
			}),

			z.object({
				status: z.literal("expired"),

				...baseSchema,
			}),

			z.object({
				status: z.literal("on_hold"),

				on_hold_expire_duration: z.coerce

					.number()

					.min(0.1, "Required")

					.transform((d) => {
						return d * (24 * 60 * 60);
					}),

				...baseSchema,
			}),
		])
		.superRefine((values, ctx) => {
			if (!values.manual_key_entry) {
				return;
			}
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

export const UserDialog: FC<UserDialogProps> = () => {
	const editingUser = useDashboard((state) => state.editingUser);
	const isCreatingNewUser = useDashboard(
		(state) => state.isCreatingNewUser,
	);
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const editUser = useDashboard((state) => state.editUser);
	const fetchUserUsage = useDashboard((state) => state.fetchUserUsage);
	const deleteUser = useDashboard((state) => state.deleteUser);
	const onEditingUser = useDashboard((state) => state.onEditingUser);
	const createUserWithService = useDashboard(
		(state) => state.createUserWithService,
	);
	const usersLimit = useDashboard((state) => state.users.users_limit ?? null);
	const activeUsersCount = useDashboard(
		(state) => state.users.active_total ?? null,
	);
	const isUserLimitReached = useDashboard(
		(state) => state.isUserLimitReached,
	);
	const linkTemplates = useDashboard((state) => state.linkTemplates);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const editingUserInitialTab = useDashboard(
		(state) => state.editingUserInitialTab,
	);

	const isEditing = !!editingUser;

	const isOpen = isCreatingNewUser || isEditing;

	const limitReached = isUserLimitReached && !isEditing;

	const [loading, setLoading] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
	const [deleteLoading, setDeleteLoading] = useState(false);
	const submitResetTimerRef = useRef<number | null>(null);
	const successCloseTimerRef = useRef<number | null>(null);

	const [error, setError] = useState<string | null>("");

	const toast = useToast();

	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const isMobileDialog = useBreakpointValue({ base: true, md: false }) ?? false;
	const DATA_UNIT = "GB";
	const SPEED_UNIT = "Mbps";
	const DAYS_UNIT = t("userDialog.days");
	const basePad = "0.75rem";
	const endPadding = isRTL
		? { paddingInlineStart: "2.75rem", paddingInlineEnd: basePad }
		: { paddingInlineEnd: "2.75rem", paddingInlineStart: basePad };
	const endAdornmentProps = isRTL
		? {
				insetInlineStart: "0.5rem",
				insetInlineEnd: "auto",
				right: "auto",
				left: "0.5rem",
			}
		: {
				insetInlineEnd: "0.5rem",
				insetInlineStart: "auto",
				right: "0.5rem",
				left: "auto",
			};

	const { colorMode } = useColorMode();
	const footerBg = "bg-white dark:bg-gray-900";
	const footerBorderColor = "border-gray-200! dark:border-whiteAlpha-300!";

	const UNIT_RADIUS = "6px";

	const renderUnitInput = (args: {
		value: string;
		onChange: (e: ChangeEvent<HTMLInputElement>) => void;
		unit: string;
		disabled?: boolean;
		placeholder?: string;
		type?: string;
		inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
	}) => {
		const addonBg = colorMode === "dark" ? "bg-whiteAlpha-100" : "bg-blackAlpha-50";
		const addonBorder = colorMode === "dark" ? "border-gray-700!" : "border-gray-200!";
		const addonColor = colorMode === "dark" ? "text-gray-200" : "text-gray-600";

		return (
			<InputGroup size="sm" dir="ltr" className="w-full min-w-0!">
				<div className="flex-1 min-w-0!">
					<NumericInput
						className={alwaysVisibleStepper}
						value={args.value}
						disabled={args.disabled}
						min={0}
						step={1}
						onChange={(valueAsString) => {
							args.onChange({
								target: { value: valueAsString },
							} as ChangeEvent<HTMLInputElement>);
						}}
						fieldProps={{ placeholder: args.placeholder, inputMode: args.inputMode ?? "decimal", dir: "ltr", className: "h-[32px] min-h-[32px]", style: { borderRadius: UNIT_RADIUS, borderStartEndRadius: "0", borderEndEndRadius: "0", textAlign: isRTL ? "right" : "left" } }}
					/>
				</div>

				<InputRightAddon style={{ borderStartEndRadius: UNIT_RADIUS, borderEndEndRadius: UNIT_RADIUS }} className={cn("rounded-s-[0] px-3 text-[0.875rem] h-[32px] min-h-[32px] select-none", addonBg, addonBorder, addonColor)}>
					{args.unit}
				</InputRightAddon>
			</InputGroup>
		);
	};

	const formSchema = useMemo(() => buildSchema(isEditing), [isEditing]);

	const form = useForm<FormType>({
		defaultValues: getDefaultValues(),

		resolver: zodResolver(formSchema),
		mode: "onChange",
		reValidateMode: "onChange",
	});

	const manualKeyEntryEnabled = useWatch({
		control: form.control,
		name: "manual_key_entry",
	});
	const usernameValue = useWatch({
		control: form.control,
		name: "username",
	});
	const hasExistingKey = Boolean(editingUser?.credential_key);

	const expireInitialValue = form.getValues("expire");

	const deriveDaysFromSeconds = useCallback((value: unknown): number | null => {
		if (typeof value !== "number" || value <= 0) {
			return null;
		}
		const target = dayjs.unix(value).utc().local();
		const now = dayjs();
		const diff = target.diff(now, "day", true);
		if (!Number.isFinite(diff)) {
			return null;
		}
		return Math.max(0, Math.round(diff));
	}, []);

	function convertDaysToSecondsFromNow(days: number): number {
		return dayjs().add(days, "day").endOf("day").utc().unix();
	}

	const [_expireDays, setExpireDays] = useState<number | null>(() =>
		deriveDaysFromSeconds(expireInitialValue),
	);
	const [autoRenewOpen, setAutoRenewOpen] = useState(false);

	type AutoRenewRule = {
		id: string;
		dataLimit: number | null;
		expire: number | null;
		addRemaining: boolean;
		fireOnEither: boolean;
		localOnly?: boolean;
	};

	const initialRule: AutoRenewRule | null = form.getValues("next_plan_enabled")
		? {
				id: createAutoRenewId(),
				dataLimit: form.getValues("next_plan_data_limit"),
				expire: form.getValues("next_plan_expire"),
				addRemaining: form.getValues("next_plan_add_remaining_traffic"),
				fireOnEither: form.getValues("next_plan_fire_on_either"),
				localOnly: false,
			}
		: null;

	const [autoRenewRules, setAutoRenewRules] = useState<AutoRenewRule[]>(
		initialRule ? [initialRule] : [],
	);
	const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
	const [autoRenewFormMode, setAutoRenewFormMode] = useState<
		"add" | "edit" | null
	>(null);
	const [autoRenewDataValue, setAutoRenewDataValue] = useState<string>("");
	const [autoRenewExpireDaysValue, setAutoRenewExpireDaysValue] =
		useState<string>("");
	const [autoRenewAddRemainingValue, setAutoRenewAddRemainingValue] =
		useState(false);
	const [autoRenewFireOnEitherValue, setAutoRenewFireOnEitherValue] =
		useState(true);

	const resetAutoRenewFormValues = useCallback(
		(rule?: AutoRenewRule | null) => {
			if (rule) {
				setAutoRenewDataValue(
					typeof rule.dataLimit === "number" && Number.isFinite(rule.dataLimit)
						? String(rule.dataLimit)
						: "",
				);
				const derivedDays = deriveDaysFromSeconds(rule.expire);
				setAutoRenewExpireDaysValue(
					derivedDays !== null && typeof derivedDays !== "undefined"
						? String(derivedDays)
						: "",
				);
				setAutoRenewAddRemainingValue(Boolean(rule.addRemaining));
				setAutoRenewFireOnEitherValue(Boolean(rule.fireOnEither));
			} else {
				setAutoRenewDataValue("");
				setAutoRenewExpireDaysValue("");
				setAutoRenewAddRemainingValue(false);
				setAutoRenewFireOnEitherValue(true);
			}
		},
		[deriveDaysFromSeconds],
	);

	const startAddAutoRenew = () => {
		setAutoRenewOpen(true);
		setAutoRenewFormMode("add");
		setEditingRuleIndex(null);
		resetAutoRenewFormValues(null);
	};

	const startEditAutoRenew = (index: number) => {
		const rule = autoRenewRules[index];
		if (!rule) return;
		setAutoRenewOpen(true);
		setAutoRenewFormMode("edit");
		setEditingRuleIndex(index);
		resetAutoRenewFormValues(rule);
	};

	const handleCancelAutoRenewForm = () => {
		setAutoRenewFormMode(null);
		setEditingRuleIndex(null);
	};

	const handleSaveAutoRenewRule = () => {
		setError(null);
		const parsedLimit =
			autoRenewDataValue.trim() === ""
				? null
				: parseDecimalInput(autoRenewDataValue.trim());
		if (
			parsedLimit !== null &&
			(!Number.isFinite(parsedLimit) ||
				Number.isNaN(parsedLimit) ||
				parsedLimit < 0)
		) {
			setError(t("userDialog.autoRenewInvalidLimit"));
			return;
		}

		const parsedDays =
			autoRenewExpireDaysValue.trim() === ""
				? null
				: Number.parseFloat(autoRenewExpireDaysValue.trim());
		if (
			parsedDays !== null &&
			(!Number.isFinite(parsedDays) ||
				Number.isNaN(parsedDays) ||
				parsedDays < 0)
		) {
			setError(t("userDialog.autoRenewInvalidDays"));
			return;
		}

		const expireSeconds =
			parsedDays !== null
				? convertDaysToSecondsFromNow(Math.round(parsedDays))
				: null;

		const existingId =
			autoRenewFormMode === "edit" && editingRuleIndex !== null
				? autoRenewRules[editingRuleIndex]?.id
				: null;
		const newRule: AutoRenewRule = {
			id: existingId ?? createAutoRenewId(),
			dataLimit: parsedLimit === null ? null : parsedLimit,
			expire: expireSeconds,
			addRemaining: autoRenewAddRemainingValue,
			fireOnEither: autoRenewFireOnEitherValue,
		};

		setAutoRenewRules((prev) => {
			const next = [...prev];
			if (autoRenewFormMode === "edit" && editingRuleIndex !== null) {
				next[editingRuleIndex] = newRule;
			} else {
				next.push(newRule);
			}
			return next;
		});
		setAutoRenewFormMode(null);
		setEditingRuleIndex(null);
	};

	const handleDeleteAutoRenewRule = (index: number) => {
		setAutoRenewRules((prev) => prev.filter((_, i) => i !== index));
		if (editingRuleIndex === index) {
			setAutoRenewFormMode(null);
			setEditingRuleIndex(null);
		}
	};

	const quickExpiryOptions = [
		{
			label: t("userDialog.quickSelectOneMonth"),
			amount: 1,
			unit: "month",
		},
		{
			label: t("userDialog.quickSelectThreeMonths"),
			amount: 3,
			unit: "month",
		},
		{
			label: t("userDialog.quickSelectOneYear"),
			amount: 1,
			unit: "year",
		},
	] as const;

	const rawServices = useServicesStore((state) => state.serviceOptions);
	const services = Array.isArray(rawServices) ? rawServices : [];
	const servicesLoading = useServicesStore((state) => state.isOptionsLoading);
	const { userData, getUserIsSuccess } = useGetUser();
	const hasPrivilegedRole = Boolean(
		getUserIsSuccess &&
			(userData.role === AdminRole.Sudo ||
				userData.role === AdminRole.FullAccess),
	);
	const hasFullAccess = Boolean(
		getUserIsSuccess && userData.role === AdminRole.FullAccess,
	);
	const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
		null,
	);
	const hasServices = services.length > 0;
	const selectedService = selectedServiceId
		? (services.find((service) => service.id === selectedServiceId) ?? null)
		: null;
	const nonSudoSingleService = !hasPrivilegedRole && services.length === 1;
	const effectiveServiceId = isEditing
		? (editingUser?.service_id ?? null)
		: (selectedServiceId ??
			(!hasPrivilegedRole && nonSudoSingleService
				? (services[0]?.id ?? null)
				: null));
	const userManagementLocked = isUserManagementLocked(
		userData,
		effectiveServiceId,
	);
	const canViewTraffic = canViewUserTraffic(
		userData,
		editingUser?.service_id ?? null,
	);
	const canSetFlow =
		hasPrivilegedRole ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.SetFlow]);
	const canSetCustomKey =
		hasPrivilegedRole ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.AllowCustomKey]);
	const canDeleteUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Delete]);
	const canResetUsage =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ResetUsage]);
	const canConfigurePeriodicUsageReset =
		hasFullAccess ||
		Boolean(
			userData.permissions?.users?.[UserPermissionToggle.PeriodicUsageReset],
		);
	const canRevokeSubscription =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Revoke]);
	const speedLimitEditable =
		userData.user_speed_limit_enabled !== false &&
		(userData.role === AdminRole.FullAccess ||
			Boolean(userData.permissions?.users?.[UserPermissionToggle.ManageSpeedLimit]));
	const ipLimitEditable =
		userData.role === AdminRole.FullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ManageIPLimit]);
	const requiresServiceScope = Boolean(
		userData.use_service_traffic_limits && !hasPrivilegedRole,
	);
	const canDeleteUsersVisible =
		canDeleteUsers && canDeleteUserByTrafficCap(userData, editingUser);
	const canResetUsageVisible =
		canResetUsage && canViewTraffic && !userManagementLocked;
	const canRevokeSubscriptionVisible =
		canRevokeSubscription && !userManagementLocked;
	const currentTrafficScope = getAdminTrafficScope(
		userData,
		effectiveServiceId,
	);
	const isCreatedTrafficScope = Boolean(
		currentTrafficScope?.traffic_limit_mode ===
			AdminTrafficLimitMode.CreatedTraffic && !hasPrivilegedRole,
	);
	const isServiceManagedUser = Boolean(editingUser?.service_id);
	const showServiceSelector = hasPrivilegedRole || services.length !== 1;
	const useTwoColumns = showServiceSelector && services.length > 0;
	const shouldCenterForm = !useTwoColumns;
	const shouldCompactModal = !hasPrivilegedRole && services.length === 0;
	const [activeTab, setActiveTab] = useState(0);
	const [usageFetched, setUsageFetched] = useState(false);

	const [serviceNoticeVisible, setServiceNoticeVisible] = useState(false);
	const [serviceNoticeSeed, setServiceNoticeSeed] = useState(0);
	const [statusNoticeVisible, setStatusNoticeVisible] = useState(false);
	const [statusNoticeSeed, setStatusNoticeSeed] = useState(0);
	const [copiedSubscriptionKey, setCopiedSubscriptionKey] = useState<
		string | null
	>(null);
	const [copiedAllConfigs, setCopiedAllConfigs] = useState(false);
	const [copiedConfigIndex, setCopiedConfigIndex] = useState<number | null>(
		null,
	);

	const autoRenewTitle = t("autoRenew.title");

	useEffect(() => {
		if (!isOpen || !isEditing || !isServiceManagedUser) {
			setServiceNoticeVisible(false);
			return;
		}
		setServiceNoticeSeed((prev) => prev + 1);
		setServiceNoticeVisible(true);
		const timer = window.setTimeout(() => {
			setServiceNoticeVisible(false);
		}, SERVICE_NOTICE_DURATION_MS);
		return () => window.clearTimeout(timer);
	}, [isOpen, isEditing, isServiceManagedUser]);

	useEffect(() => {
		if (isOpen) {
			useServicesStore.getState().fetchServiceOptions({ limit: 1000 });
		}
	}, [isOpen]);

	useEffect(() => {
		if (isEditing) {
			if (editingUser?.service_id) {
				setSelectedServiceId(editingUser.service_id);
			} else if (services.length) {
				setSelectedServiceId(services[0]?.id ?? null);
			} else {
				setSelectedServiceId(null);
			}
		} else if (!isOpen) {
			setSelectedServiceId(null);
		}
	}, [isEditing, editingUser, isOpen, services]);

	useEffect(() => {
		if (!isEditing && isOpen && hasServices && !hasPrivilegedRole) {
			setSelectedServiceId((current) => current ?? services[0]?.id ?? null);
		}
	}, [services, isEditing, isOpen, hasServices, hasPrivilegedRole]);

	useEffect(() => {
		if (!isEditing && isOpen && !hasServices) {
			setSelectedServiceId(null);
		}
	}, [hasServices, isEditing, isOpen]);

	useEffect(() => {
		if (nonSudoSingleService && services[0]) {
			setSelectedServiceId((current) => current ?? services[0].id);
		}
	}, [nonSudoSingleService, services]);

	useEffect(() => {
		const firstRule = autoRenewRules[0];
		if (firstRule) {
			form.setValue("next_plan_enabled", true, { shouldDirty: false });
			form.setValue("next_plan_data_limit", firstRule.dataLimit, {
				shouldDirty: false,
			});
			form.setValue("next_plan_expire", firstRule.expire, {
				shouldDirty: false,
			});
			form.setValue("next_plan_add_remaining_traffic", firstRule.addRemaining, {
				shouldDirty: false,
			});
			form.setValue("next_plan_fire_on_either", firstRule.fireOnEither, {
				shouldDirty: false,
			});
		} else {
			form.setValue("next_plan_enabled", false, { shouldDirty: false });
			form.setValue("next_plan_data_limit", null, { shouldDirty: false });
			form.setValue("next_plan_expire", null, { shouldDirty: false });
			form.setValue("next_plan_add_remaining_traffic", false, {
				shouldDirty: false,
			});
			form.setValue("next_plan_fire_on_either", true, { shouldDirty: false });
		}
	}, [autoRenewRules, form]);

	const [dataLimit, userStatus] = useWatch({
		control: form.control,

		name: ["data_limit", "status"],
	});

	const statusNotice = useMemo(() => {
		if (!isEditing) return null;
		switch (userStatus) {
			case "limited":
				return t("userDialog.statusNoticeLimited");
			case "expired":
				return t("userDialog.statusNoticeExpired");
			case "on_hold":
				return t("userDialog.statusNoticeOnHold");
			case "disabled":
				return t("userDialog.statusNoticeDisabled");
			default:
				return null;
		}
	}, [isEditing, userStatus, t]);

	useEffect(() => {
		if (!isOpen || !isEditing || !statusNotice) {
			setStatusNoticeVisible(false);
			return;
		}
		setStatusNoticeSeed((prev) => prev + 1);
		setStatusNoticeVisible(true);
		const timer = window.setTimeout(() => {
			setStatusNoticeVisible(false);
		}, SERVICE_NOTICE_DURATION_MS);
		return () => window.clearTimeout(timer);
	}, [isOpen, isEditing, statusNotice]);

	useEffect(() => {
		if (copiedSubscriptionKey) {
			const timer = window.setTimeout(
				() => setCopiedSubscriptionKey(null),
				1000,
			);
			return () => window.clearTimeout(timer);
		}
		return undefined;
	}, [copiedSubscriptionKey]);

	useEffect(() => {
		if (copiedAllConfigs) {
			const timer = window.setTimeout(() => setCopiedAllConfigs(false), 1000);
			return () => window.clearTimeout(timer);
		}
		return undefined;
	}, [copiedAllConfigs]);

	useEffect(() => {
		if (copiedConfigIndex !== null) {
			const timer = window.setTimeout(() => setCopiedConfigIndex(null), 1000);
			return () => window.clearTimeout(timer);
		}
		return undefined;
	}, [copiedConfigIndex]);

	const remainingDataInfo = useMemo(() => {
		if (!isEditing || !editingUser || !canViewTraffic) return null;
		const rawLimit = dataLimit;
		const parsedLimit = parseDecimalInput(rawLimit);
		if (!parsedLimit || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
			return {
				label: t("userDialog.remainingDataLabel"),
				value: t("userDialog.remainingDataUnlimited"),
			};
		}
		const limitBytes = parsedLimit * BYTES_PER_GB;
		const usedBytes = editingUser.used_traffic ?? 0;
		const remainingBytes = Math.max(limitBytes - usedBytes, 0);
		return {
			label: t("userDialog.remainingDataLabel"),
			value:
				remainingBytes <= 0
					? t("userDialog.remainingDataLimited")
					: formatBytes(remainingBytes, 2),
		};
	}, [canViewTraffic, isEditing, editingUser, dataLimit, t]);

	const formatLink = useCallback((link?: string | null) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	}, []);

	const clearSubmitTimers = useCallback(() => {
		if (submitResetTimerRef.current !== null) {
			window.clearTimeout(submitResetTimerRef.current);
			submitResetTimerRef.current = null;
		}
		if (successCloseTimerRef.current !== null) {
			window.clearTimeout(successCloseTimerRef.current);
			successCloseTimerRef.current = null;
		}
	}, []);

	useEffect(() => clearSubmitTimers, [clearSubmitTimers]);

	const showSubmitError = useCallback(() => {
		if (successCloseTimerRef.current !== null) {
			window.clearTimeout(successCloseTimerRef.current);
			successCloseTimerRef.current = null;
		}
		if (submitResetTimerRef.current !== null) {
			window.clearTimeout(submitResetTimerRef.current);
		}
		setSubmitStatus("error");
		submitResetTimerRef.current = window.setTimeout(() => {
			setSubmitStatus("idle");
			submitResetTimerRef.current = null;
		}, 900);
	}, []);

	const openUserQrDialog = useCallback(
		(user: User | UserListItem | null | undefined) => {
			if (!user) return;
			const currentLinkTemplates =
				useDashboard.getState().linkTemplates ?? linkTemplates;
			const configLinks = generateUserLinks(user, currentLinkTemplates, {
				includeInactive: true,
			});
			const subscriptionLink =
				formatLink((user as User).subscription_url) ||
				formatLink((user as User).key_subscription_url) ||
				formatLink(Object.values((user as User).subscription_urls ?? {})[0]);

			if (!configLinks.length && !subscriptionLink) return;
			setQRCode(configLinks, user.username);
			setSubLink(subscriptionLink || null);
		},
		[formatLink, linkTemplates, setQRCode, setSubLink],
	);

	const fetchUserForQr = useCallback(async (username: string) => {
		try {
			return await apiFetch<User>(`/user/${encodeURIComponent(username)}`);
		} catch (_error) {
			return null;
		}
	}, []);

	const subscriptionLinks = useMemo(() => {
		if (!editingUser) {
			return [];
		}
		const urls = editingUser.subscription_urls ?? {};
		const order = ["username-key", "key", "key-username", "token"] as const;
		const labels: Record<(typeof order)[number], string> = {
			"username-key": t("userDialog.links.subscriptionUsernameKey"),
			key: t("userDialog.links.subscriptionKey"),
			"key-username": t("userDialog.links.subscriptionKeyUsername"),
			token: t("userDialog.links.subscriptionToken"),
		};
		const orderIndex = new Map(order.map((key, index) => [key, index]));

		const results = Object.entries(urls)
			.map(([key, value]) => {
				const url = formatLink(value);
				if (!url) {
					return null;
				}

				const [baseKeyRaw, variant] = key.split("@", 2);
				const baseKey = baseKeyRaw as (typeof order)[number];
				const baseLabel = labels[baseKey] ?? baseKeyRaw;
				const label = variant ? `${baseLabel} (${variant})` : baseLabel;

				return {
					key,
					label,
					url,
					order: orderIndex.get(baseKey) ?? order.length,
					variant: variant ?? "",
				};
			})
			.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
			.sort((a, b) => {
				if (a.order !== b.order) {
					return a.order - b.order;
				}
				const aHasVariant = a.variant !== "";
				const bHasVariant = b.variant !== "";
				if (aHasVariant !== bHasVariant) {
					return aHasVariant ? 1 : -1;
				}
				return a.variant.localeCompare(b.variant, undefined, {
					numeric: true,
				});
			})
			.map(({ key, label, url }) => ({ key, label, url }));

		if (results.length === 0 && editingUser.subscription_url) {
			const fallback = formatLink(editingUser.subscription_url);
			if (fallback) {
				results.push({
					key: "primary",
					label: t("userDialog.links.subscription"),
					url: fallback,
				});
			}
		}

		return results;
	}, [editingUser, formatLink, t]);

	const userLinks = useMemo(
		() =>
			editingUser
				? generateUserLinks(editingUser, linkTemplates, {
						includeInactive: true,
					})
				: [],
		[editingUser, linkTemplates],
	);

	const configLinksText = useMemo(() => userLinks.join("\n"), [userLinks]);

	const configItems = useMemo(() => {
		return userLinks.map((link, index) => {
			const label =
				getConfigLabelFromLink(link) ||
				t("userDialog.links.configFallback", {
					index: index + 1,
				});
			return { link, label };
		});
	}, [userLinks, t]);

	const handleTabChange = (index: number) => {
		setActiveTab(index);
		const usageTabIndex = isEditing && canViewTraffic ? 1 : -1;
		if (index === usageTabIndex && !usageFetched && editingUser) {
			fetchUsageWithFilter({
				start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
			});
			setUsageFetched(true);
		}
	};

	const expireValue = useWatch({
		control: form.control,

		name: "expire",
	});

	const expireHelperText = useMemo(() => {
		if (!expireValue) {
			return null;
		}
		const { status, time } = relativeExpiryDate(expireValue);
		return t(status, { time });
	}, [expireValue, t]);

	useEffect(() => {
		const derivedDays = deriveDaysFromSeconds(expireValue);
		setExpireDays((prev) => (prev === derivedDays ? prev : derivedDays));
	}, [expireValue, deriveDaysFromSeconds]);

	const usageTitle = t("userDialog.total");

	const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));

	const [usageFilter, setUsageFilter] = useState("1m");
	const usageFetchSequence = useRef(0);

	const fetchUsageWithFilter = useCallback(
		(query: FilterUsageType) => {
			if (!editingUser) return;
			const requestId = ++usageFetchSequence.current;
			fetchUserUsage(editingUser as unknown as UserListItem, query)
				.then((data: any) => {
					if (requestId !== usageFetchSequence.current) return;
					const labels = [];

					const series = [];

					for (const key in data.usages) {
						series.push(data.usages[key].used_traffic);

						labels.push(data.usages[key].node_name);
					}

					setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
				})
				.catch((error) => {
					if (requestId === usageFetchSequence.current) {
						console.error("Failed to fetch user usage:", error);
					}
				});
		},
		[editingUser, colorMode, usageTitle, fetchUserUsage],
	);

	useEffect(() => {
		usageFetchSequence.current += 1;
		if (editingUser) {
			const formatted = formatUser(editingUser);
			form.reset(formatted);
			setExpireDays(deriveDaysFromSeconds(formatted.expire));
			setUsage(createUsageConfig(colorMode, usageTitle));
			setUsageFilter("1m");
			// Deep-link support: open directly on the Usage tab (index 1) when
			// requested via onEditingUser(user, 1), otherwise the Edit tab.
			const wantsUsageTab = editingUserInitialTab === 1 && canViewTraffic;
			if (wantsUsageTab) {
				setUsageFetched(true);
				fetchUsageWithFilter({
					start: dayjs()
						.utc()
						.subtract(30, "day")
						.format("YYYY-MM-DDTHH:00:00"),
				});
			} else {
				setUsageFetched(false);
			}
			setActiveTab(wantsUsageTab ? 1 : 0);
			setCopiedSubscriptionKey(null);
			setCopiedAllConfigs(false);
			setCopiedConfigIndex(null);
			if (formatted.next_plan_enabled) {
				const rule: AutoRenewRule = {
					id: createAutoRenewId(),
					dataLimit: formatted.next_plan_data_limit,
					expire: formatted.next_plan_expire,
					addRemaining: formatted.next_plan_add_remaining_traffic,
					fireOnEither: formatted.next_plan_fire_on_either,
				};
				setAutoRenewRules([rule]);
				resetAutoRenewFormValues(rule);
			} else {
				setAutoRenewRules([]);
				resetAutoRenewFormValues(null);
			}
		} else {
			const defaults = getDefaultValues();
			form.reset(defaults);
			setExpireDays(deriveDaysFromSeconds(defaults.expire));
			setUsage(createUsageConfig(colorMode, usageTitle));
			setUsageFilter("1m");
			setUsageFetched(false);
			setActiveTab(0);
			setCopiedSubscriptionKey(null);
			setCopiedAllConfigs(false);
			setCopiedConfigIndex(null);
			if (defaults.next_plan_enabled) {
				const rule: AutoRenewRule = {
					id: createAutoRenewId(),
					dataLimit: defaults.next_plan_data_limit,
					expire: defaults.next_plan_expire,
					addRemaining: defaults.next_plan_add_remaining_traffic,
					fireOnEither: defaults.next_plan_fire_on_either,
				};
				setAutoRenewRules([rule]);
				resetAutoRenewFormValues(rule);
			} else {
				setAutoRenewRules([]);
				resetAutoRenewFormValues(null);
			}
		}
	}, [
		editingUser,
		editingUserInitialTab,
		canViewTraffic,
		fetchUsageWithFilter,
		deriveDaysFromSeconds,
		form.reset,
		resetAutoRenewFormValues,
		colorMode,
		usageTitle,
	]);

	useEffect(() => {
		if (!canSetCustomKey) {
			form.setValue("manual_key_entry", false, { shouldDirty: true });
			form.setValue("credential_key", null, { shouldDirty: true });
		}
		if (!canSetFlow) {
			form.setValue("flow", "", { shouldDirty: false });
		}
	}, [canSetCustomKey, canSetFlow, form]);

	const submit = (values: FormType) => {
		if (submitStatus !== "idle") return;
		clearSubmitTimers();
		setLoading(true);
		setSubmitStatus("loading");
		setError(null);

		// Check user limit before submitting (even if status is not active)
		// This prevents creating users that would exceed the limit
		if (
			usersLimit !== null &&
			usersLimit !== undefined &&
			usersLimit > 0 &&
			activeUsersCount !== null
		) {
			if (activeUsersCount >= usersLimit) {
				const errorMessage = t("userDialog.usersLimitReached", {
					active: activeUsersCount,
					limit: usersLimit,
				});
				setError(errorMessage);
				setLoading(false);
				showSubmitError();
				return;
			}
		}

		if (limitReached) {
			setLoading(false);
			showSubmitError();
			return;
		}
		if (userManagementLocked) {
			setLoading(false);
			showSubmitError();
			return;
		}

		const {
			service_id: _serviceId,

			next_plan_enabled,

			next_plan_data_limit,

			next_plan_expire,

			next_plan_add_remaining_traffic,

			next_plan_fire_on_either,

			flow,

			status,

			data_limit,

			data_limit_reset_strategy,

			on_hold_expire_duration,

			ip_limit,

			speed_limit,

			credential_key,

			manual_key_entry,

			...rest
		} = values;

		// Validate data_limit based on admin permissions (don't auto-normalize, show error instead)
		const maxDataLimitPerUser =
			userData?.permissions?.users?.max_data_limit_per_user;
		const allowUnlimitedData =
			hasFullAccess ||
			Boolean(
				userData?.permissions?.users?.[UserPermissionToggle.AllowUnlimitedData],
			);

		// data_limit from schema is already in bytes
		const dataLimitBytes = data_limit || 0;
		const setDataLimitError = (message: string) => {
			setError(message);
			setLoading(false);
			showSubmitError();
			form.setError("data_limit", {
				type: "manual",
				message,
			});
		};

		if (isCreatedTrafficScope && dataLimitBytes <= 0) {
			setDataLimitError(t("userDialog.createdTrafficUnlimitedNotAllowed"));
			return;
		}

		if (isCreatedTrafficScope && isEditing && editingUser) {
			const usedTraffic = Math.max(0, editingUser.used_traffic ?? 0);
			if (dataLimitBytes > 0 && dataLimitBytes < usedTraffic) {
				setDataLimitError(
					t("userDialog.dataLimitBelowUsedTraffic", {
						used: formatBytes(usedTraffic, 2),
					}),
				);
				return;
			}
		}

		if (maxDataLimitPerUser !== null && maxDataLimitPerUser !== undefined) {
			// If unlimited (0) is requested but not allowed, show error
			if (dataLimitBytes === 0 && !allowUnlimitedData) {
				const maxGb = (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2);
				const errorMessage = t("userDialog.unlimitedNotAllowed", {
					max: maxGb,
				});
				setDataLimitError(errorMessage);
				return;
			}
			// If exceeds max limit, show error
			if (dataLimitBytes > 0 && dataLimitBytes > maxDataLimitPerUser) {
				const originalGb = (dataLimitBytes / BYTES_PER_GB).toFixed(2);
				const maxGb = (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2);
				const errorMessage = t("userDialog.dataLimitExceedsMax", {
					original: originalGb,
					max: maxGb,
				});
				setDataLimitError(errorMessage);
				return;
			}
		}

		// Validate next_plan data_limit (don't auto-normalize, show error instead)
		const normalizedNextPlanDataLimit =
			next_plan_enabled && next_plan_data_limit && next_plan_data_limit > 0
				? gigabytesToBytes(Number(next_plan_data_limit))
				: 0;

		if (
			maxDataLimitPerUser !== null &&
			maxDataLimitPerUser !== undefined &&
			normalizedNextPlanDataLimit > 0
		) {
			if (normalizedNextPlanDataLimit > maxDataLimitPerUser) {
				const originalGb = (normalizedNextPlanDataLimit / BYTES_PER_GB).toFixed(
					2,
				);
				const maxGb = (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2);
				const errorMessage = t("userDialog.nextPlanDataLimitExceedsMax", {
					original: originalGb,
					max: maxGb,
				});
				setError(errorMessage);
				setLoading(false);
				showSubmitError();
				form.setError("next_plan_data_limit", {
					type: "manual",
					message: errorMessage,
				});
				return;
			}
		}
		// If unlimited (0) is requested but not allowed, show error
		if (
			normalizedNextPlanDataLimit === 0 &&
			next_plan_enabled &&
			!allowUnlimitedData &&
			maxDataLimitPerUser !== null &&
			maxDataLimitPerUser !== undefined
		) {
			const maxGb = (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2);
			const errorMessage = t("userDialog.nextPlanUnlimitedNotAllowed", {
				max: maxGb,
			});
			setError(errorMessage);
			setLoading(false);
			showSubmitError();
			form.setError("next_plan_data_limit", {
				type: "manual",
				message: errorMessage,
			});
			return;
		}

		const nextPlanPayload = next_plan_enabled
			? {
					data_limit: normalizedNextPlanDataLimit,

					expire: next_plan_expire ?? 0,

					add_remaining_traffic: next_plan_add_remaining_traffic,

					fire_on_either: next_plan_fire_on_either,
				}
			: null;

		const normalizedSpeedLimitKbps =
			typeof speed_limit === "number" &&
			Number.isFinite(speed_limit) &&
			speed_limit > 0
				? Math.round(speed_limit * 1000)
				: 0;

		const normalizedIpLimit =
			typeof ip_limit === "number" && Number.isFinite(ip_limit) && ip_limit > 0
				? Math.floor(ip_limit)
				: 0;

		if (!isEditing) {
			const effectiveServiceId = hasPrivilegedRole
				? selectedServiceId
				: (selectedServiceId ??
					(nonSudoSingleService ? (services[0]?.id ?? null) : null));

			if (!effectiveServiceId) {
				setError(t("userDialog.selectService"));
				setLoading(false);
				showSubmitError();
				return;
			}

			const serviceBody: UserCreateWithService = {
				username: values.username,

				service_id: effectiveServiceId,

				note: values.note,

				telegram_id: values.telegram_id,

				contact_number: values.contact_number,

				status:
					values.status === "active" ||
					values.status === "disabled" ||
					values.status === "on_hold"
						? values.status
						: "active",

				expire: values.expire,

				data_limit: values.data_limit,

				ip_limit: normalizedIpLimit,

				speed_limit_kbps: normalizedSpeedLimitKbps,

				data_limit_reset_strategy:
					data_limit && data_limit > 0 ? data_limit_reset_strategy : "no_reset",

				on_hold_expire_duration:
					status === "on_hold" ? on_hold_expire_duration : null,

				flow: canSetFlow ? flow || null : null,
			};

			if (canSetCustomKey && manual_key_entry && credential_key) {
				serviceBody.credential_key = credential_key;
			}

			if (nextPlanPayload) {
				serviceBody.next_plans = [nextPlanPayload];
			}

			createUserWithService(serviceBody)

				.then(() => {
					setSubmitStatus("success");
					const qrUserPromise = fetchUserForQr(values.username);
					toast({
						title: t("userDialog.userCreated", { username: values.username }),

						status: "success",

						isClosable: true,

						position: "top",

						duration: 3000,
					});

					successCloseTimerRef.current = window.setTimeout(() => {
						onClose();
						successCloseTimerRef.current = null;
						qrUserPromise.then((qrUser) => {
							window.setTimeout(() => openUserQrDialog(qrUser), 0);
						});
					}, 1000);
				})

				.catch((err) => {
					if (err?.response?.status === 409 || err?.response?.status === 400) {
						setError(err?.response?._data?.detail);
					}

					if (err?.response?.status === 422) {
						Object.keys(err.response._data.detail).forEach((key) => {
							setError(err?.response._data.detail[key] as string);

							form.setError(
								key as "username" | "data_limit" | "expire" | "service_id",

								{
									type: "custom",

									message: err.response._data.detail[key],
								},
							);
						});
					}
					setLoading(false);
					showSubmitError();
				});

			return;
		}

		const body: Record<string, unknown> = {
			...rest,

			data_limit: data_limit,

			ip_limit: normalizedIpLimit,

			speed_limit_kbps: normalizedSpeedLimitKbps,

			status:
				status === "active" || status === "disabled" || status === "on_hold"
					? status
					: "active",

			on_hold_expire_duration:
				status === "on_hold" ? on_hold_expire_duration : null,

			flow: canSetFlow ? flow || null : null,
		};
		if (canConfigurePeriodicUsageReset) {
			body.data_limit_reset_strategy =
				data_limit && data_limit > 0 ? data_limit_reset_strategy : "no_reset";
		}

		if (canSetCustomKey && manual_key_entry && credential_key) {
			body.credential_key = credential_key;
		}

		if (nextPlanPayload) {
			body.next_plans = [nextPlanPayload];
		} else if (
			!next_plan_enabled &&
			(editingUser?.next_plans?.length ?? 0) > 0
		) {
			body.next_plans = [];
		}

		if (!selectedServiceId) {
			setError(t("userDialog.selectService"));
			setLoading(false);
			showSubmitError();
			return;
		}

		if (
			selectedServiceId !== editingUser?.service_id &&
			(!requiresServiceScope || !editingUser?.service_id)
		) {
			body.service_id = selectedServiceId;
		}

		editUser(editingUser?.username, body as UserCreate)

			.then(() => {
				setSubmitStatus("success");
				toast({
					title: t("userDialog.userEdited", { username: values.username }),

					status: "success",

					isClosable: true,

					position: "top",

					duration: 3000,
				});

				successCloseTimerRef.current = window.setTimeout(() => {
					onClose();
					successCloseTimerRef.current = null;
				}, 1000);
			})

			.catch((err) => {
				if (err?.response?.status === 409 || err?.response?.status === 400) {
					setError(err?.response?._data?.detail);
				}

				if (err?.response?.status === 422) {
					Object.keys(err.response._data.detail).forEach((key) => {
						setError(err?.response._data.detail[key] as string);

						form.setError(
							key as "username" | "data_limit" | "expire" | "service_id",

							{
								type: "custom",

								message: err.response._data.detail[key],
							},
						);
					});
				}
				setLoading(false);
				showSubmitError();
			});
	};

	function onClose() {
		clearSubmitTimers();
		form.reset(getDefaultValues());
		setExpireDays(null);

		onCreateUser(false);

		onEditingUser(null);

		setError(null);

		setUsageFilter("1m");
		setUsageFetched(false);
		setActiveTab(0);
		setCopiedSubscriptionKey(null);
		setCopiedAllConfigs(false);
		setCopiedConfigIndex(null);

		setSelectedServiceId(null);

		setAutoRenewRules([]);
		resetAutoRenewFormValues(null);
		setAutoRenewFormMode(null);
		setEditingRuleIndex(null);
		setAutoRenewOpen(false);
		setLoading(false);
		setSubmitStatus("idle");
	}

	const handleResetUsage = () => {
		if (!canResetUsageVisible) {
			return;
		}
		useDashboard.setState({
			resetUsageUser: (editingUser as unknown as UserListItem) ?? null,
		});
	};

	const handleRevokeSubscription = () => {
		if (!canRevokeSubscriptionVisible) {
			return;
		}
		useDashboard.setState({
			revokeSubscriptionUser: (editingUser as unknown as UserListItem) ?? null,
		});
	};

	const handleDeleteUser = async () => {
		if (!canDeleteUsersVisible || !editingUser) {
			return;
		}
		setDeleteLoading(true);
		try {
			await deleteUser(editingUser as unknown as UserListItem);
			toast({
				title: t("deleteUser.deleteSuccess", {
					username: editingUser.username,
				}),
				status: "success",
				isClosable: true,
				position: "top",
				duration: 3000,
			});
			onClose();
		} finally {
			setDeleteLoading(false);
		}
	};

	const disabled = loading || limitReached || userManagementLocked;
	const serviceSelectionDisabled =
		disabled || (isEditing && requiresServiceScope);
	const submitDisabled = disabled || !form.formState.isValid;

	const isOnHold = userStatus === "on_hold";

	const [randomUsernameLoading, setrandomUsernameLoading] = useState(false);

	const [otherInfoOpen, setOtherInfoOpen] = useState(false);

	const createRandomUsername = (): string => {
		setrandomUsernameLoading(true);

		let result = "";

		const characters =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		const charactersLength = characters.length;

		let counter = 0;

		while (counter < 6) {
			result += characters.charAt(Math.floor(Math.random() * charactersLength));

			counter += 1;
		}

		return result;
	};

	return (
		<Modal open={isOpen} onClose={onClose} size={isMobileDialog ? "full" : shouldCompactModal ? "lg" : "2xl"} scrollBehavior="inside">
			<ModalOverlay className="bg-blackAlpha-300" />

			<FormProvider {...form}>
				<XrayModalContent dir={isRTL ? "rtl" : "ltr"} className="mx-0 md:mx-3 my-0 md:my-[3.75rem] relative overflow-hidden rounded-[0px] md:rounded-md flex flex-col">
					<ModalCloseButton disabled={loading} className="end-4 start-[auto] top-3 absolute z-[2] rtl:end-[auto] rtl:start-4" />

					<div className={cn("[transition:filter_0.2s_ease] min-h-0 flex-1 flex flex-col", limitReached ? "pointer-events-none" : "pointer-events-auto", limitReached ? "[filter:blur(6px)]" : "[filter:none]")}>
						<form
							onSubmit={form.handleSubmit(submit)}
							style={{
								minHeight: 0,
								flex: 1,
								display: "flex",
								flexDirection: "column",
							}}
						>
							<ModalHeader className="px-4 md:px-5 py-3 pe-12 relative flex items-center justify-start gap-2">
								<div className="shrink-0">
									<Icon color="primary" size={30}>
										{isEditing ? (
											<EditUserIcon className="text-white" />
										) : (
											<AddUserIcon className="text-white" />
										)}
									</Icon>
								</div>

								<p className="font-semibold text-[1.125rem]">
									{isEditing
										? `${t("userDialog.editUserTitle")}${
												editingUser?.username ? ` ${editingUser.username}` : ""
											}`
										: t("createNewUser")}
								</p>
							</ModalHeader>

							<XrayModalBody className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 sm:px-4 md:px-5 py-3 md:py-4 [webkit-overflow-scrolling:touch] overscroll-contain">
								{isEditing && isServiceManagedUser && (
									<SlideNotice open={serviceNoticeVisible}>
										<Alert status="info" className={cn("rounded-md items-start overflow-hidden relative", statusNotice ? "mb-3" : "mb-4")}>
											<AlertIcon />
											<div className="flex-1 min-w-0!">
												<AlertDescription>
													{t("userDialog.serviceManagedNotice", {
														service: editingUser?.service_name ?? "",
													})}
												</AlertDescription>
											</div>
											<div className="absolute start-0 end-0 bottom-0 h-[2px] bg-whiteAlpha-400 rounded-full overflow-hidden pointer-events-none">
												<div key={serviceNoticeSeed} style={{ animation: `rb-service-notice-progress ${SERVICE_NOTICE_DURATION_MS}ms linear forwards` }} className={cn(cn("h-full bg-whiteAlpha-800", isRTL ? "[transform-origin:right_center]" : "[transform-origin:left_center]"))} />
											</div>
										</Alert>
									</SlideNotice>
								)}

								{isEditing && statusNotice && (
									<SlideNotice open={statusNoticeVisible}>
										<Alert status="info" className="mb-4 rounded-md items-start overflow-hidden relative">
											<AlertIcon />
											<div className="flex-1 min-w-0!">
												<AlertDescription>{statusNotice}</AlertDescription>
											</div>
											<div className="absolute start-0 end-0 bottom-0 h-[2px] bg-whiteAlpha-400 rounded-full overflow-hidden pointer-events-none">
												<div key={statusNoticeSeed} style={{ animation: `rb-service-notice-progress ${SERVICE_NOTICE_DURATION_MS}ms linear forwards` }} className={cn(cn("h-full bg-whiteAlpha-800", isRTL ? "[transform-origin:right_center]" : "[transform-origin:left_center]"))} />
											</div>
										</Alert>
									</SlideNotice>
								)}

								{showServiceSelector && !servicesLoading && !hasServices && (
									<Alert status="warning" variant="subtle" className="mb-4 rounded-md w-full">
										<AlertIcon />
										<AlertDescription>
											{`${t("userDialog.noServicesAvailable")} ${t("userDialog.createServiceToManage")}`}
										</AlertDescription>
									</Alert>
								)}

								{userManagementLocked && (
									<Alert status="warning" className="mb-4 rounded-md">
										<AlertIcon />
										<AlertDescription>
											{t("userDialog.managementLocked")}
										</AlertDescription>
									</Alert>
								)}

								<Tabs index={activeTab} onChange={handleTabChange} variant="unstyled" isLazy className="w-full xray-dialog-auto-sections">
									<TabList className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-x-auto overflow-y-hidden whitespace-nowrap">
										<Tab className="shrink-0">{t("form")}</Tab>
										{isEditing && canViewTraffic && (
											<Tab className="shrink-0">{t("userDialog.tabs.usage")}</Tab>
										)}
										{isEditing && (
											<Tab className="shrink-0">{t("userDialog.tabs.links")}</Tab>
										)}
									</TabList>
									<TabPanels>
										<TabPanel className="px-0 pt-4">
											<div {...(shouldCenterForm
													? { maxW: "720px", mx: "auto", w: "full" }
													: {})} className={cn("grid grid-cols-[repeat(1,_1fr)] gap-3", useTwoColumns ? "md:grid-cols-[repeat(2,_1fr)]" : "md:grid-cols-[minmax(0,_1fr)]", "xray-dialog-section user-dialog-edit-grid")}>
												<div>
													<div className="flex flex-col items-center gap-2 justify-between">
														<div className="flex flex-col auto-rows-[min-content] w-full">
															<div className="flex flex-row w-full gap-2">
																<FormControl isInvalid={
																		!!form.formState.errors.username?.message
																	} className="mb-[10px]">
																	<FormLabel className={cn("flex items-center gap-2", isRTL ? "justify-end" : "justify-start", isRTL ? "flex-row-reverse" : "flex-row")}>
																		<p>{t("username")}</p>
																		<Tooltip hasArrow placement="top" label={t("userDialog.usernameHint")}>
																			<span className="inline-flex text-gray-400 cursor-help">
																				<QuestionMarkCircleIcon className="w-[16px] h-[16px]" />
																			</span>
																		</Tooltip>
																	</FormLabel>
																	<div className="flex flex-row gap-2 items-center">
																		<div className="flex-1 min-w-0!">
																			<InputGroup size="sm" dir={isRTL ? "rtl" : "ltr"}>
																				<ChakraInput type="text" disabled={disabled || isEditing} {...(!isEditing ? endPadding : {})} {...form.register("username")} className="rounded-[6px]" />
																				{!isEditing && (
																					<InputRightElement style={{ insetInlineEnd: endAdornmentProps.insetInlineEnd, insetInlineStart: endAdornmentProps.insetInlineStart, right: endAdornmentProps.right, left: endAdornmentProps.left }} className="w-auto h-full">
																						<IconButton aria-label={t(
																								"userDialog.generateUsername",
																							)} size="sm" variant="ghost" onClick={() => {
																								const randomUsername =
																									createRandomUsername();
																								form.setValue(
																									"username",
																									randomUsername,
																									{
																										shouldDirty: true,
																										shouldValidate: true,
																									},
																								);
																								form.trigger("username");
																								setTimeout(() => {
																									setrandomUsernameLoading(
																										false,
																									);
																								}, 350);
																							}} loading={randomUsernameLoading} disabled={disabled} className="h-[32px] min-w-[32px]! w-[32px]" >{<SparklesIcon className="w-[18px]" />}</IconButton>
																					</InputRightElement>
																				)}
																			</InputGroup>
																		</div>
																		{isEditing && (
																			<div className="flex flex-row items-center gap-2 px-1">
																				<Controller
																					name="status"
																					control={form.control}
																					render={({ field }) => {
																						return (
																							<Tooltip placement="top" label={
																									"status: " +
																									t(`status.${field.value}`)
																								} className="capitalize">
																								<div>
																									<Switch colorScheme="primary" checked={
																											field.value === "active"
																										} onChange={(e) => {
																											if (e.target.checked) {
																												field.onChange(
																													"active",
																												);
																											} else {
																												field.onChange(
																													"disabled",
																												);
																											}
																										}} />
																								</div>
																							</Tooltip>
																						);
																					}}
																				/>
																			</div>
																		)}
																	</div>

																	<FormHelperText className={cn("text-[0.75rem] text-gray-500", isRTL ? "text-start" : "text-end")}>
																		{`${usernameValue?.length ?? 0}/32`}
																	</FormHelperText>
																	{isEditing &&
																		hasPrivilegedRole &&
																		editingUser?.admin_username && (
																			<FormHelperText className={cn("text-[0.75rem] text-gray-500 mt-1", isRTL ? "text-end" : "text-start")}>
																				{t("userDialog.createdBy")}:{" "}
																				{editingUser.admin_username}
																			</FormHelperText>
																		)}

																	<FormErrorMessage>
																		{form.formState.errors.username?.message}
																	</FormErrorMessage>
																</FormControl>
															</div>

															<div className="flex flex-row gap-3 mb-[10px]">
																<FormControl isInvalid={
																		!!form.formState.errors.data_limit?.message
																	} className="flex-1">
																	<FormLabel className={cn(isRTL ? "text-right" : "text-left")}>
																		{t("userDialog.dataLimit")}
																	</FormLabel>
																	<Controller
																		control={form.control}
																		name="data_limit"
																		render={({ field }) => {
																			return (
																				<>
																					{renderUnitInput({
																						unit: DATA_UNIT,
																						value: field.value
																							? String(field.value)
																							: "",
																						onChange: field.onChange,
																						disabled,
																					})}
																					{isEditing && remainingDataInfo && (
																						<FormHelperText className={cn("text-[0.75rem] text-gray-500", isRTL ? "text-right" : "text-left")}>
																							{`${remainingDataInfo.label}: ${remainingDataInfo.value}`}
																						</FormHelperText>
																					)}
																					<FormErrorMessage>
																						{
																							form.formState.errors.data_limit
																								?.message
																						}
																					</FormErrorMessage>
																				</>
																			);
																		}}
																	/>
																</FormControl>
																<FormControl isInvalid={Boolean(form.formState.errors.ip_limit)} className="flex-1 min-w-0!">
																	<FormLabel className={cn("flex items-center gap-2", isRTL ? "justify-end" : "justify-start", isRTL ? "flex-row-reverse" : "flex-row", isRTL ? "text-right" : "text-left")}>
																		{t("userDialog.ipLimitLabel")}
																		<Tooltip hasArrow placement="top" label={t("userDialog.ipLimitHint")}>
																			<span className="inline-flex text-gray-400 cursor-help">
																				<QuestionMarkCircleIcon className="w-[16px] h-[16px]" />
																			</span>
																		</Tooltip>
																	</FormLabel>
																	<Controller
																		control={form.control}
																		name="ip_limit"
																		rules={{
																			validate: (value) => {
																				if (
																					value === null ||
																					value === undefined
																				) {
																					return true;
																				}
																				if (
																					typeof value !== "number" ||
																					Number.isNaN(value)
																				) {
																					return t(
																						"userDialog.ipLimitValidation",
																					);
																				}
																				return value >= 0
																					? true
																					: t("userDialog.ipLimitValidation");
																			},
																		}}
																		render={({ field }) => (
																			<>
																				<NumericInput
																					className={alwaysVisibleStepper}
																					value={
																						typeof field.value === "number" && field.value > 0
																							? String(field.value)
																							: ""
																					}
																					min={0}
																					step={1}
																					disabled={disabled || !ipLimitEditable}
																					isInvalid={Boolean(form.formState.errors.ip_limit)}
																					onChange={(valueAsString) => {
																						const raw = valueAsString.trim();
																						if (!raw || raw === "-") {
																							field.onChange(null);
																							return;
																						}
																						const parsed = Number(raw);
																						if (Number.isNaN(parsed)) {
																							return;
																						}
																						field.onChange(parsed < 0 ? 0 : Math.floor(parsed));
																					}}
																					fieldProps={{ placeholder: t("userDialog.remainingDataUnlimited"), dir: "ltr", className: "h-[32px] min-h-[32px]", style: { borderRadius: "6px", textAlign: isRTL ? "right" : "left" } }}
																				/>
																				<FormErrorMessage>
																					{form.formState.errors.ip_limit?.message}
																				</FormErrorMessage>
																			</>
																		)}
																	/>
																</FormControl>
															</div>

															<Collapse in={!!(dataLimit && dataLimit > 0)} animateOpacity style={{ width: "100%" }}>
																<FormControl className="h-[66px]">
																	<FormLabel className={cn(isRTL ? "text-right" : "text-left")}>
																		{t("userDialog.periodicUsageReset")}
																	</FormLabel>

																	<Controller
																		control={form.control}
																		name="data_limit_reset_strategy"
																		render={({ field }) => {
																			return (
																				<Select size="sm" {...field} disabled={
																						disabled ||
																						!canConfigurePeriodicUsageReset
																					} className={cn(disabled ||
																						!canConfigurePeriodicUsageReset ? "bg-gray-100" : "bg-transparent", disabled ||
																							!canConfigurePeriodicUsageReset ? "dark:bg-gray-600" : "dark:bg-transparent")}>
																					{resetStrategy.map((s) => {
																						return (
																							<option
																								key={s.value}
																								value={s.value}
																							>
																								{t(
																									"userDialog.resetStrategy" +
																										s.title,
																								)}
																							</option>
																						);
																					})}
																				</Select>
																			);
																		}}
																	/>
																</FormControl>
															</Collapse>
															<div className="flex flex-row gap-3 mb-[10px]">
																<FormControl isInvalid={Boolean(
																		form.formState.errors.speed_limit,
																	)} className="flex-1 min-w-0!">
																	<FormLabel className={cn("flex items-center gap-2", isRTL ? "justify-end" : "justify-start", isRTL ? "flex-row-reverse" : "flex-row", isRTL ? "text-right" : "text-left")}>
																		{t("userDialog.speedLimitLabel")}
																		<Tooltip hasArrow placement="top" label={t("userDialog.speedLimitHint")}>
																			<span className="inline-flex text-gray-400 cursor-help">
																				<QuestionMarkCircleIcon className="w-[16px] h-[16px]" />
																			</span>
																		</Tooltip>
																	</FormLabel>
																	<Controller
																		control={form.control}
																		name="speed_limit"
																		rules={{
																			validate: (value) => {
																				if (
																					value === null ||
																					value === undefined
																				) {
																					return true;
																				}
																				if (
																					typeof value !== "number" ||
																					Number.isNaN(value)
																				) {
																					return t(
																						"userDialog.speedLimitValidation",
																					);
																				}
																				return value >= 0
																					? true
																					: t(
																							"userDialog.speedLimitValidation",
																						);
																			},
																		}}
																		render={({ field }) => (
																			<>
																				{renderUnitInput({
																					unit: SPEED_UNIT,
																					value:
																						typeof field.value === "number" &&
																						field.value > 0
																							? String(field.value)
																							: "",
																					onChange: (event) => {
																						const parsed = Number(
																							event.target.value.trim(),
																						);
																						field.onChange(
																							Number.isFinite(parsed) &&
																								parsed > 0
																								? Math.round(parsed * 100) / 100
																								: null,
																						);
																					},
																					disabled: disabled || !speedLimitEditable,
																				})}
																				<FormErrorMessage>
																					{
																						form.formState.errors.speed_limit
																							?.message
																					}
																				</FormErrorMessage>
																			</>
																		)}
																	/>
																</FormControl>
																<div className="flex flex-1" />
															</div>

															<FormControl isInvalid={
																	isOnHold
																		? Boolean(
																				form.formState.errors
																					.on_hold_expire_duration,
																			)
																		: Boolean(form.formState.errors.expire)
																} className="mb-[10px]">
																<div className={"grid grid-cols-[1fr] md:grid-cols-[minmax(0,_1fr)_auto] [grid-template-areas:'label'_'field'_'helper'_'button'] md:[grid-template-areas:'label_.'_'field_button'_'helper_.'] gap-y-2 gap-x-0 md:gap-x-4 w-full min-w-0!"}>
																	<FormLabel className={cn("[grid-area:label] mb-0", isRTL ? "text-right" : "text-left")}>
																		{isOnHold
																			? t("expires.days")
																			: t("expires.selectDate")}
																	</FormLabel>
																	<div className="[grid-area:field] min-w-0!">
																		{isOnHold ? (
																			<Controller
																				control={form.control}
																				name="on_hold_expire_duration"
																				render={({ field }) => {
																					return renderUnitInput({
																						unit: DAYS_UNIT,
																						value: field.value
																							? String(field.value)
																							: "",
																						disabled,
																						type: "text",
																						inputMode: "decimal",
																						onChange: (event) => {
																							form.setValue("expire", null);
																							const raw = event.target.value;
																							if (!raw) {
																								field.onChange(null);
																								return;
																							}
																							if (
																								!/^[0-9]*\.?[0-9]*$/.test(raw)
																							) {
																								return;
																							}
																							const parsed = Number(raw);
																							if (
																								Number.isNaN(parsed) ||
																								parsed < 0
																							) {
																								return;
																							}
																							field.onChange(
																								Math.round(parsed),
																							);
																						},
																					});
																				}}
																			/>
																		) : (
																			<Controller
																				name="expire"
																				control={form.control}
																				render={({ field }) => {
																					const selectedDate = field.value
																						? dayjs.unix(field.value).toDate()
																						: null;

																					const handleDateChange = (
																						value: Date | null,
																					) => {
																						if (!value) {
																							field.onChange(null);
																							form.setValue(
																								"on_hold_expire_duration",
																								null,
																								{
																									shouldDirty: false,
																								},
																							);
																							return;
																						}
																						const normalized = dayjs(value)
																							.utc()
																							.unix();
																						form.setValue(
																							"on_hold_expire_duration",
																							null,
																							{
																								shouldDirty: false,
																							},
																						);
																						field.onChange(normalized);
																					};

																					return (
																						<DateTimePicker
																							value={selectedDate}
																							onChange={handleDateChange}
																							placeholder={t(
																								"expires.selectDate",
																							)}
																							disabled={disabled}
																							minDate={new Date()}
																							quickSelects={quickExpiryOptions.map(
																								(option) => ({
																									label: option.label,
																									onClick: () => {
																										const newDate =
																											addQuickExpiry(
																												selectedDate,
																												option.amount,
																												option.unit,
																											);
																										handleDateChange(newDate);
																									},
																								}),
																							)}
																						/>
																					);
																				}}
																			/>
																		)}
																	</div>
																	{!isOnHold && expireHelperText ? (
																		<FormHelperText className="[grid-area:helper] mt-0">
																			{expireHelperText}
																		</FormHelperText>
																	) : null}
																	{isOnHold ? (
																		<div className="flex flex-row items-center [grid-area:helper] gap-2 flex-wrap">
																			{[7, 30, 60, 90, 180, 365].map((days) => (
																				<Button key={days} size="xs" variant="outline" disabled={disabled} onClick={() => {
																						form.setValue("expire", null);
																						form.setValue(
																							"on_hold_expire_duration",
																							days,
																							{
																								shouldDirty: true,
																								shouldValidate: true,
																							},
																						);
																					}}>
																					{days}D
																				</Button>
																			))}
																		</div>
																	) : null}
																	<Button size="sm" variant={isOnHold ? "solid" : "outline"} colorScheme={isOnHold ? "primary" : "gray"} onClick={() => {
																			if (isOnHold) {
																				form.setValue("status", "active", {
																					shouldDirty: true,
																				});
																				form.setValue(
																					"on_hold_expire_duration",
																					null,
																					{
																						shouldDirty: true,
																					},
																				);
																			} else {
																				form.setValue("status", "on_hold", {
																					shouldDirty: true,
																				});
																				form.setValue("expire", null, {
																					shouldDirty: true,
																				});
																			}
																		}} disabled={disabled} className="[grid-area:button] min-w-[100%]! md:min-w-[auto]! self-stretch md:self-end justify-self-stretch md:justify-self-start shrink-0 h-[32px]">
																		{t("onHold.button")}
																	</Button>
																</div>
																{isOnHold ? (
																	<FormErrorMessage>
																		{
																			form.formState.errors
																				.on_hold_expire_duration?.message
																		}
																	</FormErrorMessage>
																) : (
																	<FormErrorMessage>
																		{form.formState.errors.expire?.message}
																	</FormErrorMessage>
																)}
															</FormControl>

															{canSetFlow && (
																<FormControl className="mb-[10px]">
																	<FormLabel>
																		{t("userDialog.flow.label")}
																	</FormLabel>
																	<Controller
																		name="flow"
																		control={form.control}
																		render={({ field }) => (
																			<Select
																				size="sm"
																				value={field.value ?? ""}
																				onChange={(event) =>
																					field.onChange(event.target.value)
																				}
																				disabled={disabled}
																			>
																				<option value="">
																					{t("userDialog.flow.none")}
																				</option>
																				<option value="xtls-rprx-vision">
																					{t(
																						"userDialog.flow.xtls_rprx_vision",
																					)}
																				</option>
																				<option value="xtls-rprx-vision-udp443">
																					{t(
																						"userDialog.flow.xtls_rprx_vision_udp443",
																					)}
																				</option>
																			</Select>
																		)}
																	/>
																</FormControl>
															)}
														</div>

														{error && (
															<Alert status="error" className="hidden md:flex">
																<AlertIcon />

																{error}
															</Alert>
														)}
													</div>
												</div>

												{showServiceSelector && (
													<div className={cn(useTwoColumns ? "mt-0" : "mt-4")}>
														<FormControl required>
															<FormLabel>
																{t("userDialog.selectServiceLabel")}
															</FormLabel>

															{servicesLoading ? (
																<div className="flex flex-row items-center gap-2 py-4">
																	<Spinner size="sm" />

																	<p className="text-[0.875rem] text-gray-500 dark:text-gray-400">
																		{t("loading")}
																	</p>
																</div>
															) : hasServices ? (
																<div className="flex flex-col items-stretch gap-3">
																	{services.map((service) => {
																		const isSelected =
																			selectedServiceId === service.id;
																		const isBroken =
																			service.broken === true ||
																			service.has_hosts === false;

																		return (
																			// biome-ignore lint/a11y/useSemanticElements: service card holds block content; keyboard toggling is handled in onKeyDown
																			<div key={service.id} role="button" tabIndex={
																					serviceSelectionDisabled || isBroken
																						? -1
																						: 0
																				} aria-pressed={isSelected} onKeyDown={(event) => {
																					if (
																						serviceSelectionDisabled ||
																						isBroken
																					)
																						return;

																					if (
																						event.key === "Enter" ||
																						event.key === " "
																					) {
																						event.preventDefault();

																						setSelectedServiceId(service.id);
																					}
																				}} onClick={() => {
																					if (
																						serviceSelectionDisabled ||
																						isBroken
																					)
																						return;

																					setSelectedServiceId(service.id);
																				}} className={cn(serviceSelectionDisabled ? "" : (isSelected ? "hover:border-primary-500!" : "hover:border-gray-300!"), cn("border rounded-md p-4 [transition:border-color_0.2s_ease,_background-color_0.2s_ease]", isSelected ? "border-primary-500!" : "border-gray-200!", isSelected ? "bg-primary-50" : "bg-transparent", serviceSelectionDisabled || isBroken ? "cursor-not-allowed" : "cursor-pointer", serviceSelectionDisabled || isBroken ? "pointer-events-none" : "pointer-events-auto", isSelected ? "dark:border-primary-400!" : "dark:border-gray-700!", isSelected ? "dark:bg-primary-900" : "dark:bg-transparent"))}>
																				<div className="flex flex-row gap-2 justify-between items-start">
																					<div className="flex flex-col items-start gap-0">
																						<p className="font-semibold">
																							{service.name}
																						</p>

																						{service.description && (
																							<p className="text-[0.875rem] text-gray-500 dark:text-gray-400">
																								{service.description}
																							</p>
																						)}
																					</div>

																					<p className="text-[0.75rem] text-gray-500 dark:text-gray-400">
																						{t("userDialog.serviceSummary", {
																							hosts: service.host_count,

																							users: service.user_count,
																						})}
																					</p>
																					{isBroken && (
																						<Badge colorScheme="red" className="mt-1">
																							{t("userDialog.brokenService")}
																						</Badge>
																					)}
																				</div>
																			</div>
																		);
																	})}
																</div>
															) : null}

															{selectedService && (
																<FormHelperText className="mt-2">
																	{t("userDialog.serviceSummary", {
																		hosts: selectedService.host_count,

																		users: selectedService.user_count,
																	})}

																	{selectedService &&
																		(selectedService.broken ||
																			selectedService.has_hosts === false) && (
																			<p className="text-red-500 text-[0.875rem] mt-1">
																				{t("userDialog.brokenServiceWarning")}
																			</p>
																		)}
																</FormHelperText>
															)}
														</FormControl>
													</div>
												)}

												<div className={cn("col-span-1", showServiceSelector ? "md:col-span-2" : "md:col-span-1")}>
													{hasExistingKey && canSetCustomKey && (
														<>
															<FormControl className="rb-dialog-switch-row">
																<FormLabel className="mb-0">
																	{t("userDialog.allowManualKeyEntry")}
																</FormLabel>
																<Controller
																	name="manual_key_entry"
																	control={form.control}
																	render={({ field }) => (
																		<Switch size="sm" colorScheme="primary" checked={field.value} onChange={(event) =>
																				field.onChange(event.target.checked)
																			} disabled={disabled} />
																	)}
																/>
															</FormControl>
															{manualKeyEntryEnabled && (
																<FormControl isInvalid={Boolean(
																		form.formState.errors.credential_key,
																	)} className="mt-4">
																	<FormLabel>
																		{t("userDialog.credentialKeyLabel")}
																	</FormLabel>
																	<Controller
																		name="credential_key"
																		control={form.control}
																		render={({ field }) => (
																			<ChakraInput placeholder="35e4e39c7d5c4f4b8b71558e4f37ff53" maxLength={32} value={field.value ?? ""} onChange={(event) =>
																					field.onChange(event.target.value)
																				} disabled={disabled} dir="ltr" className="text-left" />
																		)}
																	/>
																	<FormHelperText>
																		{t("userDialog.manualKeyHelper")}
																	</FormHelperText>
																	<FormErrorMessage>
																		{
																			form.formState.errors.credential_key
																				?.message
																		}
																	</FormErrorMessage>
																</FormControl>
															)}
														</>
													)}
												</div>

												<div className={cn("col-span-1 w-full min-w-0!", showServiceSelector ? "md:col-span-2" : "md:col-span-1")}>
													<div className="w-full min-w-0! mb-[10px] xray-dialog-section rb-dialog-collapsible-section">
														{/* biome-ignore lint/a11y/noStaticElementInteractions: collapsible header, unchanged from HEAD, where the Chakra box had no keyboard handler */}
														{/* biome-ignore lint/a11y/useKeyWithClickEvents: collapsible header, unchanged from HEAD, where the Chakra box had no keyboard handler */}
														<div onClick={() => setAutoRenewOpen((prev) => !prev)} dir={isRTL ? "rtl" : "ltr"} className="flex [align:center] [justify:space-between] cursor-pointer gap-3 rb-dialog-collapsible-trigger">
															<div className="flex flex-row gap-2 items-center flex-1 justify-start">
																<p className={cn("font-semibold w-full", isRTL ? "text-right" : "text-left", "rb-dialog-collapsible-title")}>
																	{autoRenewTitle}
																</p>
																{autoRenewRules.length > 0 && (
																	<Badge colorScheme="gray" className="rounded-full">
																		{autoRenewRules.length}
																	</Badge>
																)}
															</div>
															<SectionChevronIcon className={cn("[transition:transform_0.2s_ease]", autoRenewOpen ? "[transform:rotate(-180deg)]" : "[transform:rotate(0deg)]")} />
														</div>
														<Collapse in={autoRenewOpen} animateOpacity>
															<div className="flex flex-col items-stretch gap-4 w-full min-w-0! rb-dialog-collapsible-body">
																<p className={cn("text-[0.875rem] text-gray-500 dark:text-gray-400", isRTL ? "text-right" : "text-left")}>
																	{t("userDialog.autoRenewDescription")}
																</p>

																{autoRenewRules.length === 0 ? (
																	<div className="flex flex-col gap-3 items-stretch">
																		<p className="text-center text-gray-400 text-[0.875rem]">
																			{t("autoRenew.empty")}
																		</p>
																		<Button size="md" variant="outline" onClick={startAddAutoRenew} disabled={disabled} className="w-full">
																			{t("add")}
																		</Button>
																	</div>
																) : (
																	<>
																		<div className="flex flex-col gap-3 items-stretch w-full">
																			{autoRenewRules.map((rule, idx) => {
																				const dayText = deriveDaysFromSeconds(
																					rule.expire,
																				);
																				return (
																					<div key={rule.id} className="border rounded-md p-3 bg-blackAlpha-50 dark:bg-whiteAlpha-50 w-full min-w-0!">
																						<div className="flex [align:flex-start] md:[align:center] [justify:space-between] gap-3 flex-col md:flex-row">
																							<div dir={isRTL ? "rtl" : "ltr"} className="flex flex-row gap-2 items-center">
																								<Badge colorScheme="primary" className="rounded-full">
																									{idx + 1}
																								</Badge>
																								<p className="font-semibold">
																									{rule.dataLimit !== null &&
																									typeof rule.dataLimit !==
																										"undefined"
																										? `${rule.dataLimit} ${DATA_UNIT}`
																										: t(
																												"userDialog.autoRenewUnlimited",
																											)}
																								</p>
																								<p className="text-gray-500 text-[0.875rem]">
																									{dayText !== null
																										? `${dayText} ${DAYS_UNIT}`
																										: t(
																												"userDialog.autoRenewUnlimited",
																											)}
																								</p>
																							</div>
																							<div className="flex flex-row items-center gap-2 justify-end">
																								<IconButton size="sm" aria-label={t("edit")} variant="ghost" onClick={() =>
																										startEditAutoRenew(idx)
																									} disabled={disabled}>
																									<PencilIcon className="w-[16px]" />
																								</IconButton>
																								<IconButton size="sm" aria-label={t("delete")} variant="ghost" onClick={() =>
																										handleDeleteAutoRenewRule(
																											idx,
																										)
																									} disabled={disabled}>
																									<DeleteIcon />
																								</IconButton>
																							</div>
																						</div>
																						{idx > 0 && (
																							<p className="text-[0.75rem] text-gray-500 mt-2">
																								{t("autoRenew.queuedNote")}
																							</p>
																						)}
																					</div>
																				);
																			})}
																		</div>
																		<Button size="md" variant="outline" onClick={startAddAutoRenew} disabled={disabled}>
																			{t("add")}
																		</Button>
																	</>
																)}

																{autoRenewFormMode && (
																	<div className="flex flex-col items-stretch gap-3 border rounded-md p-3 bg-blackAlpha-50 dark:bg-whiteAlpha-50 min-w-0!">
																		<div className="flex gap-2 justify-between items-center w-full flex-row">
																			<p className="font-semibold">
																				{t("autoRenew.new")}
																			</p>
																		</div>

																		<div dir={isRTL ? "rtl" : "ltr"} className="grid grid-cols-[1fr] md:grid-cols-[minmax(0,_1fr)_220px] gap-3 w-full min-w-0! items-end">
																			<FormControl className="min-w-0!">
																				<FormLabel className={cn("text-[0.875rem] w-full", isRTL ? "text-right" : "text-left")}>
																					{t("userDialog.autoRenewDataLimit")}
																				</FormLabel>
																				{renderUnitInput({
																					unit: DATA_UNIT,
																					value: autoRenewDataValue,
																					disabled,
																					onChange: (event) => {
																						const rawValue = event.target.value;
																						if (!rawValue) {
																							setAutoRenewDataValue("");
																							return;
																						}
																						if (
																							!/^[0-9]*\.?[0-9]*$/.test(
																								rawValue,
																							)
																						) {
																							return;
																						}
																						setAutoRenewDataValue(rawValue);
																					},
																				})}
																			</FormControl>

																			<Button size="sm" variant={
																					autoRenewAddRemainingValue
																						? "solid"
																						: "outline"
																				} colorScheme={
																					autoRenewAddRemainingValue
																						? "primary"
																						: "gray"
																				} onClick={() =>
																					setAutoRenewAddRemainingValue(
																						(prev) => !prev,
																					)
																				} disabled={disabled} className="w-full md:w-auto max-w-[220px] whitespace-nowrap shrink-0">
																				{autoRenewAddRemainingValue
																					? t(
																							"userDialog.nextPlanAddRemainingTraffic",
																						)
																					: t("userDialog.autoRenewResetUsage")}
																			</Button>

																			<FormControl className="min-w-0!">
																				<FormLabel className={cn("text-[0.875rem] w-full", isRTL ? "text-right" : "text-left")}>
																					{t("userDialog.autoRenewTimeLimit")}
																				</FormLabel>
																				{renderUnitInput({
																					unit: DAYS_UNIT,
																					value: autoRenewExpireDaysValue,
																					disabled,
																					onChange: (event) => {
																						const rawValue = event.target.value;
																						if (!rawValue) {
																							setAutoRenewExpireDaysValue("");
																							return;
																						}
																						if (
																							!/^[0-9]*\.?[0-9]*$/.test(
																								rawValue,
																							)
																						) {
																							return;
																						}
																						setAutoRenewExpireDaysValue(
																							rawValue,
																						);
																					},
																				})}
																			</FormControl>

																			<Button size="sm" variant={
																					autoRenewFireOnEitherValue
																						? "solid"
																						: "outline"
																				} colorScheme={
																					autoRenewFireOnEitherValue
																						? "primary"
																						: "gray"
																				} onClick={() =>
																					setAutoRenewFireOnEitherValue(
																						(prev) => !prev,
																					)
																				} disabled={disabled} className="w-full md:w-auto max-w-[220px] whitespace-nowrap shrink-0">
																				{t("userDialog.nextPlanFireOnEither")}
																			</Button>
																		</div>

																		<div className={cn("flex flex-row items-center gap-3 w-full flex-wrap", isRTL ? "justify-start" : "justify-end", isRTL ? "flex-row-reverse" : "flex-row")}>
																			<Button size="sm" variant="outline" onClick={handleCancelAutoRenewForm} disabled={disabled}>
																				{t("cancel")}
																			</Button>

																			<Button size="sm" colorScheme="primary" onClick={handleSaveAutoRenewRule} disabled={disabled}>
																				{autoRenewFormMode === "edit"
																					? t("save")
																					: t("add")}
																			</Button>
																		</div>
																	</div>
																)}
															</div>
														</Collapse>
													</div>
												</div>

												<div className="col-span-1 md:col-span-2 w-full min-w-0!">
													<div className="w-full min-w-0! mb-[10px] xray-dialog-section rb-dialog-collapsible-section">
														{/* biome-ignore lint/a11y/noStaticElementInteractions: collapsible header, unchanged from HEAD, where the Chakra box had no keyboard handler */}
														{/* biome-ignore lint/a11y/useKeyWithClickEvents: collapsible header, unchanged from HEAD, where the Chakra box had no keyboard handler */}
														<div onClick={() => setOtherInfoOpen((prev) => !prev)} className="flex [align:center] [justify:space-between] cursor-pointer gap-3 rb-dialog-collapsible-trigger">
															<p className="font-semibold text-start flex-1 rb-dialog-collapsible-title">
																{t("otherInfo.title")}
															</p>
															<SectionChevronIcon className={cn("[transition:transform_0.2s_ease]", otherInfoOpen ? "[transform:rotate(-180deg)]" : "[transform:rotate(0deg)]")} />
														</div>
														<Collapse in={otherInfoOpen} animateOpacity>
															<div className="flex flex-col items-stretch gap-3 w-full min-w-0! rb-dialog-collapsible-body">
																<FormControl isInvalid={!!form.formState.errors.note} className="w-full">
																	<FormLabel className={cn("w-full", isRTL ? "text-right" : "text-left")}>
																		{t("fields.note")}
																	</FormLabel>
																	<Textarea {...form.register("note")} className={cn(isRTL ? "text-right" : "text-left")} />
																	<FormErrorMessage>
																		{form.formState.errors?.note?.message}
																	</FormErrorMessage>
																</FormControl>
																<FormControl isInvalid={
																		!!form.formState.errors.telegram_id
																	} className="w-full">
																	<FormLabel className={cn("w-full", isRTL ? "text-right" : "text-left")}>
																		{t("fields.telegramId")}
																	</FormLabel>
																	<ChakraInput {...form.register("telegram_id")} className={cn("w-full min-w-0!", isRTL ? "text-right" : "text-left")} />
																	<FormErrorMessage>
																		{
																			form.formState.errors?.telegram_id
																				?.message
																		}
																	</FormErrorMessage>
																</FormControl>
																<FormControl isInvalid={
																		!!form.formState.errors.contact_number
																	} className="w-full">
																	<FormLabel className={cn("w-full", isRTL ? "text-right" : "text-left")}>
																		{t("fields.contactNumber")}
																	</FormLabel>
																	<ChakraInput {...form.register("contact_number")} className={cn("w-full min-w-0!", isRTL ? "text-right" : "text-left")} />
																	<FormErrorMessage>
																		{
																			form.formState.errors?.contact_number
																				?.message
																		}
																	</FormErrorMessage>
																</FormControl>
															</div>
														</Collapse>
													</div>
												</div>
											</div>

											{error && (
												<Alert status="error" className="mt-3 flex md:hidden">
													<AlertIcon />

													{error}
												</Alert>
											)}
										</TabPanel>
										{isEditing && canViewTraffic && (
											<TabPanel className="px-0 pt-4">
												<div className="flex flex-col items-center gap-4">
													<UsageFilter
														defaultValue={usageFilter}
														onChange={(filter, query) => {
															setUsageFilter(filter);

															fetchUsageWithFilter(query);
														}}
													/>

													<div className="w-full md:w-[70%] justify-self-center">
														<ReactApexChart
															options={usage.options}
															series={usage.series}
															type="donut"
														/>
													</div>
												</div>
											</TabPanel>
										)}
										{isEditing && (
											<TabPanel className="px-0 pt-4">
												<div className="flex flex-col items-stretch gap-4">
													<div className="border rounded-md px-4 py-3 bg-white dark:bg-gray-900 dark:border-gray-700!">
														<div className="flex flex-row items-center gap-2 min-w-0! mb-3">
															<SubscriptionActionIcon />
															<p className="font-semibold">
																{t("userDialog.links.subscription")}
															</p>
														</div>
														<div className="flex flex-col gap-2 items-stretch">
															{subscriptionLinks.length === 0 ? (
																<p className="text-[0.875rem] text-gray-500">
																	{t("userDialog.links.noSubscription")}
																</p>
															) : (
																subscriptionLinks.map((item) => (
																	<div key={item.key} className="border rounded-md px-3 py-2 bg-blackAlpha-50 dark:bg-whiteAlpha-50">
																		<div className="flex flex-row gap-2 justify-between items-center w-full">
																			<div className="flex flex-row items-center gap-2 min-w-0!">
																				<p className="font-medium">
																					{item.label}
																				</p>
																				{item.key === "key" && (
																					<Badge colorScheme="primary" className="rounded-full text-[0.75rem]">
																						{t("userDialog.links.recommended")}
																					</Badge>
																				)}
																			</div>
																			<div className="flex flex-row items-center gap-1 shrink-0">
																				<Tooltip label={
																						copiedSubscriptionKey === item.key
																							? t("copied")
																							: t("copy")
																					} placement="top">
																					<IconButton aria-label={t(
																							"a11y.copySubscriptionLink",
																						)} variant="ghost" size="sm" type="button" onClick={() => {
																							void copyTextToClipboard(
																								item.url,
																							).then(() =>
																								setCopiedSubscriptionKey(
																									item.key,
																								),
																							);
																						}}>
																						{copiedSubscriptionKey ===
																						item.key ? (
																							<CopiedActionIcon />
																						) : (
																							<CopyActionIcon />
																						)}
																					</IconButton>
																				</Tooltip>
																				<Tooltip label={t("userDialog.links.qr")} placement="top">
																					<IconButton aria-label={t(
																							"a11y.subscriptionQr",
																						)} variant="ghost" size="sm" type="button" onClick={() => {
																							setQRCode(
																								[],
																								editingUser.username,
																							);
																							setSubLink(item.url);
																						}}>
																						<QRActionIcon />
																					</IconButton>
																				</Tooltip>
																			</div>
																		</div>
																	</div>
																))
															)}
														</div>
													</div>

													<div className="border rounded-md px-4 py-3 bg-white dark:bg-gray-900 dark:border-gray-700!">
														<div className="flex flex-row gap-2 justify-between items-center w-full mb-3">
															<p className="font-semibold">
																{t("userDialog.links.configs")}
															</p>
															<Button size="sm" variant="outline" type="button" disabled={configItems.length === 0} onClick={() => {
																	if (configItems.length === 0) return;
																	void copyTextToClipboard(
																		configLinksText,
																	).then(() => setCopiedAllConfigs(true));
																}}>{copiedAllConfigs ? (
																		<CopiedActionIcon />
																	) : (
																		<CopyActionIcon />
																	)}
																{copiedAllConfigs
																	? t("copied")
																	: t("userDialog.links.copyAllConfigs")}
															</Button>
														</div>

														<div className="flex flex-col gap-2 items-stretch">
															{configItems.length === 0 ? (
																<p className="text-[0.875rem] text-gray-500">
																	{t("userDialog.links.noConfigs")}
																</p>
															) : (
																configItems.map((item, index) => (
																	<div key={`${item.link}-${index}`} className="border rounded-md px-3 py-2 bg-blackAlpha-50 dark:bg-whiteAlpha-50">
																		<div dir="ltr" className="flex flex-row gap-2 justify-between items-center w-full">
																			<p dir="ltr" className="font-medium truncate min-w-0! flex-1 text-left [unicode-bidi:isolate]">
																				{item.label}
																			</p>
																			<div className="flex flex-row items-center gap-1 shrink-0">
																				<Tooltip label={
																						copiedConfigIndex === index
																							? t("copied")
																							: t("copy")
																					} placement="top">
																					<IconButton aria-label={t("a11y.copyConfig")} variant="ghost" size="sm" type="button" onClick={() => {
																							void copyTextToClipboard(
																								item.link,
																							).then(() =>
																								setCopiedConfigIndex(index),
																							);
																						}}>
																						{copiedConfigIndex === index ? (
																							<CopiedActionIcon />
																						) : (
																							<CopyActionIcon />
																						)}
																					</IconButton>
																				</Tooltip>
																				<Tooltip label={t("userDialog.links.qr")} placement="top">
																					<IconButton aria-label={t("a11y.configQr")} variant="ghost" size="sm" type="button" onClick={() => {
																							setQRCode(
																								[item.link],
																								editingUser.username,
																							);
																							setSubLink(null);
																						}}>
																						<QRActionIcon />
																					</IconButton>
																				</Tooltip>
																			</div>
																		</div>
																	</div>
																))
															)}
														</div>
													</div>
												</div>
											</TabPanel>
										)}
									</TabPanels>
								</Tabs>
							</XrayModalBody>

							<XrayModalFooter className={cn(footerBg, footerBorderColor, "sticky md:static bottom-0 z-[sticky] shrink-0 border-t px-3 sm:px-4 md:px-5 pt-2.5 md:pt-3 pb-[var(--rb-dialog-safe-bottom)] md:pb-3 shadow-[0_-14px_28px_rgba(0,_0,_0,_0.28)] md:shadow-none")}>
								<div className="flex items-center justify-between w-full gap-3 flex-col sm:flex-row">
									<div className="flex flex-row items-center justify-start w-full sm:w-[unset] gap-2 flex-wrap">
										{isEditing && (
											<>
												{canDeleteUsersVisible && (
													<DeleteConfirmDialog
														description={t("deleteUser.prompt", {
															username: editingUser?.username ?? "",
														})}
														loading={deleteLoading}
														onConfirm={handleDeleteUser}
													>
														<Tooltip label={t("delete")} placement="top">
															<IconButton variant="solid" aria-label={t("delete")} size="md" className="sm:size-8">
																<DeleteIcon />
															</IconButton>
														</Tooltip>
													</DeleteConfirmDialog>
												)}

												{canResetUsageVisible && (
													<Button variant="solid" onClick={handleResetUsage} size="md" className="flex-[1_1_auto] sm:flex-[0_0_auto] sm:h-8 sm:px-3 sm:text-sm">
														{t("userDialog.resetUsage")}
													</Button>
												)}

												{canRevokeSubscriptionVisible && (
													<Button variant="solid" onClick={handleRevokeSubscription} size="md" className="flex-[1_1_auto] sm:flex-[0_0_auto] sm:h-8 sm:px-3 sm:text-sm">
														{t("userDialog.revokeSubscription")}
													</Button>
												)}
											</>
										)}
									</div>

									<div className="w-full md:max-w-[260px] max-w-full shrink-0">
										<AnimatedSubmitButton
											status={submitStatus}
											idleContent={
												isEditing ? t("userDialog.editUser") : t("createUser")
											}
											successLabel={t("userDialog.submitSuccess")}
											disabled={submitDisabled}
											type="submit"
										/>
									</div>
								</div>
							</XrayModalFooter>
						</form>
					</div>

					{limitReached && (
						<div className="flex-col flex absolute inset-0 [align:center] [justify:center] gap-4 bg-blackAlpha-600 text-white text-center p-6 pointer-events-none">
							<Icon color="primary">
								<LimitLockIcon />
							</Icon>

							<p className="text-[1.25rem] font-semibold">
								{t("userDialog.limitReachedTitle")}
							</p>

							<p className="text-[1rem] max-w-[24rem]">
								{usersLimit && usersLimit > 0
									? t("userDialog.limitReachedBody", {
											limit: usersLimit,

											active: activeUsersCount ?? usersLimit,
										})
									: t("userDialog.limitReachedContent")}
							</p>
						</div>
					)}
				</XrayModalContent>
			</FormProvider>
		</Modal>
	);
};

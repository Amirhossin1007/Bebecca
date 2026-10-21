import { useToast } from "components/shadcn/toast";
import { FormControl, FormErrorMessage, FormHelperText, FormLabel } from "components/shadcn/field";
import { Input, InputGroup, InputRightElement } from "components/shadcn/input";
import { Button, IconButton } from "components/shadcn/button";
import { Checkbox, Radio, RadioGroup } from "components/shadcn/selection";
import { Badge } from "components/shadcn/badge";
import { Modal, ModalCloseButton, ModalOverlay } from "components/shadcn/dialog";
import { Tab, TabList, TabPanel, TabPanels, Tabs } from "components/shadcn/tabs";
import { cn } from "lib/cn";
import {
	EyeIcon,
	EyeSlashIcon,
	SparklesIcon,
} from "@heroicons/react/24/outline";
import { zodResolver } from "@hookform/resolvers/zod";
import { getDefaultPermissionsForRole } from "constants/adminPermissions";
import { useAdminsStore } from "contexts/AdminsContext";
import dayjs from "dayjs";
import useGetUser from "hooks/useGetUser";
import {
	type FC,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EntityNotePanel } from "components/EntityNotePanel";
import { fetch } from "service/http";
import type {
	AdminCreatePayload,
	AdminPermissions,
	AdminUpdatePayload,
} from "types/Admin";
import { AdminRole, AdminStatus, AdminTrafficLimitMode } from "types/Admin";
import type { ServiceSummary } from "types/Service";
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";
import { DEFAULT_SEARCH_MATCH_OPTIONS, matchesSearch } from "utils/searchMatch";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import { z } from "zod";
import AdminPermissionsEditor from "./AdminPermissionsEditor";
import AdminPermissionsModal from "./AdminPermissionsModal";
import {
	AnimatedSubmitButton,
	type AnimatedSubmitStatus,
} from "./common/AnimatedSubmitButton";
import { NumericInput } from "./common/NumericInput";
import { SearchInput } from "./common/SearchInput";
import { DateTimePicker } from "./DateTimePicker";
import {
	XrayModalBody,
	XrayModalContent,
	XrayModalFooter,
	XrayModalHeader,
} from "./xray/XrayDialog";

const GB_IN_BYTES = 1024 * 1024 * 1024;
const MB_IN_BYTES = 1024 * 1024;

const clonePermissions = (role: AdminRole): AdminPermissions =>
	getDefaultPermissionsForRole(role);

const formatBytesToGbString = (value?: number | null) =>
	value && value > 0 ? String(Math.floor(value / GB_IN_BYTES)) : "";

const adminPermissionsSchema: z.ZodType<AdminPermissions> = z.object({
	users: z.object({
		create: z.boolean(),
		delete: z.boolean(),
		reset_usage: z.boolean(),
		periodic_usage_reset: z.boolean(),
		revoke: z.boolean(),
		create_on_hold: z.boolean(),
		allow_unlimited_data: z.boolean(),
		allow_unlimited_expire: z.boolean(),
		allow_next_plan: z.boolean(),
		advanced_actions: z.boolean(),
		set_flow: z.boolean(),
		allow_custom_key: z.boolean(),
		max_data_limit_per_user: z.number().nullable(),
		manage_speed_limit: z.boolean(),
		manage_ip_limit: z.boolean(),
		max_speed_limit_per_user: z.number().nullable(),
		max_ip_limit_per_user: z.number().nullable(),
	}),
	admin_management: z.object({
		can_view: z.boolean(),
		can_edit: z.boolean(),
		can_manage_sudo: z.boolean(),
		manage_sessions: z.boolean(),
		manage_2fa: z.boolean(),
	}),
	self_permissions: z.object({
		self_myaccount: z.boolean(),
		self_change_password: z.boolean(),
		self_api_keys: z.boolean(),
		self_sessions: z.boolean(),
		self_2fa: z.boolean(),
		self_placeholders: z.boolean(),
	}),
	sections: z.object({
		usage: z.boolean(),
		admins: z.boolean(),
		services: z.boolean(),
		hosts: z.boolean(),
		nodes: z.boolean(),
		integrations: z.boolean(),
		xray: z.boolean(),
	}),
	sudo: z.object({
		nodes: z.boolean(),
		xray: z.boolean(),
		settings: z.boolean(),
		subscriptions: z.boolean(),
		backups: z.boolean(),
		maintenance: z.boolean(),
		phpmyadmin: z.boolean(),
		notes: z.boolean(),
	}),
});

type AdminFormValues = {
	username: string;
	password?: string;
	telegram_id?: string;
	role: AdminRole;
	require_2fa: boolean;
	traffic_limit_mode: AdminTrafficLimitMode;
	use_service_traffic_limits: boolean;
	show_user_traffic: boolean;
	delete_user_usage_limit_enabled: boolean;
	delete_user_usage_limit?: string;
	permissions: AdminPermissions;
	maxDataLimitPerUserGb?: string;
	maxSpeedLimitPerUserMbps?: string;
	maxIPLimitPerUser?: string;
	data_limit?: string;
	users_limit?: string;
	services?: number[];
	service_limits?: Record<
		number,
		{
			traffic_limit_mode: AdminTrafficLimitMode;
			data_limit?: string;
			show_user_traffic: boolean;
			users_limit?: string;
			created_traffic?: number;
			used_traffic?: number;
			lifetime_used_traffic?: number;
			deleted_users_usage?: number;
			delete_user_usage_limit_enabled: boolean;
			delete_user_usage_limit?: string;
		}
	>;
};

export const AdminDialog: FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.language === "fa";

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
	const { userData } = useGetUser();
	const canCreateFullAccess = userData.role === AdminRole.FullAccess;
	const canManage2FA =
		canCreateFullAccess ||
		Boolean(userData.permissions.admin_management.manage_2fa);
	const toast = useToast();
	const admins = useAdminsStore((state) => state.admins);
	const adminFromStore = useAdminsStore((state) => state.adminInDialog);
	const isOpen = useAdminsStore((state) => state.isAdminDialogOpen);
	const closeAdminDialog = useAdminsStore((state) => state.closeAdminDialog);
	const createAdmin = useAdminsStore((state) => state.createAdmin);
	const fetchAdmins = useAdminsStore((state) => state.fetchAdmins);
	const updateAdmin = useAdminsStore((state) => state.updateAdmin);
	const admin = useMemo(() => {
		if (!adminFromStore) {
			return null;
		}
		return (
			admins.find((item) => item.username === adminFromStore.username) ??
			adminFromStore
		);
	}, [adminFromStore, admins]);

	const mode = useMemo(() => (admin ? "edit" : "create"), [admin]);
	const statusLabels = useMemo(
		() => ({
			[AdminStatus.Active]: t("status.active"),
			[AdminStatus.Disabled]: t("nodes.disabled"),
			[AdminStatus.Deleted]: t("admins.statusDeleted"),
		}),
		[t],
	);
	const statusLabel = admin
		? (statusLabels[admin.status] ?? admin.status)
		: t("admins.statusNew");

	const schema = useMemo(() => {
		const base = z
			.object({
				username:
					mode === "create"
						? z
								.string()
								.trim()
								.min(3, { message: t("admins.validation.usernameMin") })
						: z.string().optional(),
				password: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value))
					.refine(
						(value) => !value || value.length >= 6,
						t("admins.validation.passwordMin"),
					),
				telegram_id: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value))
					.refine(
						(value) => value === undefined || /^\d+$/.test(value),
						t("admins.validation.telegramNumeric"),
					),
				role: z.nativeEnum(AdminRole).optional(),
				require_2fa: z.boolean().default(false),
				traffic_limit_mode: z
					.nativeEnum(AdminTrafficLimitMode)
					.default(AdminTrafficLimitMode.UsedTraffic),
				use_service_traffic_limits: z.boolean().default(false),
				show_user_traffic: z.boolean().default(true),
				delete_user_usage_limit_enabled: z.boolean().default(false),
				delete_user_usage_limit: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value))
					.refine(
						(value) => value === undefined || /^\d+$/.test(value),
						t("admins.validation.deleteLimitNumeric"),
					),
				data_limit: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value))
					.refine(
						(value) => value === undefined || /^\d+$/.test(value),
						t("admins.validation.dataLimitNumeric"),
					),
				users_limit: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value))
					.refine(
						(value) => value === undefined || /^\d+$/.test(value),
						t("admins.validation.usersLimitNumeric"),
					),
				maxSpeedLimitPerUserMbps: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value)),
				maxIPLimitPerUser: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value)),
				maxDataLimitPerUserGb: z
					.string()
					.trim()
					.optional()
					.transform((value) => (value === "" ? undefined : value)),
				permissions: adminPermissionsSchema,
				services: z.array(z.number()).optional(),
				service_limits: z.record(z.any()).optional(),
			})
			.superRefine((values, ctx) => {
				if (mode === "create" && !values.password) {
					ctx.addIssue({
						code: z.ZodIssueCode.custom,
						path: ["password"],
						message: t("admins.validation.passwordRequired"),
					});
				}
			});
		return base as z.ZodType<AdminFormValues>;
	}, [mode, t]);

	const form = useForm<AdminFormValues>({
		resolver: zodResolver(schema),
		defaultValues: {
			username: "",
			password: "",
			telegram_id: "",
			role: AdminRole.Standard,
			require_2fa: false,
			traffic_limit_mode: AdminTrafficLimitMode.UsedTraffic,
			use_service_traffic_limits: false,
			show_user_traffic: true,
			delete_user_usage_limit_enabled: false,
			delete_user_usage_limit: "",
			permissions: clonePermissions(AdminRole.Standard),
			maxDataLimitPerUserGb: "",
			maxSpeedLimitPerUserMbps: "",
			maxIPLimitPerUser: "",
			data_limit: "",
			users_limit: "",
			services: [],
			service_limits: {},
		},
	});

	const {
		register,
		handleSubmit,
		reset,
		formState,
		setValue,
		getValues,
		watch,
		setError,
	} = form;
	const [showPassword, setShowPassword] = useState(false);
	const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
	const [serviceOptions, setServiceOptions] = useState<ServiceSummary[]>([]);
	const [adminExpireDate, setAdminExpireDate] = useState<Date | null>(null);
	const [submitStatus, setSubmitStatus] =
		useState<AnimatedSubmitStatus>("idle");
	const submitResetTimerRef = useRef<number | null>(null);
	const successCloseTimerRef = useRef<number | null>(null);
	const adminExpireUnix = useMemo(
		() => (adminExpireDate ? dayjs(adminExpireDate).utc().unix() : null),
		[adminExpireDate],
	);
	const adminExpireInfo = useMemo(
		() => relativeExpiryDate(adminExpireUnix ?? null),
		[adminExpireUnix],
	);
	const [serviceSearch, setServiceSearch] = useState("");
	const [serviceSearchMatch, setServiceSearchMatch] = useState(
		DEFAULT_SEARCH_MATCH_OPTIONS,
	);
	const filteredServices = useMemo(() => {
		if (!serviceSearch.trim()) {
			return serviceOptions;
		}
		return serviceOptions.filter((service) =>
			matchesSearch(service.name, serviceSearch, serviceSearchMatch),
		);
	}, [serviceOptions, serviceSearch, serviceSearchMatch]);
	const selectedServices = watch("services") || [];
	const selectedServicesSet = useMemo(
		() => new Set(selectedServices),
		[selectedServices],
	);

	const generateRandomString = useCallback((length: number) => {
		const characters =
			"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
		const charactersLength = characters.length;

		if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
			const randomValues = new Uint32Array(length);
			window.crypto.getRandomValues(randomValues);
			return Array.from(
				randomValues,
				(value) => characters[value % charactersLength],
			).join("");
		}

		return Array.from({ length }, () => {
			const index = Math.floor(Math.random() * charactersLength);
			return characters[index];
		}).join("");
	}, []);

	const handleGenerateUsername = useCallback(() => {
		if (mode === "edit") return;
		const randomUsername = generateRandomString(8);
		setValue("username", randomUsername, {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [generateRandomString, mode, setValue]);

	const handleServiceToggle = (serviceId: number) => {
		const next = selectedServicesSet.has(serviceId)
			? selectedServices.filter((id) => id !== serviceId)
			: [...selectedServices, serviceId];
		setValue("services", next, { shouldDirty: true, shouldValidate: true });
	};

	const handleToggleAllServices = () => {
		const hasAllSelected =
			selectedServices.length === serviceOptions.length &&
			serviceOptions.length > 0;
		const next = hasAllSelected
			? []
			: serviceOptions.map((service) => service.id);
		setValue("services", next, { shouldDirty: true, shouldValidate: true });
	};

	const handleGeneratePassword = useCallback(() => {
		const randomPassword = generateRandomString(12);
		setValue("password", randomPassword, {
			shouldDirty: true,
			shouldValidate: true,
		});
	}, [generateRandomString, setValue]);

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

	const handleCloseAdminDialog = useCallback(() => {
		clearSubmitTimers();
		setSubmitStatus("idle");
		closeAdminDialog();
	}, [clearSubmitTimers, closeAdminDialog]);

	const { errors, isSubmitting } = formState;
	const watchRole = watch("role");
	const watchTrafficLimitMode = watch("traffic_limit_mode");
	const watchUseServiceTrafficLimits = watch("use_service_traffic_limits");
	const permissionsValue = watch("permissions");
	const showUserTrafficValue = watch("show_user_traffic");
	const deleteUserUsageLimitEnabled = watch("delete_user_usage_limit_enabled");
	const serviceLimitsValue = watch("service_limits") ?? {};
	const telegramIdValue = watch("telegram_id") ?? "";
	const deleteUserUsageLimitValue = watch("delete_user_usage_limit") ?? "";
	const dataLimitValue = watch("data_limit") ?? "";
	const parsedGlobalDataLimit = Number(dataLimitValue);
	const hasGlobalDataLimit =
		String(dataLimitValue).trim().length > 0 &&
		Number.isFinite(parsedGlobalDataLimit) &&
		parsedGlobalDataLimit > 0;
	const usersLimitValue = watch("users_limit") ?? "";
	const maxDataLimitValue = watch("maxDataLimitPerUserGb") ?? "";
	const maxSpeedLimitValue = watch("maxSpeedLimitPerUserMbps") ?? "";
	const maxIPLimitValue = watch("maxIPLimitPerUser") ?? "";
	const isFullAccessRole = watchRole === AdminRole.FullAccess;
	const isCreatedTrafficMode =
		watchTrafficLimitMode === AdminTrafficLimitMode.CreatedTraffic;
	const usePerServiceTrafficLimits = Boolean(watchUseServiceTrafficLimits);

	const getServiceLimitValue = useCallback(
		(serviceId: number) =>
			serviceLimitsValue[serviceId] ?? {
				traffic_limit_mode: AdminTrafficLimitMode.UsedTraffic,
				data_limit: "",
				show_user_traffic: true,
				users_limit: "",
				created_traffic: 0,
				used_traffic: 0,
				lifetime_used_traffic: 0,
				deleted_users_usage: 0,
				delete_user_usage_limit_enabled: false,
				delete_user_usage_limit: "",
			},
		[serviceLimitsValue],
	);

	const setServiceLimitValue = useCallback(
		(
			serviceId: number,
			patch: Partial<ReturnType<typeof getServiceLimitValue>>,
		) => {
			const current = getValues("service_limits") ?? {};
			setValue(
				"service_limits",
				{
					...current,
					[serviceId]: {
						...getServiceLimitValue(serviceId),
						...patch,
					},
				},
				{ shouldDirty: true },
			);
		},
		[getServiceLimitValue, getValues, setValue],
	);

	const resetPermissionsToRole = useCallback(() => {
		const role = watchRole ?? AdminRole.Standard;
		setValue("permissions", clonePermissions(role), { shouldDirty: true });
		setValue("maxDataLimitPerUserGb", "", { shouldDirty: true });
		setValue("maxSpeedLimitPerUserMbps", "", { shouldDirty: true });
		setValue("maxIPLimitPerUser", "", { shouldDirty: true });
	}, [setValue, watchRole]);

	const handlePermissionsChange = useCallback(
		(next: AdminPermissions) => {
			setValue("permissions", next, { shouldDirty: true });
		},
		[setValue],
	);

	const handleUserPermissionToggle = useCallback(
		(key: "delete" | "reset_usage", next: boolean) => {
			setValue(
				"permissions",
				{
					...permissionsValue,
					users: {
						...permissionsValue.users,
						[key]: next,
					},
				},
				{ shouldDirty: true },
			);
		},
		[permissionsValue, setValue],
	);

	const handleMaxSpeedLimitChange = useCallback(
		(value: string) => {
			setValue("maxSpeedLimitPerUserMbps", value, { shouldDirty: true });
		},
		[setValue],
	);

	const handleMaxIPLimitChange = useCallback(
		(value: string) => {
			setValue("maxIPLimitPerUser", value, { shouldDirty: true });
		},
		[setValue],
	);

	const handleMaxDataLimitChange = useCallback(
		(value: string) => {
			setValue("maxDataLimitPerUserGb", value, { shouldDirty: true });
		},
		[setValue],
	);

	useEffect(() => {
		register("maxDataLimitPerUserGb");
		register("maxSpeedLimitPerUserMbps");
		register("maxIPLimitPerUser");
		register("permissions");
		register("services");
		register("service_limits");
	}, [register]);

	useEffect(() => {
		if (!isOpen) {
			setAdminExpireDate(null);
			return;
		}
		if (admin) {
			setAdminExpireDate(
				typeof admin.expire === "number" && admin.expire > 0
					? dayjs.unix(admin.expire).toDate()
					: null,
			);
			return;
		}
		setAdminExpireDate(null);
	}, [admin, isOpen]);

	useEffect(() => {
		if (isOpen) {
			setServiceSearch("");
			// Fetch services for selection
			fetch<{ services: ServiceSummary[]; total?: number }>("/v2/services", {
				query: { limit: 500 },
			})
				.then((resp) => {
					const services = Array.isArray((resp as any).services)
						? (resp as any).services
						: Array.isArray(resp)
							? (resp as any)
							: [];
					setServiceOptions(services);
				})
				.catch(() => setServiceOptions([]));

			const nextRole: AdminRole = admin?.role ?? AdminRole.Standard;
			const nextPermissions = admin
				? (JSON.parse(JSON.stringify(admin.permissions)) ??
					clonePermissions(nextRole))
				: clonePermissions(nextRole);
			reset({
				username: admin?.username ?? "",
				password: "",
				telegram_id:
					admin?.telegram_id !== undefined && admin?.telegram_id !== null
						? String(admin.telegram_id)
						: "",
				role: nextRole,
				require_2fa: admin?.require_2fa ?? false,
				traffic_limit_mode:
					admin?.traffic_limit_mode ?? AdminTrafficLimitMode.UsedTraffic,
				use_service_traffic_limits: admin?.use_service_traffic_limits ?? false,
				show_user_traffic: admin?.show_user_traffic ?? true,
				delete_user_usage_limit_enabled:
					admin?.delete_user_usage_limit_enabled ?? false,
				delete_user_usage_limit:
					admin?.delete_user_usage_limit !== undefined &&
					admin?.delete_user_usage_limit !== null
						? String(Math.floor(admin.delete_user_usage_limit / MB_IN_BYTES))
						: "",
				permissions: nextPermissions,
				maxSpeedLimitPerUserMbps: nextPermissions.users.max_speed_limit_per_user
					? String(nextPermissions.users.max_speed_limit_per_user / 1000)
					: "",
				maxIPLimitPerUser: nextPermissions.users.max_ip_limit_per_user
					? String(nextPermissions.users.max_ip_limit_per_user)
					: "",
				maxDataLimitPerUserGb: formatBytesToGbString(
					nextPermissions.users.max_data_limit_per_user,
				),
				data_limit:
					admin?.data_limit !== undefined && admin?.data_limit !== null
						? String(Math.floor(admin.data_limit / GB_IN_BYTES))
						: "",
				users_limit:
					admin?.users_limit !== undefined && admin?.users_limit !== null
						? String(admin.users_limit)
						: "",
				services: admin?.services ?? [],
				service_limits: Object.fromEntries(
					(admin?.service_limits ?? []).map((item) => [
						item.service_id,
						{
							traffic_limit_mode:
								item.traffic_limit_mode ?? AdminTrafficLimitMode.UsedTraffic,
							data_limit:
								item.data_limit !== undefined && item.data_limit !== null
									? String(Math.floor(item.data_limit / GB_IN_BYTES))
									: "",
							show_user_traffic: item.show_user_traffic ?? true,
							users_limit:
								item.users_limit !== undefined && item.users_limit !== null
									? String(item.users_limit)
									: "",
							created_traffic: Number(item.created_traffic ?? 0),
							used_traffic: Number(item.used_traffic ?? 0),
							lifetime_used_traffic: Number(item.lifetime_used_traffic ?? 0),
							deleted_users_usage: Number(item.deleted_users_usage ?? 0),
							delete_user_usage_limit_enabled:
								item.delete_user_usage_limit_enabled ?? false,
							delete_user_usage_limit:
								item.delete_user_usage_limit !== undefined &&
								item.delete_user_usage_limit !== null
									? String(
											Math.floor(item.delete_user_usage_limit / MB_IN_BYTES),
										)
									: "",
						},
					]),
				),
			});
		}
	}, [admin, isOpen, reset]);

	useEffect(() => {
		if (!isOpen) {
			setPermissionsModalOpen(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if (watchRole === AdminRole.FullAccess) {
			setValue("traffic_limit_mode", AdminTrafficLimitMode.UsedTraffic, {
				shouldDirty: true,
			});
			setValue("use_service_traffic_limits", false, { shouldDirty: true });
			setValue("show_user_traffic", true, { shouldDirty: true });
			setValue("delete_user_usage_limit_enabled", false, {
				shouldDirty: true,
			});
		}
	}, [setValue, watchRole]);

	useEffect(() => {
		if (!permissionsValue.users.delete) {
			setValue("delete_user_usage_limit_enabled", false, {
				shouldDirty: true,
			});
		}
	}, [permissionsValue.users.delete, setValue]);

	useEffect(() => {
		if (isOpen) {
			setSubmitStatus("idle");
			clearSubmitTimers();
		}
	}, [clearSubmitTimers, isOpen]);

	const handleFormSubmit = handleSubmit(
		async (values) => {
			if (submitStatus !== "idle") return;
			clearSubmitTimers();
			setSubmitStatus("loading");
			const selectedRole: AdminRole = values.role ?? AdminRole.Standard;
			let permissionPayload: AdminPermissions | undefined;
			if (selectedRole === AdminRole.Reseller) {
				toast({
					status: "warning",
					title: t("common.comingSoon"),
					description: t("admins.roles.resellerDescription"),
					isClosable: true,
				});
				showSubmitError();
				return;
			}

			const buildPermissionsPayload = (): AdminPermissions => {
				const computedPermissions: AdminPermissions = JSON.parse(
					JSON.stringify(values.permissions ?? clonePermissions(selectedRole)),
				);
				const maxLimitInput = values.maxDataLimitPerUserGb?.trim();
				if (computedPermissions.users.allow_unlimited_data) {
					computedPermissions.users.max_data_limit_per_user = null;
				} else if (maxLimitInput) {
					const parsed = Number(maxLimitInput);
					if (Number.isNaN(parsed) || parsed < 0) {
						setError("maxDataLimitPerUserGb", {
							type: "manual",
							message: t("admins.validation.invalidMaxDataLimit"),
						});
						showSubmitError();
						throw new Error("invalid_max_data_limit");
					}
					computedPermissions.users.max_data_limit_per_user =
						parsed === 0 ? null : Math.round(parsed * GB_IN_BYTES);
				} else {
					computedPermissions.users.max_data_limit_per_user = null;
				}
				const speedInput = values.maxSpeedLimitPerUserMbps?.trim();
				if (speedInput) {
					const parsedSpeed = Number(speedInput);
					if (Number.isNaN(parsedSpeed) || parsedSpeed < 0) {
						setError("maxSpeedLimitPerUserMbps", {
							type: "manual",
							message: t("admins.validation.invalidMaxSpeedLimit"),
						});
						showSubmitError();
						throw new Error("invalid_max_speed_limit");
					}
					computedPermissions.users.max_speed_limit_per_user =
						parsedSpeed === 0 ? null : Math.round(parsedSpeed * 1000);
				} else {
					computedPermissions.users.max_speed_limit_per_user = null;
				}
				const ipInput = values.maxIPLimitPerUser?.trim();
				if (ipInput) {
					const parsedIP = Number(ipInput);
					if (Number.isNaN(parsedIP) || parsedIP < 0) {
						setError("maxIPLimitPerUser", {
							type: "manual",
							message: t("admins.validation.invalidMaxIPLimit"),
						});
						showSubmitError();
						throw new Error("invalid_max_ip_limit");
					}
					computedPermissions.users.max_ip_limit_per_user =
						parsedIP === 0 ? null : Math.floor(parsedIP);
				} else {
					computedPermissions.users.max_ip_limit_per_user = null;
				}
				return computedPermissions;
			};

			if (mode === "create" || selectedRole !== AdminRole.FullAccess) {
				try {
					permissionPayload = buildPermissionsPayload();
				} catch (error) {
					if (
						[
							"invalid_max_data_limit",
							"invalid_max_speed_limit",
							"invalid_max_ip_limit",
						].includes((error as Error).message)
					) {
						return;
					}
					throw error;
				}
			}

			if (mode === "edit" && admin) {
				const currentActive = admin.active_users ?? 0;
				if (values.users_limit) {
					const requestedLimit = Number(values.users_limit);
					if (
						!Number.isNaN(requestedLimit) &&
						requestedLimit > 0 &&
						requestedLimit < currentActive
					) {
						setError("users_limit", {
							type: "manual",
							message: t("admins.validation.usersLimitTooLow", {
								active: currentActive,
							}),
						});
						showSubmitError();
						return;
					}
				}
			}
			try {
				const expireValue = adminExpireDate
					? dayjs(adminExpireDate).utc().unix()
					: null;
				const buildServiceLimitPayload = () =>
					(values.services ?? []).map((serviceId) => {
						const item = values.service_limits?.[serviceId];
						return {
							service_id: serviceId,
							traffic_limit_mode:
								item?.traffic_limit_mode ?? AdminTrafficLimitMode.UsedTraffic,
							data_limit: item?.data_limit
								? Number(item.data_limit) * GB_IN_BYTES
								: null,
							show_user_traffic: item?.show_user_traffic ?? true,
							users_limit: item?.users_limit ? Number(item.users_limit) : null,
							delete_user_usage_limit_enabled: Boolean(
								permissionsValue.users.delete &&
									item?.delete_user_usage_limit_enabled,
							),
							delete_user_usage_limit: item?.delete_user_usage_limit
								? Number(item.delete_user_usage_limit) * MB_IN_BYTES
								: null,
						};
					});
				const requestedServices = values.services ?? [];
				const serviceLimitPayload = values.use_service_traffic_limits
					? buildServiceLimitPayload()
					: undefined;
				const globalDataLimit = values.data_limit
					? Number(values.data_limit) * GB_IN_BYTES
					: null;
				const globalUsersLimit = values.users_limit
					? Number(values.users_limit)
					: null;
				const globalDeleteUserUsageLimit = values.delete_user_usage_limit
					? Number(values.delete_user_usage_limit) * MB_IN_BYTES
					: null;
				if (mode === "create") {
					const payload: AdminCreatePayload = {
						username: values.username.trim(),
						password: values.password ?? "",
						role: selectedRole,
						require_2fa: canManage2FA ? values.require_2fa : undefined,
						permissions: permissionPayload ?? clonePermissions(selectedRole),
						services: values.services || [],
						telegram_id: values.telegram_id
							? Number(values.telegram_id)
							: undefined,
						data_limit: values.use_service_traffic_limits
							? undefined
							: globalDataLimit,
						traffic_limit_mode:
							selectedRole === AdminRole.FullAccess ||
							values.use_service_traffic_limits
								? undefined
								: values.traffic_limit_mode,
						use_service_traffic_limits:
							selectedRole === AdminRole.FullAccess
								? undefined
								: values.use_service_traffic_limits,
						show_user_traffic:
							selectedRole === AdminRole.FullAccess
								? undefined
								: values.show_user_traffic,
						delete_user_usage_limit_enabled:
							selectedRole === AdminRole.FullAccess
								? undefined
								: Boolean(
										permissionsValue.users.delete &&
											values.delete_user_usage_limit_enabled,
									),
						delete_user_usage_limit: globalDeleteUserUsageLimit,
						expire: expireValue,
						users_limit: values.use_service_traffic_limits
							? undefined
							: globalUsersLimit,
					};
					const createdAdmin = await createAdmin(payload);
					let shouldFetch = true;
					let serviceSyncError: unknown = null;
					if (
						selectedRole !== AdminRole.FullAccess &&
						values.use_service_traffic_limits
					) {
						try {
							await updateAdmin(createdAdmin.username, {
								services: requestedServices,
								use_service_traffic_limits: true,
								service_limits: serviceLimitPayload,
							});
							shouldFetch = false;
						} catch (error) {
							serviceSyncError = error;
						}
					} else if (requestedServices.length > 0) {
						const createdServices = new Set(createdAdmin?.services ?? []);
						const missingServices = requestedServices.filter(
							(serviceId) => !createdServices.has(serviceId),
						);
						const needsSync =
							missingServices.length > 0 ||
							createdServices.size !== requestedServices.length;
						if (needsSync) {
							try {
								await updateAdmin(createdAdmin.username, {
									services: requestedServices,
								});
								shouldFetch = false;
							} catch (error) {
								serviceSyncError = error;
							}
						}
					}
					if (shouldFetch) {
						await fetchAdmins(undefined, { force: true });
					}
					generateSuccessMessage(t("admins.createSuccess"), toast);
					if (serviceSyncError) {
						generateErrorMessage(serviceSyncError, toast);
					}
				} else if (admin) {
					const payload: AdminUpdatePayload = {
						role: selectedRole,
						require_2fa: canManage2FA ? values.require_2fa : undefined,
						permissions:
							selectedRole === AdminRole.FullAccess
								? undefined
								: permissionPayload,
						services: values.services || [],
						telegram_id: values.telegram_id
							? Number(values.telegram_id)
							: undefined,
						data_limit: values.use_service_traffic_limits
							? undefined
							: globalDataLimit,
						traffic_limit_mode:
							selectedRole === AdminRole.FullAccess ||
							values.use_service_traffic_limits
								? undefined
								: values.traffic_limit_mode,
						use_service_traffic_limits:
							selectedRole === AdminRole.FullAccess
								? undefined
								: values.use_service_traffic_limits,
						show_user_traffic:
							selectedRole === AdminRole.FullAccess
								? undefined
								: values.show_user_traffic,
						delete_user_usage_limit_enabled:
							selectedRole === AdminRole.FullAccess
								? undefined
								: Boolean(
										permissionsValue.users.delete &&
											values.delete_user_usage_limit_enabled,
									),
						delete_user_usage_limit: globalDeleteUserUsageLimit,
						expire: expireValue,
						users_limit: values.use_service_traffic_limits
							? undefined
							: globalUsersLimit,
						service_limits: serviceLimitPayload,
					};
					if (values.password) {
						payload.password = values.password;
					}
					await updateAdmin(admin.username, payload);
					generateSuccessMessage(t("admins.updateSuccess"), toast);
				}
				setSubmitStatus("success");
				successCloseTimerRef.current = window.setTimeout(() => {
					successCloseTimerRef.current = null;
					handleCloseAdminDialog();
				}, 1000);
			} catch (error) {
				generateErrorMessage(error, toast, form);
				showSubmitError();
			}
		},
		() => {
			if (submitStatus !== "idle") return;
			showSubmitError();
		},
	);

	const detailsForm = (
		<div className="flex flex-col gap-4 items-stretch">
			<div className="xray-dialog-section">
				<p className="text-[0.875rem] font-semibold mb-3">
					{t("inbounds.accounts.label")}
				</p>
				<div className="flex flex-col gap-4 items-stretch">
					{mode === "edit" && admin?.id !== undefined && (
						<FormControl>
							<FormLabel>{t("admins.idLabel")}</FormLabel>
							<Input value={String(admin.id)} isReadOnly />
						</FormControl>
					)}
					{mode === "edit" && (
						<FormControl>
							<FormLabel>{t("status")}</FormLabel>
							<Input value={statusLabel} isReadOnly />
						</FormControl>
					)}
					{mode === "edit" && admin?.id !== undefined && (
						<EntityNotePanel entityType="admin" entityKey={admin.id} />
					)}
					<FormControl isInvalid={!!errors.username}>
						<FormLabel>{t("username")}</FormLabel>
						<InputGroup dir={isRTL ? "rtl" : "ltr"}>
							<Input placeholder={t("admins.usernamePlaceholder")} {...register("username")} isDisabled={mode === "edit"} {...(mode === "create" ? endPadding : {})} />
							{mode === "create" && (
								<InputRightElement style={{ insetInlineEnd: endAdornmentProps.insetInlineEnd, insetInlineStart: endAdornmentProps.insetInlineStart, right: endAdornmentProps.right, left: endAdornmentProps.left }}>
									<IconButton aria-label={t("admins.generateUsername")} size="sm" variant="ghost" icon={<SparklesIcon className="w-20" />} onClick={handleGenerateUsername} />
								</InputRightElement>
							)}
						</InputGroup>
						<FormErrorMessage>
							{errors.username?.message as string}
						</FormErrorMessage>
					</FormControl>
					<FormControl isInvalid={!!errors.password}>
						<FormLabel>{t("password")}</FormLabel>
						<div className="flex flex-row items-center gap-2">
							<InputGroup dir={isRTL ? "rtl" : "ltr"}>
								<Input placeholder={t("admins.passwordPlaceholder")} type={showPassword ? "text" : "password"} {...register("password")} {...endPadding} />
								<InputRightElement style={{ insetInlineEnd: endAdornmentProps.insetInlineEnd, insetInlineStart: endAdornmentProps.insetInlineStart, right: endAdornmentProps.right, left: endAdornmentProps.left }}>
									<IconButton aria-label={
											showPassword
												? t("admins.hidePassword")
												: t("admins.showPassword")
										} size="sm" variant="ghost" icon={
											showPassword ? (
												<EyeSlashIcon className="w-16" />
											) : (
												<EyeIcon className="w-16" />
											)
										} onClick={() => setShowPassword(!showPassword)} />
								</InputRightElement>
							</InputGroup>
							<IconButton aria-label={t("admins.generatePassword")} size="md" variant="outline" icon={<SparklesIcon className="w-20" />} onClick={handleGeneratePassword} />
						</div>
						<FormErrorMessage>
							{errors.password?.message as string}
						</FormErrorMessage>
						{mode === "edit" && (
							<p className="text-[0.75rem] text-gray-500 mt-1">
								{t("admins.passwordOptionalHint")}
							</p>
						)}
					</FormControl>
					<FormControl isInvalid={!!errors.telegram_id}>
						<FormLabel>{t("admins.telegramId")}</FormLabel>
						<NumericInput
							value={telegramIdValue}
							precision={0}
							onChange={(value) =>
								setValue("telegram_id", value, {
									shouldDirty: true,
									shouldValidate: true,
								})
							}
						/>
						<FormErrorMessage>
							{errors.telegram_id?.message as string}
						</FormErrorMessage>
					</FormControl>
				</div>
			</div>
			<div className="xray-dialog-section">
				<p className="text-[0.875rem] font-semibold mb-3">
					{t("core.role")}
				</p>
				<div className="flex flex-col gap-4 items-stretch">
					<FormControl>
						<FormLabel>{t("admins.roleLabel")}</FormLabel>
						<RadioGroup value={watchRole ?? AdminRole.Standard} onChange={(value) =>
								setValue("role", value as AdminRole, { shouldDirty: true })
							}>
							<div className="flex flex-col items-start gap-2">
								<Radio value={AdminRole.Standard}>
									<p className="font-medium">{t("admins.roles.standard")}</p>
									<FormHelperText className="m-0">
										{t("admins.roles.standardDescription")}
									</FormHelperText>
								</Radio>
								<Radio value={AdminRole.Reseller} isDisabled>
									<p className="font-medium">
										{t("admins.roles.reseller")}
										<span className="ml-2 text-[0.75rem] text-orange-500">
											{t("common.comingSoon")}
										</span>
									</p>
									<FormHelperText className="m-0">
										{t("admins.roles.resellerDescription")}
									</FormHelperText>
								</Radio>
								<Radio value={AdminRole.Sudo}>
									<p className="font-medium">{t("admins.roles.sudo")}</p>
									<FormHelperText className="m-0">
										{t("admins.roles.sudoDescription")}
									</FormHelperText>
								</Radio>
								{canCreateFullAccess && (
									<Radio value={AdminRole.FullAccess}>
										<p className="font-medium">
											{t("admins.roles.fullAccess")}
										</p>
										<FormHelperText className="m-0">
											{t("admins.roles.fullAccessDescription")}
										</FormHelperText>
									</Radio>
								)}
							</div>
						</RadioGroup>
					</FormControl>
				</div>
			</div>
			<div className="xray-dialog-section">
				<p className="text-[0.875rem] font-semibold mb-3">
					{t("admins.limitsSection")}
				</p>
				<div className="flex flex-col gap-4 items-stretch">
					{!isFullAccessRole && (
						<div className="flex flex-col items-stretch gap-3">
							<Checkbox isChecked={usePerServiceTrafficLimits} onChange={(event) =>
									setValue("use_service_traffic_limits", event.target.checked, {
										shouldDirty: true,
									})
								}>
								{t("admins.usePerServiceTrafficLimits")}
							</Checkbox>
						</div>
					)}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<FormControl isInvalid={!!errors.data_limit}>
							<FormLabel>{t("admins.dataLimit")}</FormLabel>
							<NumericInput
								value={dataLimitValue}
								precision={0}
								isDisabled={usePerServiceTrafficLimits}
								onChange={(value) =>
									setValue("data_limit", value, {
										shouldDirty: true,
										shouldValidate: true,
									})
								}
							/>
							<FormErrorMessage>
								{errors.data_limit?.message as string}
							</FormErrorMessage>
							<p className="text-[0.75rem] text-gray-500 mt-1">
								{t("admins.dataLimitHint")}
							</p>
						</FormControl>
						<FormControl isInvalid={!!errors.users_limit}>
							<FormLabel>{t("admins.usersLimit")}</FormLabel>
							<NumericInput
								value={usersLimitValue}
								precision={0}
								isDisabled={usePerServiceTrafficLimits}
								onChange={(value) =>
									setValue("users_limit", value, {
										shouldDirty: true,
										shouldValidate: true,
									})
								}
							/>
							<FormErrorMessage>
								{errors.users_limit?.message as string}
							</FormErrorMessage>
							<p className="text-[0.75rem] text-gray-500 mt-1">
								{t("admins.usersLimitHint")}
							</p>
						</FormControl>
					</div>
					{!isFullAccessRole &&
						!usePerServiceTrafficLimits &&
						(hasGlobalDataLimit || isCreatedTrafficMode) && (
							<div className="flex flex-col items-stretch gap-3">
								<Checkbox isChecked={isCreatedTrafficMode} onChange={(event) =>
										setValue(
											"traffic_limit_mode",
											event.target.checked
												? AdminTrafficLimitMode.CreatedTraffic
												: AdminTrafficLimitMode.UsedTraffic,
											{ shouldDirty: true },
										)
									}>
									{t("admins.limitByCreatedTraffic")}
								</Checkbox>
								{isCreatedTrafficMode && (
									<div className="flex flex-col gap-2 pl-1">
										<Checkbox isChecked={Boolean(showUserTrafficValue)} onChange={(event) =>
												setValue("show_user_traffic", event.target.checked, {
													shouldDirty: true,
												})
											}>
											{t("admins.showUserTraffic")}
										</Checkbox>
										<Checkbox isChecked={Boolean(permissionsValue.users.delete)} onChange={(event) =>
												handleUserPermissionToggle(
													"delete",
													event.target.checked,
												)
											}>
											{t("admins.permissions.deleteUser")}
										</Checkbox>
										<Checkbox isChecked={Boolean(deleteUserUsageLimitEnabled)} isDisabled={!permissionsValue.users.delete} onChange={(event) =>
												setValue(
													"delete_user_usage_limit_enabled",
													event.target.checked,
													{ shouldDirty: true },
												)
											}>
											{t("admins.deleteUserUsageCap")}
										</Checkbox>
										{deleteUserUsageLimitEnabled && (
											<FormControl isInvalid={!!errors.delete_user_usage_limit}>
												<FormLabel>
													{t("admins.deleteUserUsageLimit")}
												</FormLabel>
												<NumericInput
													value={deleteUserUsageLimitValue}
													precision={0}
													onChange={(value) =>
														setValue("delete_user_usage_limit", value, {
															shouldDirty: true,
															shouldValidate: true,
														})
													}
												/>
												<FormErrorMessage>
													{errors.delete_user_usage_limit?.message as string}
												</FormErrorMessage>
											</FormControl>
										)}
										<Checkbox isChecked={Boolean(permissionsValue.users.reset_usage)} onChange={(event) =>
												handleUserPermissionToggle(
													"reset_usage",
													event.target.checked,
												)
											}>
											{t("admins.permissions.resetUsage")}
										</Checkbox>
										<p className="text-[0.75rem] text-gray-500">
											{t("admins.createdTrafficModeHint")}
										</p>
									</div>
								)}
							</div>
						)}
					<FormControl>
						<FormLabel>{t("admins.expireLabel")}</FormLabel>
						<DateTimePicker
							value={adminExpireDate}
							onChange={setAdminExpireDate}
							placeholder={t("expires.selectDate")}
							minDate={new Date()}
						/>
						{adminExpireUnix && adminExpireInfo.time ? (
							<FormHelperText>
								{t(adminExpireInfo.status, { time: adminExpireInfo.time })}
							</FormHelperText>
						) : (
							<FormHelperText>{t("admins.expireHint")}</FormHelperText>
						)}
					</FormControl>
				</div>
			</div>
			<div className="xray-dialog-section admin-services-section">
				<p className="text-[0.875rem] font-semibold mb-3">
					{t("services.title")}
				</p>
				<div className="flex flex-col gap-3 items-stretch">
					<FormControl>
						<div className="flex flex-col items-stretch gap-2">
							<div className="flex flex-row justify-between items-start sm:items-center gap-3 flex-wrap">
								<Checkbox isChecked={
										selectedServices.length === serviceOptions.length &&
										serviceOptions.length > 0
									} isIndeterminate={
										selectedServices.length > 0 &&
										selectedServices.length < serviceOptions.length
									} onChange={handleToggleAllServices} isDisabled={serviceOptions.length === 0}>
									{t("admins.selectAllServices")}
								</Checkbox>
								<Badge variant="subtle" colorScheme="primary" className="rounded-md">
									{selectedServices.length} / {serviceOptions.length}
								</Badge>
							</div>
							<SearchInput
								value={serviceSearch}
								onChange={(event) => setServiceSearch(event.target.value)}
								placeholder={t("admins.searchServices")}
								matchOptions={serviceSearchMatch}
								onMatchOptionsChange={setServiceSearchMatch}
								onClear={() => setServiceSearch("")}
							/>
							<div className="flex flex-col items-stretch gap-1.5 max-h-[150px] overflow-y-auto border rounded-md p-2 admin-services-list">
								{serviceOptions.length === 0 ? (
									<p className="text-[0.875rem] text-gray-500">
										{t("services.noServicesAvailable")}
									</p>
								) : filteredServices.length === 0 ? (
									<p className="text-[0.875rem] text-gray-500">
										{t("admins.noServicesMatching")}
									</p>
								) : (
									filteredServices.map((service) => {
										const isSelected = selectedServicesSet.has(service.id);
										return (
											// biome-ignore lint/a11y/useSemanticElements: service card holds block content; keyboard toggling is handled in onKeyDown
											<div key={service.id} onClick={() => handleServiceToggle(service.id)} onKeyDown={(event) => {
													if (event.key === "Enter" || event.key === " ") {
														event.preventDefault();
														handleServiceToggle(service.id);
													}
												}} role="button" tabIndex={0} className={cn("border rounded-md px-2.5 py-2 hover:border-primary-300! hover:cursor-pointer [transition:background-color_140ms_var(--rb-ease-out),_border-color_140ms_var(--rb-ease-out),_box-shadow_140ms_var(--rb-ease-out),_transform_120ms_var(--rb-ease-out)] active:[transform:scale(0.99)]", isSelected ? "border-primary-400!" : "border-gray-200!", isSelected ? "bg-primary-50" : "bg-transparent", isSelected ? "dark:border-primary-300!" : "dark:border-gray-600!", isSelected ? "dark:bg-gray-700" : "dark:bg-transparent")}>
												<div className="flex flex-row justify-between items-center gap-3">
													<div className="min-w-0!">
														<p className="font-medium truncate">
															{service.name}
														</p>
														<p className="text-[0.75rem] text-gray-500">
															{t("admins.serviceStats", {
																users: service.user_count ?? 0,
																hosts: service.host_count ?? 0,
															})}
														</p>
													</div>
													{isSelected && (
														<Badge colorScheme="primary" variant="subtle" className="rounded-md shrink-0">
															{t("services.selected")}
														</Badge>
													)}
												</div>
											</div>
										);
									})
								)}
							</div>
							{usePerServiceTrafficLimits && selectedServices.length > 0 && (
								<div className="flex flex-col items-stretch gap-2.5 pt-1">
									<div className="flex flex-row gap-2 justify-between items-center">
										<p className="font-semibold text-[0.875rem]">
											{t("admins.perServiceLimitsTitle")}
										</p>
										<Badge variant="subtle" className="rounded-md">
											{selectedServices.length}
										</Badge>
									</div>
									<div className="flex flex-col items-stretch gap-2 max-h-[320px] overflow-y-auto pr-1">
										{selectedServices.map((serviceId) => {
											const service = serviceOptions.find(
												(item) => item.id === serviceId,
											);
											const item = getServiceLimitValue(serviceId);
											const isServiceCreatedMode =
												item.traffic_limit_mode ===
												AdminTrafficLimitMode.CreatedTraffic;
											const configuredLimitBytes =
												item.data_limit && Number(item.data_limit) > 0
													? Number(item.data_limit) * GB_IN_BYTES
													: 0;
											const usageBytes = isServiceCreatedMode
												? Number(item.created_traffic ?? 0)
												: Number(item.used_traffic ?? 0);
											const remainingBytes =
												configuredLimitBytes > 0
													? Math.max(configuredLimitBytes - usageBytes, 0)
													: null;
											return (
												<div key={`service-limit-${serviceId}`} className="border rounded-md p-2.5 admin-service-limit-card">
													<div className="flex flex-col items-stretch gap-2.5">
														<div className="flex flex-row justify-between items-start gap-3">
															<div className="min-w-0!">
																<p className="font-medium truncate">
																	{service?.name ?? `#${serviceId}`}
																</p>
																<p className="text-gray-400 text-[0.75rem]">
																	{t("admins.deletedUserUsage")}:{" "}
																	{formatBytes(
																		Number(item.deleted_users_usage ?? 0),
																		2,
																	)}
																</p>
															</div>
															<p className="text-primary-200 text-[0.75rem] font-medium whitespace-nowrap text-end">
																<span className="block">
																	{formatBytes(usageBytes, 2)} /{" "}
																	{configuredLimitBytes > 0
																		? formatBytes(configuredLimitBytes, 2)
																		: t("nodes.unlimited")}
																</span>
																<span className="block mt-0.5 text-gray-400">
																	{t("myaccount.remainingData")}:{" "}
																	{remainingBytes === null
																		? t("nodes.unlimited")
																		: formatBytes(remainingBytes, 2)}
																</span>
															</p>
														</div>
														<Checkbox isChecked={isServiceCreatedMode} onChange={(event) =>
																setServiceLimitValue(serviceId, {
																	traffic_limit_mode: event.target.checked
																		? AdminTrafficLimitMode.CreatedTraffic
																		: AdminTrafficLimitMode.UsedTraffic,
																})
															}>
															{t("admins.limitByCreatedTraffic")}
														</Checkbox>
														<div className="grid grid-cols-1 md:grid-cols-2 gap-2">
															<FormControl>
																<FormLabel>{t("admins.dataLimit")}</FormLabel>
																<NumericInput
																	value={item.data_limit ?? ""}
																	precision={0}
																	size="sm"
																	onChange={(value) =>
																		setServiceLimitValue(serviceId, {
																			data_limit: value,
																		})
																	}
																/>
															</FormControl>
															<FormControl>
																<FormLabel>{t("admins.usersLimit")}</FormLabel>
																<NumericInput
																	value={item.users_limit ?? ""}
																	precision={0}
																	size="sm"
																	onChange={(value) =>
																		setServiceLimitValue(serviceId, {
																			users_limit: value,
																		})
																	}
																/>
															</FormControl>
														</div>
														{isServiceCreatedMode && (
															<div className="flex flex-col gap-1.5">
																<Checkbox isChecked={item.show_user_traffic} onChange={(event) =>
																		setServiceLimitValue(serviceId, {
																			show_user_traffic: event.target.checked,
																		})
																	}>
																	{t("admins.showUserTraffic")}
																</Checkbox>
																<Checkbox isChecked={
																		permissionsValue.users.delete &&
																		item.delete_user_usage_limit_enabled
																	} isDisabled={!permissionsValue.users.delete} onChange={(event) =>
																		setServiceLimitValue(serviceId, {
																			delete_user_usage_limit_enabled:
																				event.target.checked,
																		})
																	}>
																	{t("admins.deleteUserUsageCap")}
																</Checkbox>
																{item.delete_user_usage_limit_enabled && (
																	<FormControl>
																		<FormLabel>
																			{t("admins.deleteUserUsageLimit")}
																		</FormLabel>
																		<NumericInput
																			value={item.delete_user_usage_limit ?? ""}
																			precision={0}
																			size="sm"
																			onChange={(value) =>
																				setServiceLimitValue(serviceId, {
																					delete_user_usage_limit: value,
																				})
																			}
																		/>
																	</FormControl>
																)}
															</div>
														)}
													</div>
												</div>
											);
										})}
									</div>
								</div>
							)}
						</div>
						<FormHelperText>{t("admins.servicesHelper")}</FormHelperText>
					</FormControl>
				</div>
			</div>
		</div>
	);

	const permissionsPanel = (
		<div className="flex flex-col items-stretch gap-4">
			<AdminPermissionsEditor
				value={
					permissionsValue ?? clonePermissions(watchRole ?? AdminRole.Standard)
				}
				onChange={handlePermissionsChange}
				showReset
				onReset={resetPermissionsToRole}
				maxDataLimitValue={maxDataLimitValue}
				onMaxDataLimitChange={handleMaxDataLimitChange}
				maxDataLimitError={
					errors.maxDataLimitPerUserGb?.message as string | undefined
				}
				maxSpeedLimitValue={maxSpeedLimitValue}
				onMaxSpeedLimitChange={handleMaxSpeedLimitChange}
				maxSpeedLimitError={
					errors.maxSpeedLimitPerUserMbps?.message as string | undefined
				}
				maxIPLimitValue={maxIPLimitValue}
				onMaxIPLimitChange={handleMaxIPLimitChange}
				maxIPLimitError={
					errors.maxIPLimitPerUser?.message as string | undefined
				}
				hideExtendedSections={watchRole === AdminRole.Standard}
				isReadOnly={watchRole === AdminRole.FullAccess}
			/>
			{canManage2FA && (
				<div className="xray-dialog-section">
					<Checkbox isChecked={watch("require_2fa")} onChange={(event) =>
							setValue("require_2fa", event.target.checked, {
								shouldDirty: true,
							})
						}>
						{t("admins.security.require2FA")}
					</Checkbox>
				</div>
			)}
		</div>
	);

	return (
		<>
			<Modal isOpen={isOpen} onClose={handleCloseAdminDialog} size="3xl" scrollBehavior="inside">
				<ModalOverlay className="bg-blackAlpha-400" />
				<XrayModalContent className="[.admin-services-section_.chakra-form-control]:block [.admin-services-section_.chakra-form-control]:grid-cols-none [.admin-services-section_.chakra-form__label]:mb-1 [.admin-services-section_.chakra-form__helper-text,_.admin-services-section_.chakra-form__error-message]:[grid-column:auto] [.admin-services-section_.chakra-simple-grid]:grid-cols-[1fr] [.admin-services-section_.chakra-simple-grid]:md:grid-cols-[repeat(2,_minmax(0,_1fr))] [.admin-services-section_.chakra-checkbox__label]:text-[13px] [.admin-service-limit-card_.chakra-form-control]:block [.admin-service-limit-card_.chakra-form-control]:grid-cols-none mx-3">
					<XrayModalHeader dir={isRTL ? "rtl" : "ltr"}>
						{mode === "create"
							? t("admins.addAdminTitle")
							: t("admins.editAdminTitle")}
					</XrayModalHeader>
					<ModalCloseButton />
					<XrayModalBody>
						<Tabs variant="unstyled" isLazy className="w-full xray-dialog-auto-sections">
							<TabList>
								<Tab>{t("details")}</Tab>
								<Tab>{t("admins.permissionsTabLabel")}</Tab>
							</TabList>
							<TabPanels>
								<TabPanel className="px-0">{detailsForm}</TabPanel>
								<TabPanel className="px-0">{permissionsPanel}</TabPanel>
							</TabPanels>
						</Tabs>
					</XrayModalBody>
					<XrayModalFooter>
						<div className="flex flex-row items-center gap-3 w-full justify-end flex-wrap">
							<Button variant="ghost" size="sm" onClick={handleCloseAdminDialog}>
								{t("cancel")}
							</Button>
							<AnimatedSubmitButton onClick={handleFormSubmit} status={submitStatus} idleContent={
									mode === "create" ? t("admins.addAdmin") : t("save")
								} successLabel={t("userDialog.submitSuccess")} isDisabled={isSubmitting} containerProps={{ className: "w-full sm:w-[180px]" }} />
						</div>
					</XrayModalFooter>
				</XrayModalContent>
			</Modal>
			<AdminPermissionsModal
				isOpen={permissionsModalOpen}
				onClose={() => setPermissionsModalOpen(false)}
				admin={admin}
			/>
		</>
	);
};

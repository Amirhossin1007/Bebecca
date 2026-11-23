import { zodResolver } from "@hookform/resolvers/zod";
import { createUsageConfig } from "components/UsageFilter";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import { useColorMode } from "lib/color-mode";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type Resolver, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useInvalidateLabels, useTags } from "service/labels";
import { AdminRole, UserPermissionToggle } from "types/Admin";
import type {
	User,
	UserCreate,
	UserCreateWithService,
	UserListItem,
} from "types/User";
import { isUserManagementLocked } from "utils/adminTraffic";
import { z } from "zod";
import {
	BYTES_PER_GB,
	type FormType,
	type TabValue,
	USERNAME_REGEX,
} from "./UserDialog.types";

const SUCCESS_CLOSE_DELAY_MS = 1000;

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
		group_id: user.group?.id ?? null,
		tags: user.tags ?? [],
	};
};

const getDefaultValues = (): FormType => ({
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

const gigabytesToBytes = (gigabytes: number) =>
	Math.round(gigabytes * BYTES_PER_GB);

const buildSchema = (isEditing: boolean) => {
	const base = {
		username: isEditing
			? z.string().min(1)
			: z.string().regex(USERNAME_REGEX, {
					message: "Username must be 3-32 characters: a-z, 0-9, ., _, -, @",
				}),
		flow: z.string().optional().nullable(),
		service_id: z
			.union([z.string(), z.number()])
			.nullable()
			.transform((v) => (v ? Number(v) : null)),
		data_limit: z.union([z.string(), z.number(), z.null()]).transform((v) => {
			if (v === null || v === undefined || v === "") return 0;
			const n = Number(v);
			return Number.isFinite(n) && n >= 0 ? gigabytesToBytes(n) : 0;
		}),
		expire: z.number().nullable(),
		data_limit_reset_strategy: z.string(),
		note: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((v) => v ?? ""),
		group_id: z
			.number()
			.nullable()
			.optional()
			.transform((v) => v ?? null),
		tags: z
			.array(z.string())
			.optional()
			.transform((v) => v ?? []),
		telegram_id: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((v) => v ?? ""),
		contact_number: z
			.union([z.string(), z.null(), z.undefined()])
			.transform((v) => v ?? ""),
		next_plan_enabled: z.boolean().default(false),
		next_plan_data_limit: z
			.union([z.string(), z.number(), z.null()])
			.transform((v) => (v ? Number(v) : null)),
		next_plan_expire: z
			.union([z.number(), z.string(), z.null()])
			.transform((v) => (v ? Number(v) : null)),
		next_plan_add_remaining_traffic: z.boolean().default(false),
		next_plan_fire_on_either: z.boolean().default(true),
		speed_limit: z.union([z.number(), z.null()]).optional(),
		ip_limit: z.union([z.number(), z.null()]).optional(),
		manual_key_entry: z.boolean().default(false),
		credential_key: z.union([z.string(), z.null(), z.undefined()]).nullable(),
	};

	return z.discriminatedUnion("status", [
		z.object({ status: z.literal("active"), ...base }),
		z.object({ status: z.literal("disabled"), ...base }),
		z.object({ status: z.literal("limited"), ...base }),
		z.object({ status: z.literal("expired"), ...base }),
		z.object({
			status: z.literal("on_hold"),
			on_hold_expire_duration: z.coerce
				.number()
				.min(0.1)
				.transform((d) => d * 86400),
			...base,
		}),
	]);
};

export const useUserFormLogic = () => {
	const { t } = useTranslation();
	const { colorMode } = useColorMode();
	const editingUser = useDashboard((s) => s.editingUser);
	const isCreatingNewUser = useDashboard((s) => s.isCreatingNewUser);
	const onCreateUser = useDashboard((s) => s.onCreateUser);
	const onEditingUser = useDashboard((s) => s.onEditingUser);
	const editUser = useDashboard((s) => s.editUser);
	const createUserWithService = useDashboard((s) => s.createUserWithService);
	const deleteUser = useDashboard((s) => s.deleteUser);
	const _usersLimit = useDashboard((s) => s.users.users_limit ?? null);
	const _activeUsersCount = useDashboard((s) => s.users.active_total ?? null);
	const isUserLimitReached = useDashboard((s) => s.isUserLimitReached);
	const setQRCode = useDashboard((s) => s.setQRCode);
	const _setSubLink = useDashboard((s) => s.setSubLink);
	const _linkTemplates = useDashboard((s) => s.linkTemplates);
	const editingUserInitialTab = useDashboard((s) => s.editingUserInitialTab);

	const { userData, getUserIsSuccess } = useGetUser();
	const services = useServicesStore((s) => s.services);
	const fetchServices = useServicesStore((s) => s.fetchServices);
	const { data: rawTags = [] } = useTags("user");
	const knownTags = useMemo(
		() =>
			(rawTags as any[]).map((item) =>
				typeof item === "string" ? item : item.tag,
			),
		[rawTags],
	);
	const invalidateLabels = useInvalidateLabels();

	const isEditing = Boolean(editingUser);
	const isOpen = isCreatingNewUser || isEditing;
	const limitReached = isUserLimitReached && !isEditing;

	const [loading, setLoading] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const initialTab: TabValue =
		editingUserInitialTab === 1
			? "usage"
			: editingUserInitialTab === 2
				? "links"
				: "details";
	const [tab, setTab] = useState<TabValue>(initialTab);
	const [randomUsernameLoading, setRandomUsernameLoading] = useState(false);
	const [usageFilter, setUsageFilter] = useState("1m");
	const [usageConfig, _setUsageConfig] = useState(() =>
		createUsageConfig(colorMode, t("userDialog.total")),
	);

	const formSchema = useMemo(() => buildSchema(isEditing), [isEditing]);
	const form = useForm<FormType>({
		defaultValues: editingUser ? formatUser(editingUser) : getDefaultValues(),
		resolver: zodResolver(
			formSchema as unknown as Parameters<typeof zodResolver>[0],
		) as unknown as Resolver<FormType>,
		mode: "onChange",
	});

	const hasPrivilegedRole = Boolean(
		getUserIsSuccess &&
			(userData.role === AdminRole.Sudo ||
				userData.role === AdminRole.FullAccess),
	);
	const hasFullAccess = Boolean(
		getUserIsSuccess && userData.role === AdminRole.FullAccess,
	);
	const canSetCustomKey =
		hasPrivilegedRole ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.AllowCustomKey]);
	const canDeleteUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Delete]);
	const canResetUsage =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ResetUsage]);
	const canConfigurePeriodicReset =
		hasFullAccess ||
		Boolean(
			userData.permissions?.users?.[UserPermissionToggle.PeriodicUsageReset],
		);
	const canRevokeSub =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Revoke]);
	const speedLimitEditable =
		userData.user_speed_limit_enabled !== false &&
		(userData.role === AdminRole.FullAccess ||
			Boolean(
				userData.permissions?.users?.[UserPermissionToggle.ManageSpeedLimit],
			));
	const ipLimitEditable =
		userData.role === AdminRole.FullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ManageIPLimit]);

	const userManagementLocked = isUserManagementLocked(
		userData,
		editingUser?.service_id,
	);
	const disabled = loading || limitReached || userManagementLocked;

	useEffect(() => {
		if (isOpen) {
			fetchServices({ limit: 1000 });
		}
	}, [isOpen, fetchServices]);

	useEffect(() => {
		if (editingUser) {
			form.reset(formatUser(editingUser));
		} else {
			form.reset(getDefaultValues());
		}
	}, [editingUser, form]);

	const onClose = useCallback(() => {
		onCreateUser(false);
		onEditingUser(null);
	}, [onCreateUser, onEditingUser]);

	const generateRandomUsername = useCallback(() => {
		setRandomUsernameLoading(true);
		const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
		let res = "";
		for (let i = 0; i < 8; i++) {
			res += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		form.setValue("username", res, { shouldDirty: true, shouldValidate: true });
		window.setTimeout(() => setRandomUsernameLoading(false), 200);
	}, [form]);

	const submit = async (values: FormType) => {
		setLoading(true);
		try {
			const normalizedStatus =
				values.status === "on_hold"
					? "on_hold"
					: values.status === "disabled"
						? "disabled"
						: "active";
			const normalizedIp =
				values.ip_limit && values.ip_limit > 0
					? Math.floor(values.ip_limit)
					: 0;
			const normalizedSpeed =
				values.speed_limit && values.speed_limit > 0
					? Math.round(values.speed_limit * 1000)
					: 0;

			if (!isEditing) {
				const serviceId = values.service_id ?? services[0]?.id;
				if (!serviceId) {
					toast.error(t("userDialog.selectService"));
					setLoading(false);
					return;
				}
				const payload: UserCreateWithService = {
					username: values.username,
					service_id: serviceId,
					note: values.note,
					status: normalizedStatus,
					expire: values.expire,
					data_limit: values.data_limit,
					ip_limit: normalizedIp,
					speed_limit_kbps: normalizedSpeed,
					data_limit_reset_strategy: values.data_limit_reset_strategy,
					on_hold_expire_duration:
						values.status === "on_hold" ? values.on_hold_expire_duration : null,
					telegram_id: values.telegram_id,
					contact_number: values.contact_number,
					group_id: values.group_id,
					tags: values.tags,
				};
				if (
					canSetCustomKey &&
					values.manual_key_entry &&
					values.credential_key
				) {
					payload.credential_key = values.credential_key;
				}
				await createUserWithService(payload);
				toast.success(
					t("userDialog.userCreated", { username: values.username }),
				);
			} else if (editingUser) {
				const body: Record<string, unknown> = {
					note: values.note,
					status: normalizedStatus,
					expire: values.expire,
					data_limit: values.data_limit,
					ip_limit: normalizedIp,
					speed_limit_kbps: normalizedSpeed,
					data_limit_reset_strategy: values.data_limit_reset_strategy,
					on_hold_expire_duration:
						values.status === "on_hold" ? values.on_hold_expire_duration : null,
					telegram_id: values.telegram_id,
					contact_number: values.contact_number,
					group_id: values.group_id,
					tags: values.tags,
				};
				if (values.service_id && values.service_id !== editingUser.service_id) {
					body.service_id = values.service_id;
				}
				if (
					canSetCustomKey &&
					values.manual_key_entry &&
					values.credential_key
				) {
					body.credential_key = values.credential_key;
				}
				await editUser(editingUser.username, body as UserCreate);
				toast.success(
					t("userDialog.userEdited", { username: values.username }),
				);
			}
			void invalidateLabels();
			window.setTimeout(onClose, SUCCESS_CLOSE_DELAY_MS);
		} catch (err: any) {
			const detail = err?.response?._data?.detail || err?.message || t("error");
			toast.error(String(detail));
		} finally {
			setLoading(false);
		}
	};

	const handleDeleteUser = async () => {
		if (!editingUser || !canDeleteUsers) return;
		setDeleteLoading(true);
		try {
			await deleteUser(editingUser as unknown as UserListItem);
			toast.success(
				t("deleteUser.deleteSuccess", { username: editingUser.username }),
			);
			onClose();
		} catch {
			toast.error(t("error"));
		} finally {
			setDeleteLoading(false);
		}
	};

	const links = useMemo(() => {
		if (!editingUser) return [];
		const res: Array<{
			key: string;
			label: string;
			url: string;
			isSub?: boolean;
		}> = [];
		const subUrls = Object.entries(editingUser.subscription_urls ?? {});
		for (const [k, url] of subUrls) {
			if (url)
				res.push({
					key: `sub-${k}`,
					label: `${t("userDialog.links.subscription")} (${k})`,
					url,
					isSub: true,
				});
		}
		const configs = editingUser.links ?? [];
		configs.forEach((cfg, idx) => {
			res.push({ key: `cfg-${idx}`, label: `Config #${idx + 1}`, url: cfg });
		});
		return res;
	}, [editingUser, t]);

	return {
		form,
		isOpen,
		isEditing,
		editingUser,
		disabled,
		loading,
		deleteLoading,
		tab,
		setTab,
		randomUsernameLoading,
		generateRandomUsername,
		submit,
		onClose,
		handleDeleteUser,
		services,
		knownTags,
		invalidateLabels,
		canSetCustomKey,
		canDeleteUsers,
		canResetUsage,
		canRevokeSub,
		canConfigurePeriodicReset,
		speedLimitEditable,
		ipLimitEditable,
		usageConfig,
		usageFilter,
		setUsageFilter,
		links,
		setQRCode,
	};
};

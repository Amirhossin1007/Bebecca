import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import { type SubmitStatus, useSubmitTimers } from "hooks/useSubmitTimers";
import { useEffect, useMemo, useRef, useState } from "react";
import { type Resolver, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useInvalidateLabels, useTags } from "service/labels";
import {
	AdminRole,
	AdminTrafficLimitMode,
	UserPermissionToggle,
} from "types/Admin";
import type {
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
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";
import {
	BYTES_PER_GB,
	formatUserToForm,
	getDefaultUserFormValues,
	gigabytesToBytes,
	parseDecimalInput,
	SUCCESS_CLOSE_DELAY_MS,
} from "./userDialog.helpers";
import { buildUserDialogSchema } from "./userDialog.schema";
import type { FormType } from "./userDialog.types";
import { useUserDialogAutoRenew } from "./useUserDialogAutoRenew";
import { useUserDialogLinks } from "./useUserDialogLinks";
import { useUserDialogUsage } from "./useUserDialogUsage";

export const useUserDialogForm = () => {
	const editingUser = useDashboard((state) => state.editingUser);
	const isCreatingNewUser = useDashboard((state) => state.isCreatingNewUser);
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const editUser = useDashboard((state) => state.editUser);
	const deleteUser = useDashboard((state) => state.deleteUser);
	const onEditingUser = useDashboard((state) => state.onEditingUser);
	const createUserWithService = useDashboard(
		(state) => state.createUserWithService,
	);
	const usersLimit = useDashboard((state) => state.users.users_limit ?? null);
	const activeUsersCount = useDashboard(
		(state) => state.users.active_total ?? null,
	);
	const isUserLimitReached = useDashboard((state) => state.isUserLimitReached);
	const editingUserInitialTab = useDashboard(
		(state) => state.editingUserInitialTab,
	);

	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const { userData, getUserIsSuccess } = useGetUser();

	const isEditing = !!editingUser;
	const isOpen = isCreatingNewUser || isEditing;
	const limitReached = isUserLimitReached && !isEditing;

	const [initialValues] = useState<FormType>(() =>
		editingUser ? formatUserToForm(editingUser) : getDefaultUserFormValues(),
	);
	const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
	const [loading, setLoading] = useState(false);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [randomUsernameLoading, setRandomUsernameLoading] = useState(false);
	const [otherInfoOpen, setOtherInfoOpen] = useState(false);
	const [autoRenewOpen, setAutoRenewOpen] = useState(false);

	const {
		closeTimerRef: successCloseTimerRef,
		clearSubmitTimers,
		showSubmitError,
	} = useSubmitTimers(setSubmitStatus);
	const syncedUserRef = useRef(editingUser);
	const bodyRef = useRef<HTMLDivElement>(null);

	const scrollBodyToEnd = () => {
		window.requestAnimationFrame(() =>
			bodyRef.current?.scrollTo({
				top: bodyRef.current.scrollHeight,
				behavior: "smooth",
			}),
		);
	};

	const formSchema = useMemo(() => buildUserDialogSchema(isEditing), [isEditing]);
	const { data: knownUserTags = [] } = useTags("user");
	const invalidateLabels = useInvalidateLabels();

	const form = useForm<FormType>({
		defaultValues: initialValues,
		resolver: zodResolver(
			formSchema as unknown as Parameters<typeof zodResolver>[0],
		) as unknown as Resolver<FormType>,
		mode: "onChange",
		reValidateMode: "onChange",
	});

	const manualKeyEntryEnabled = useWatch({
		control: form.control,
		name: "manual_key_entry",
	});
	const usernameValue = useWatch({ control: form.control, name: "username" });
	const [dataLimit, userStatus, expireValue] = useWatch({
		control: form.control,
		name: ["data_limit", "status", "expire"],
	});
	const isOnHold = userStatus === "on_hold";
	const hasExistingKey = Boolean(editingUser?.credential_key);

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
			Boolean(
				userData.permissions?.users?.[UserPermissionToggle.ManageSpeedLimit],
			));
	const ipLimitEditable =
		userData.role === AdminRole.FullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ManageIPLimit]);
	const canViewTraffic = canViewUserTraffic(
		userData,
		editingUser?.service_id ?? null,
	);

	const rawServices = useServicesStore((state) => state.serviceOptions);
	const services = Array.isArray(rawServices) ? rawServices : [];
	const servicesLoading = useServicesStore((state) => state.isOptionsLoading);
	const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
		editingUser?.service_id ?? null,
	);
	const selectedService =
		services.find((service) => service.id === selectedServiceId) ?? null;
	const nonSudoSingleService = !hasPrivilegedRole && services.length === 1;
	const effectiveServiceId = isEditing
		? (editingUser?.service_id ?? null)
		: (selectedServiceId ??
			(nonSudoSingleService ? (services[0]?.id ?? null) : null));
	const userManagementLocked = isUserManagementLocked(
		userData,
		effectiveServiceId,
	);
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

	const autoRenew = useUserDialogAutoRenew({
		initialValues,
		form,
		setAutoRenewOpen,
		setError,
		scrollBodyToEnd,
	});

	const usageState = useUserDialogUsage({
		editingUser: editingUser ?? null,
		isEditing,
		canViewTraffic,
		editingUserInitialTab,
	});

	const linksState = useUserDialogLinks(editingUser ?? null);

	const expireHelperText = useMemo(() => {
		if (!expireValue) return null;
		const { status, time } = relativeExpiryDate(expireValue);
		return t(status, { time });
	}, [expireValue, t]);

	const remainingDataInfo = useMemo(() => {
		if (!isEditing || !editingUser || !canViewTraffic) return null;
		const parsedLimit = parseDecimalInput(dataLimit);
		if (!parsedLimit || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
			return t("userDialog.remainingDataUnlimited");
		}
		const remainingBytes = Math.max(
			parsedLimit * BYTES_PER_GB - (editingUser.used_traffic ?? 0),
			0,
		);
		return remainingBytes <= 0
			? t("userDialog.remainingDataLimited")
			: formatBytes(remainingBytes, 2);
	}, [canViewTraffic, isEditing, editingUser, dataLimit, t]);

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

	const quickExpiryOptions = [
		{ label: t("userDialog.quickSelectOneMonth"), amount: 1, unit: "month" },
		{ label: t("userDialog.quickSelectThreeMonths"), amount: 3, unit: "month" },
		{ label: t("userDialog.quickSelectOneYear"), amount: 1, unit: "year" },
	] as const;

	useEffect(() => {
		if (isOpen) useServicesStore.getState().fetchServiceOptions({ limit: 1000 });
	}, [isOpen]);

	useEffect(() => {
		if (isEditing) {
			setSelectedServiceId(editingUser?.service_id ?? services[0]?.id ?? null);
			return;
		}
		if (!hasPrivilegedRole && services[0]) {
			setSelectedServiceId((current) => current ?? services[0].id);
		}
	}, [isEditing, editingUser, services, hasPrivilegedRole]);

	const syncEditingUser = autoRenew.syncFromFormValues;
	useEffect(() => {
		if (
			!editingUser ||
			editingUser === syncedUserRef.current ||
			typeof editingUser.username !== "string"
		) {
			return;
		}
		syncedUserRef.current = editingUser;
		const next = formatUserToForm(editingUser);
		form.reset(next);
		syncEditingUser(next);
		setSelectedServiceId(editingUser.service_id ?? null);
	}, [editingUser, form, syncEditingUser]);

	useEffect(() => {
		if (!canSetCustomKey) {
			form.setValue("manual_key_entry", false, { shouldDirty: true });
			form.setValue("credential_key", null, { shouldDirty: true });
		}
	}, [canSetCustomKey, form]);

	const onClose = () => {
		clearSubmitTimers();
		onCreateUser(false);
		onEditingUser(null);
	};

	const applyApiError = (err: unknown) => {
		const response = (
			err as { response?: { status?: number; _data?: { detail?: unknown } } }
		)?.response;
		if (response?.status === 409 || response?.status === 400) {
			setError(response._data?.detail as string);
		}
		if (
			response?.status === 422 &&
			response._data?.detail &&
			typeof response._data.detail === "object"
		) {
			Object.entries(
				response._data.detail as Record<string, string>,
			).forEach(([key, message]) => {
				setError(message);
				form.setError(
					key as "username" | "data_limit" | "expire" | "service_id",
					{ type: "custom", message },
				);
			});
		}
		setLoading(false);
		showSubmitError();
	};

	const submit = (values: FormType) => {
		if (submitStatus !== "idle") return;
		setLoading(true);
		setSubmitStatus("loading");
		setError(null);

		const failSubmit = (message?: string) => {
			if (message) setError(message);
			setLoading(false);
			showSubmitError();
		};

		if (
			usersLimit &&
			usersLimit > 0 &&
			activeUsersCount !== null &&
			activeUsersCount >= usersLimit
		) {
			failSubmit(
				t("userDialog.usersLimitReached", {
					active: activeUsersCount,
					limit: usersLimit,
				}),
			);
			return;
		}
		if (limitReached || userManagementLocked) {
			failSubmit();
			return;
		}

		const {
			service_id: _serviceId,
			next_plan_enabled,
			next_plan_data_limit,
			next_plan_expire,
			next_plan_add_remaining_traffic,
			next_plan_fire_on_either,
			flow: _flow,
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

		const maxDataLimitPerUser =
			userData?.permissions?.users?.max_data_limit_per_user;
		const allowUnlimitedData =
			hasFullAccess ||
			Boolean(
				userData?.permissions?.users?.[UserPermissionToggle.AllowUnlimitedData],
			);
		const dataLimitBytes = data_limit || 0;
		const setDataLimitError = (message: string) => {
			form.setError("data_limit", { type: "manual", message });
			failSubmit(message);
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
			if (dataLimitBytes === 0 && !allowUnlimitedData) {
				setDataLimitError(
					t("userDialog.unlimitedNotAllowed", {
						max: (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2),
					}),
				);
				return;
			}
			if (dataLimitBytes > 0 && dataLimitBytes > maxDataLimitPerUser) {
				setDataLimitError(
					t("userDialog.dataLimitExceedsMax", {
						original: (dataLimitBytes / BYTES_PER_GB).toFixed(2),
						max: (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2),
					}),
				);
				return;
			}
		}

		const minDataLimitPerUser =
			userData?.permissions?.users?.min_data_limit_per_user;
		const dataLimitUnchanged =
			isEditing && (editingUser?.data_limit ?? 0) === dataLimitBytes;
		if (
			minDataLimitPerUser &&
			dataLimitBytes > 0 &&
			dataLimitBytes < minDataLimitPerUser &&
			!dataLimitUnchanged
		) {
			setDataLimitError(
				t("userDialog.dataLimitBelowMin", {
					min: (minDataLimitPerUser / BYTES_PER_GB).toFixed(2),
				}),
			);
			return;
		}

		const normalizedNextPlanDataLimit =
			next_plan_enabled && next_plan_data_limit && next_plan_data_limit > 0
				? gigabytesToBytes(Number(next_plan_data_limit))
				: 0;
		const setNextPlanError = (message: string) => {
			form.setError("next_plan_data_limit", { type: "manual", message });
			failSubmit(message);
		};
		if (maxDataLimitPerUser !== null && maxDataLimitPerUser !== undefined) {
			if (
				normalizedNextPlanDataLimit > 0 &&
				normalizedNextPlanDataLimit > maxDataLimitPerUser
			) {
				setNextPlanError(
					t("userDialog.nextPlanDataLimitExceedsMax", {
						original: (normalizedNextPlanDataLimit / BYTES_PER_GB).toFixed(2),
						max: (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2),
					}),
				);
				return;
			}
			if (
				normalizedNextPlanDataLimit === 0 &&
				next_plan_enabled &&
				!allowUnlimitedData
			) {
				setNextPlanError(
					t("userDialog.nextPlanUnlimitedNotAllowed", {
						max: (maxDataLimitPerUser / BYTES_PER_GB).toFixed(2),
					}),
				);
				return;
			}
		}

		if (
			minDataLimitPerUser &&
			normalizedNextPlanDataLimit > 0 &&
			normalizedNextPlanDataLimit < minDataLimitPerUser
		) {
			setNextPlanError(
				t("userDialog.nextPlanDataLimitBelowMin", {
					min: (minDataLimitPerUser / BYTES_PER_GB).toFixed(2),
				}),
			);
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
			typeof ip_limit === "number" &&
			Number.isFinite(ip_limit) &&
			ip_limit > 0
				? Math.floor(ip_limit)
				: 0;
		const normalizedStatus =
			status === "active" || status === "disabled" || status === "on_hold"
				? status
				: "active";

		if (!isEditing) {
			const createServiceId = hasPrivilegedRole
				? selectedServiceId
				: (selectedServiceId ??
					(nonSudoSingleService ? (services[0]?.id ?? null) : null));
			if (!createServiceId) {
				failSubmit(t("userDialog.selectService"));
				return;
			}

			const serviceBody: UserCreateWithService = {
				username: values.username,
				service_id: createServiceId,
				note: values.note,
				telegram_id: values.telegram_id,
				contact_number: values.contact_number,
				group_id: values.group_id,
				tags: values.tags,
				status: normalizedStatus,
				expire: values.expire,
				data_limit: values.data_limit,
				ip_limit: normalizedIpLimit,
				speed_limit_kbps: normalizedSpeedLimitKbps,
				data_limit_reset_strategy:
					data_limit && data_limit > 0 ? data_limit_reset_strategy : "no_reset",
				on_hold_expire_duration:
					status === "on_hold" ? on_hold_expire_duration : null,
			};
			if (canSetCustomKey && manual_key_entry && credential_key) {
				serviceBody.credential_key = credential_key;
			}
			if (nextPlanPayload) serviceBody.next_plans = [nextPlanPayload];

			createUserWithService(serviceBody)
				.then(() => {
					void invalidateLabels();
					setSubmitStatus("success");
					const qrUserPromise = linksState.fetchUserForQr(values.username);
					toast.success(
						t("userDialog.userCreated", { username: values.username }),
						{ duration: 3000 },
					);
					successCloseTimerRef.current = window.setTimeout(() => {
						onClose();
						successCloseTimerRef.current = null;
						qrUserPromise.then((qrUser) => {
							window.setTimeout(() => linksState.openUserQrDialog(qrUser), 0);
						});
					}, SUCCESS_CLOSE_DELAY_MS);
				})
				.catch(applyApiError);
			return;
		}

		if (!selectedServiceId) {
			failSubmit(t("userDialog.selectService"));
			return;
		}

		const body: Record<string, unknown> = {
			...rest,
			data_limit,
			ip_limit: normalizedIpLimit,
			speed_limit_kbps: normalizedSpeedLimitKbps,
			status: normalizedStatus,
			on_hold_expire_duration:
				status === "on_hold" ? on_hold_expire_duration : null,
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
		} else if (!next_plan_enabled && (editingUser?.next_plans?.length ?? 0) > 0) {
			body.next_plans = [];
		}
		if (
			selectedServiceId !== editingUser?.service_id &&
			(!requiresServiceScope || !editingUser?.service_id)
		) {
			body.service_id = selectedServiceId;
		}

		editUser(editingUser?.username, body as UserCreate)
			.then(() => {
				void invalidateLabels();
				setSubmitStatus("success");
				toast.success(
					t("userDialog.userEdited", { username: values.username }),
					{ duration: 3000 },
				);
				successCloseTimerRef.current = window.setTimeout(() => {
					onClose();
					successCloseTimerRef.current = null;
				}, SUCCESS_CLOSE_DELAY_MS);
			})
			.catch(applyApiError);
	};

	const handleResetUsage = () => {
		if (!canResetUsageVisible) return;
		useDashboard.setState({
			resetUsageUser: (editingUser as unknown as UserListItem) ?? null,
		});
	};

	const handleRevokeSubscription = () => {
		if (!canRevokeSubscriptionVisible) return;
		useDashboard.setState({
			revokeSubscriptionUser: (editingUser as unknown as UserListItem) ?? null,
		});
	};

	const handleDeleteUser = async () => {
		if (!canDeleteUsersVisible || !editingUser) return;
		setDeleteLoading(true);
		try {
			await deleteUser(editingUser as unknown as UserListItem);
			toast.success(
				t("deleteUser.deleteSuccess", { username: editingUser.username }),
				{ duration: 3000 },
			);
			onClose();
		} finally {
			setDeleteLoading(false);
		}
	};

	const createRandomUsername = () => {
		setRandomUsernameLoading(true);
		const characters =
			"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
		let result = "";
		for (let counter = 0; counter < 6; counter += 1) {
			result += characters.charAt(
				Math.floor(Math.random() * characters.length),
			);
		}
		form.setValue("username", result, {
			shouldDirty: true,
			shouldValidate: true,
		});
		form.trigger("username");
		window.setTimeout(() => setRandomUsernameLoading(false), 350);
	};

	const disabled = loading || limitReached || userManagementLocked;
	const serviceSelectionDisabled =
		disabled || (isEditing && requiresServiceScope);
	const submitDisabled = disabled || !form.formState.isValid;
	const title = isEditing
		? `${t("userDialog.editUserTitle")}${editingUser?.username ? ` ${editingUser.username}` : ""}`
		: t("createNewUser");
	const dataLimitSet = Boolean(dataLimit && Number(dataLimit) > 0);

	const toggleOnHold = () => {
		if (isOnHold) {
			form.setValue("status", "active", { shouldDirty: true });
			form.setValue("on_hold_expire_duration", null, { shouldDirty: true });
		} else {
			form.setValue("status", "on_hold", { shouldDirty: true });
			form.setValue("expire", null, { shouldDirty: true });
		}
	};

	return {
		editingUser,
		isCreatingNewUser,
		isOpen,
		isEditing,
		isRTL,
		loading,
		deleteLoading,
		submitStatus,
		submitDisabled,
		disabled,
		serviceSelectionDisabled,
		limitReached,
		usersLimit,
		activeUsersCount,
		title,
		hasPrivilegedRole,
		canViewTraffic,
		canDeleteUsersVisible,
		canResetUsageVisible,
		canRevokeSubscriptionVisible,
		form,
		submit,
		onClose,
		bodyRef,
		scrollBodyToEnd,
		statusNotice,
		isServiceManagedUser,
		userManagementLocked,
		showServiceSelector,
		servicesLoading,
		services,
		selectedServiceId,
		selectedService,
		setSelectedServiceId,
		usernameValue,
		randomUsernameLoading,
		createRandomUsername,
		userStatus,
		ipLimitEditable,
		speedLimitEditable,
		remainingDataInfo,
		dataLimitSet,
		isOnHold,
		expireHelperText,
		quickExpiryOptions,
		toggleOnHold,
		canConfigurePeriodicUsageReset,
		hasExistingKey,
		canSetCustomKey,
		manualKeyEntryEnabled,
		autoRenewOpen,
		setAutoRenewOpen,
		otherInfoOpen,
		setOtherInfoOpen,
		knownUserTags: knownUserTags.map((item) => item.tag),
		error,
		handleDeleteUser,
		handleResetUsage,
		handleRevokeSubscription,
		...autoRenew,
		...usageState,
		...linksState,
	};
};

import { useToast } from "components/shadcn/toast";
import { useDisclosure } from "hooks/useDisclosure";
import { Button, IconButton } from "components/shadcn/button";
import { Collapse } from "components/shadcn/collapse";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Tooltip } from "components/shadcn/tooltip";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Input, InputGroup, InputRightElement, Textarea } from "components/shadcn/input";
import { withClass } from "components/shadcn/icon";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import {
	AdjustmentsHorizontalIcon,
	ArrowPathIcon,
	ChevronRightIcon,
	KeyIcon,
	PencilIcon,
	PlayIcon,
	PlusCircleIcon,
	ShieldCheckIcon,
	TrashIcon,
} from "@heroicons/react/24/outline";
import { NoSymbolIcon } from "@heroicons/react/24/solid";
import type { SortingState } from "@tanstack/react-table";
import classNames from "classnames";
import { useAdminsStore } from "contexts/AdminsContext";
import { useContainerMinWidths } from "hooks/useContainerMinWidths";
import useGetUser from "hooks/useGetUser";
import {
	type FC,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import type { Admin } from "types/Admin";
import {
	AdminManagementPermission,
	AdminRole,
	AdminStatus,
	AdminTrafficLimitMode,
} from "types/Admin";
import { formatBytes } from "utils/formatByte";
import { summarizeAdmins } from "utils/resourceSummary";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import { copyTextToClipboard } from "utils/clipboard";
import { AdminApiKeysDialog } from "./AdminApiKeysDialog";
import { AdminDetailsPanel } from "./AdminDetailsPanel";
import AdminPermissionsModal from "./AdminPermissionsModal";
import { AdminSecurityDialog } from "./AdminSecurityDialog";
import { ConfirmDialog } from "./dialogs/ConfirmDialog";
import { UserExpiryCountdown, UserUsageBar } from "./users";
import {
	DataTable,
	ResourceListCard,
	type DataTableColumn,
	type DataTableRowAction,
} from "./ui";

const ADMIN_DATA_LIMIT_EXHAUSTED_REASON_KEY = "admin_data_limit_exhausted";
const ADMIN_TIME_LIMIT_EXHAUSTED_REASON_KEY = "admin_time_limit_exhausted";
const ADMIN_TRAFFIC_OPTIONS = [
	{ label: "100GB", gigabytes: 100 },
	{ label: "500GB", gigabytes: 500 },
	{ label: "1TB", gigabytes: 1024 },
	{ label: "2TB", gigabytes: 2048 },
	{ label: "5TB", gigabytes: 5120 },
];

const QUICK_ACTIONS_MIN_TABLE_WIDTH = 1250;
const SPEED_MIN_TABLE_WIDTH = 1100;
type AdminSpeedMap = Record<
	string,
	{ upload_speed: number; download_speed: number }
>;

const QUICK_ACTION_IDS = [
	"edit",
	"permissions",
	"enable",
	"disable",
	"delete",
];

const ResetIcon = withClass(ArrowPathIcon, "[stroke-width:2px] w-3 h-3");
const DisableIcon = withClass(NoSymbolIcon, "[stroke-width:2px] w-3 h-3");
const EnableIcon = withClass(PlayIcon, "[stroke-width:2px] w-3 h-3");
const DeleteIcon = withClass(TrashIcon, "[stroke-width:2px] w-3 h-3");
const QuickPassIcon = withClass(KeyIcon, "[stroke-width:2px] w-3 h-3");
const AddDataIcon = withClass(PlusCircleIcon, "[stroke-width:2px] w-3 h-3");

const AdminStatusBadge: FC<{ status: AdminStatus }> = ({ status }) => {
	const { t } = useTranslation();

	return (
		<p className={cn("text-[0.875rem] font-semibold capitalize", status === AdminStatus.Active ? "text-green-400" : "text-red-400")}>
			{status === AdminStatus.Active
				? t("status.active")
				: t("admins.disabledLabel")}
		</p>
	);
};

const AdminRoleBadge: FC<{ role: AdminRole }> = ({ role }) => {
	const { t } = useTranslation();
	const roleStyles = {
		[AdminRole.FullAccess]: {
			color: "text-yellow-800",
			darkColor: "dark:text-yellow-200",
			label: t("admins.roles.fullAccess"),
		},
		[AdminRole.Sudo]: {
			color: "text-purple-800",
			darkColor: "dark:text-purple-200",
			label: t("admins.roles.sudo"),
		},
		[AdminRole.Reseller]: {
			color: "text-blue-800",
			darkColor: "dark:text-blue-200",
			label: t("admins.roles.reseller"),
		},
		[AdminRole.Standard]: {
			color: "text-gray-800",
			darkColor: "dark:text-gray-200",
			label: t("admins.roles.standard"),
		},
	}[role];

	return (
		<span className={cn(roleStyles.color, roleStyles.darkColor, "text-[0.75rem] font-medium")}>
			{roleStyles.label}
		</span>
	);
};

const formatCount = (value: number | null | undefined, locale: string) =>
	new Intl.NumberFormat(locale || "en").format(value ?? 0);

const getAdminEffectiveUsage = (admin: Admin) =>
	admin.traffic_limit_mode === AdminTrafficLimitMode.CreatedTraffic
		? (admin.created_traffic ?? 0)
		: (admin.users_usage ?? 0);

const getAdminIsExpired = (admin: Admin, nowUnix: number) =>
	admin.disabled_reason === ADMIN_TIME_LIMIT_EXHAUSTED_REASON_KEY ||
	(typeof admin.expire === "number" &&
		admin.expire > 0 &&
		admin.expire <= nowUnix);

const getAdminIsLimited = (admin: Admin) =>
	admin.disabled_reason === ADMIN_DATA_LIMIT_EXHAUSTED_REASON_KEY ||
	(admin.data_limit !== null &&
		admin.data_limit !== undefined &&
		admin.data_limit > 0 &&
		getAdminEffectiveUsage(admin) >= admin.data_limit);

type AdminsTableProps = ComponentPropsWithoutRef<"table"> & {
	toolbar?: ReactNode;
	footerActions?: ReactNode;
};

export const AdminsTable: FC<AdminsTableProps> = ({
	toolbar,
	footerActions,
	...props
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const locale = i18n.language || "en";
	const toast = useToast();
	const { userData } = useGetUser();
	const dialogBg = "bg-surface-light dark:bg-surface-dark";
	const dialogBorderColor = "border-light-border! dark:border-gray-700!";
	const inlineMenuBg = "bg-blackAlpha-50 dark:bg-whiteAlpha-50";
	const adminOptions = useAdminsStore((state) => state.adminOptions);
	const admins = useAdminsStore((state) => state.admins);
	const loading = useAdminsStore((state) => state.loading);
	const total = useAdminsStore((state) => state.total);
	const filters = useAdminsStore((state) => state.filters);
	const fetchAdmins = useAdminsStore((state) => state.fetchAdmins);
	const deleteAdmin = useAdminsStore((state) => state.deleteAdmin);
	const resetUsage = useAdminsStore((state) => state.resetUsage);
	const resetDeletedUsersUsage = useAdminsStore(
		(state) => state.resetDeletedUsersUsage,
	);
	const disableAdmin = useAdminsStore((state) => state.disableAdmin);
	const enableAdmin = useAdminsStore((state) => state.enableAdmin);
	const fetchAdminOptions = useAdminsStore((state) => state.fetchAdminOptions);
	const updateAdmin = useAdminsStore((state) => state.updateAdmin);
	const openAdminDialog = useAdminsStore((state) => state.openAdminDialog);
	const {
		isOpen: isDisableDialogOpen,
		onOpen: openDisableDialog,
		onClose: closeDisableDialog,
	} = useDisclosure();
	const {
		isOpen: isDeleteDialogOpen,
		onOpen: openDeleteDialog,
		onClose: closeDeleteDialog,
	} = useDisclosure();
	const {
		isOpen: isPermissionsModalOpen,
		onOpen: openPermissionsModal,
		onClose: closePermissionsModal,
	} = useDisclosure();
	const [adminToDisable, setAdminToDisable] = useState<Admin | null>(null);
	const [adminToDelete, setAdminToDelete] = useState<Admin | null>(null);
	const [disableReason, setDisableReason] = useState("");
	const [actionState, setActionState] = useState<{
		type:
			| "reset"
			| "resetDeleted"
			| "disableAdmin"
			| "enableAdmin"
			| "quickPassword"
			| "deleteAdmin";
		username: string;
	} | null>(null);
	const [adminForPermissions, setAdminForPermissions] = useState<Admin | null>(
		null,
	);
	const [contextAction, setContextAction] = useState<string | null>(null);
	const [openTrafficMenuFor, setOpenTrafficMenuFor] = useState<string | null>(
		null,
	);
	const [quickPassInfo, setQuickPassInfo] = useState<{
		username: string;
		password: string;
	} | null>(null);
	const [selectedAdminUsernames, setSelectedAdminUsernames] = useState<
		string[]
	>([]);
	const {
		isOpen: isQuickPassOpen,
		onOpen: openQuickPassModal,
		onClose: closeQuickPassModal,
	} = useDisclosure();
	const {
		isOpen: isQuickPassConfirmOpen,
		onOpen: openQuickPassConfirm,
		onClose: closeQuickPassConfirm,
	} = useDisclosure();
	const [quickPassAdmin, setQuickPassAdmin] = useState<Admin | null>(null);
	const [resetConfirmation, setResetConfirmation] = useState<{
		admin: Admin;
		type: "usage" | "deleted";
	} | null>(null);
	const [securityAdmin, setSecurityAdmin] = useState<Admin | null>(null);
	const securityDialog = useDisclosure();
	const [apiKeysAdmin, setAPIKeysAdmin] = useState<Admin | null>(null);
	const apiKeysDialog = useDisclosure();

	const currentAdminUsername = userData.username;
	const hasFullAccess = userData.role === AdminRole.FullAccess;
	const canManageAPIKeys = hasFullAccess || userData.role === AdminRole.Sudo;
	const adminManagement = userData.permissions?.admin_management;
	const canEditAdmins = Boolean(
		adminManagement?.[AdminManagementPermission.Edit] || hasFullAccess,
	);
	const canManageSudoAdmins = Boolean(
		adminManagement?.[AdminManagementPermission.ManageSudo] || hasFullAccess,
	);
	const canManageSessions = Boolean(
		adminManagement?.[AdminManagementPermission.ManageSessions] ||
			hasFullAccess,
	);
	const canManage2FA = Boolean(
		adminManagement?.[AdminManagementPermission.Manage2FA] || hasFullAccess,
	);
	const canManageSecurityFor = (target: Admin) => {
		if (hasFullAccess) return true;
		if (target.role === AdminRole.FullAccess) return false;
		if (target.role === AdminRole.Sudo && !canManageSudoAdmins) return false;
		return canManageSessions || canManage2FA;
	};
	const canManageAPIKeysFor = (target: Admin) =>
		canManageAPIKeys && target.role !== AdminRole.FullAccess;
	const canManageAdminAccount = (target: Admin) => {
		if (target.username === currentAdminUsername) {
			return true;
		}
		if (target.role === AdminRole.FullAccess) {
			return false;
		}
		if (!canEditAdmins) {
			return false;
		}
		if (target.role === AdminRole.Sudo) {
			return canManageSudoAdmins;
		}
		return true;
	};
	const visibleAdminUsernameSet = useMemo(
		() => new Set(admins.map((admin) => admin.username)),
		[admins],
	);
	const selectedAdmins = useMemo(
		() =>
			admins.filter((admin) => selectedAdminUsernames.includes(admin.username)),
		[admins, selectedAdminUsernames],
	);

	useEffect(() => {
		setSelectedAdminUsernames((current) =>
			current.filter((username) => visibleAdminUsernameSet.has(username)),
		);
	}, [visibleAdminUsernameSet]);

	const handleDeleteAdmin = async (admin: Admin) => {
		try {
			await deleteAdmin(admin.username);
			generateSuccessMessage(t("admins.deleteSuccess"), toast);
			fetchAdmins();
			return true;
		} catch (error) {
			generateErrorMessage(error, toast);
			return false;
		}
	};

	const runResetUsage = async (admin: Admin) => {
		setActionState({ type: "reset", username: admin.username });
		try {
			await resetUsage(admin.username);
			generateSuccessMessage(t("admins.resetUsageSuccess"), toast);
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setActionState(null);
		}
	};

	const runResetDeletedUsersUsage = async (admin: Admin) => {
		setActionState({ type: "resetDeleted", username: admin.username });
		try {
			await resetDeletedUsersUsage(admin.username);
			generateSuccessMessage(t("admins.resetDeletedUsageSuccess"), toast);
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setActionState(null);
		}
	};

	const confirmUsageReset = async () => {
		if (!resetConfirmation) return;
		if (resetConfirmation.type === "deleted") {
			await runResetDeletedUsersUsage(resetConfirmation.admin);
		} else {
			await runResetUsage(resetConfirmation.admin);
		}
		setResetConfirmation(null);
	};

	const startDisableAdmin = (admin: Admin) => {
		setAdminToDisable(admin);
		setDisableReason("");
		openDisableDialog();
	};

	const closeDisableDialogAndReset = () => {
		closeDisableDialog();
		setAdminToDisable(null);
		setDisableReason("");
	};

	const handleOpenPermissionsModal = (admin: Admin) => {
		setAdminForPermissions(admin);
		openPermissionsModal();
	};

	const handleClosePermissionsModal = () => {
		setAdminForPermissions(null);
		closePermissionsModal();
	};

	const closeContextMenu = useCallback(() => {
		setOpenTrafficMenuFor(null);
	}, []);
	const closeDeleteDialogAndReset = () => {
		closeDeleteDialog();
		setAdminToDelete(null);
	};
	const startDeleteAdmin = (admin: Admin) => {
		setAdminToDelete(admin);
		openDeleteDialog();
		closeContextMenu();
	};
	const confirmDeleteAdmin = async () => {
		if (!adminToDelete) {
			return;
		}
		setActionState({ type: "deleteAdmin", username: adminToDelete.username });
		try {
			const deleted = await handleDeleteAdmin(adminToDelete);
			if (deleted) {
				closeDeleteDialogAndReset();
			}
		} finally {
			setActionState(null);
		}
	};
	const handleCloseQuickPass = () => {
		setQuickPassInfo(null);
		closeQuickPassModal();
	};

	useEffect(() => {
		fetchAdminOptions(undefined, { force: false });
	}, [fetchAdminOptions]);

	const handleAddDataLimit = async (
		admin: Admin,
		gigabytes: number,
		onDone?: () => void,
	) => {
		if (
			admin.data_limit === null ||
			admin.data_limit === 0 ||
			admin.data_limit === undefined
		) {
			return;
		}
		setContextAction(`addData-${gigabytes}`);
		const delta = gigabytes * 1024 * 1024 * 1024;
		const nextLimit = admin.data_limit + delta;
		try {
			await updateAdmin(admin.username, { data_limit: nextLimit });
			generateSuccessMessage(t("admins.addTrafficSuccess"), toast);
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setContextAction(null);
			onDone?.();
			closeContextMenu();
		}
	};

	const generateRandomPassword = (length = 12) => {
		const characters =
			"ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
		const charactersLength = characters.length;
		let result = "";
		for (let i = 0; i < length; i += 1) {
			const randomIndex = Math.floor(Math.random() * charactersLength);
			result += characters[randomIndex];
		}
		return result;
	};

	const confirmDisableAdmin = async () => {
		if (!adminToDisable) {
			return;
		}
		const reason = disableReason.trim();
		if (reason.length < 3) {
			return;
		}
		setActionState({ type: "disableAdmin", username: adminToDisable.username });
		try {
			await disableAdmin(adminToDisable.username, reason);
			generateSuccessMessage(t("admins.disableAdminSuccess"), toast);
			closeDisableDialogAndReset();
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setActionState(null);
		}
	};

	const handleQuickPassword = async (admin: Admin) => {
		if (!canManageAdminAccount(admin)) {
			return;
		}
		setQuickPassAdmin(admin);
		closeContextMenu();
		openQuickPassConfirm();
	};

	const confirmQuickPassword = async () => {
		if (!quickPassAdmin) return;
		setContextAction("quickPassword");
		const newPassword = generateRandomPassword(12);
		try {
			await updateAdmin(quickPassAdmin.username, { password: newPassword });
			setQuickPassInfo({
				username: quickPassAdmin.username,
				password: newPassword,
			});
			closeQuickPassConfirm();
			setQuickPassAdmin(null);
			openQuickPassModal();
			generateSuccessMessage(t("admins.quickPasswordSuccess"), toast);
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setContextAction(null);
		}
	};

	const handleEnableAdmin = async (admin: Admin) => {
		setActionState({ type: "enableAdmin", username: admin.username });
		try {
			await enableAdmin(admin.username);
			generateSuccessMessage(t("admins.enableAdminSuccess"), toast);
			fetchAdmins();
		} catch (error) {
			generateErrorMessage(error, toast);
		} finally {
			setActionState(null);
		}
	};
	const getAdminRowMeta = (admin: Admin) => {
		const canManage = canManageAdminAccount(admin);
		const canChangeStatus =
			canManage && admin.username !== currentAdminUsername;
		const hasDataLimitDisabledReason =
			admin.disabled_reason === ADMIN_DATA_LIMIT_EXHAUSTED_REASON_KEY;
		const hasTimeLimitDisabledReason =
			admin.disabled_reason === ADMIN_TIME_LIMIT_EXHAUSTED_REASON_KEY;
		const disabledReasonLabel = admin.disabled_reason
			? hasDataLimitDisabledReason
				? t("admins.disabledReason.dataLimitExceeded")
				: hasTimeLimitDisabledReason
					? t("admins.disabledReason.timeLimitExceeded")
					: admin.disabled_reason
			: null;
		return {
			canManage,
			showDisable: canChangeStatus && admin.status !== AdminStatus.Disabled,
			showEnable:
				canChangeStatus &&
				admin.status === AdminStatus.Disabled &&
				!hasDataLimitDisabledReason &&
				!hasTimeLimitDisabledReason,
			showDelete: canChangeStatus,
			showAddTraffic:
				canManage &&
				admin.data_limit !== null &&
				admin.data_limit !== 0 &&
				admin.data_limit !== undefined,
			hasDataLimitDisabledReason,
			hasTimeLimitDisabledReason,
			disabledReasonLabel,
		};
	};
	const renderAddTrafficSubmenu = (admin: Admin, onDone?: () => void) => {
		const isOpen = openTrafficMenuFor === admin.username;
		const closeAfterSelection = () => {
			setOpenTrafficMenuFor(null);
			onDone?.();
		};
		return (
			<div>
				<Button size="md" variant="ghost" loading={contextAction?.startsWith("addData-")} disabled={contextAction?.startsWith("addData-")} aria-expanded={isOpen} onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setOpenTrafficMenuFor((current) =>
							current === admin.username ? null : admin.username,
						);
					}} className="justify-start w-full">
					<div className="flex flex-row items-center w-full justify-between gap-3">
						<div className="flex flex-row items-center gap-2 min-w-0!">
							<AddDataIcon />
							<span className="truncate">
								{t("services.userActions.traffic.add")}
							</span>
						</div>
						<ChevronRightIcon style={{
								flexShrink: 0,
								transform: isOpen
									? "rotate(90deg)"
									: isRTL
										? "rotate(180deg)"
										: undefined,
								transition: "transform 0.15s ease",
							}} className="w-[14px]" />
					</div>
				</Button>
				<Collapse in={isOpen} unmountOnExit>
					<div className={cn("grid grid-cols-2 sm:grid-cols-3 gap-1 mt-1 p-2 border rounded-md", inlineMenuBg, dialogBorderColor)}>
						{ADMIN_TRAFFIC_OPTIONS.map((option) => (
							<Button key={option.label} size="sm" variant="ghost" onClick={(event) => {
									event.stopPropagation();
									handleAddDataLimit(
										admin,
										option.gigabytes,
										closeAfterSelection,
									);
								}} loading={contextAction === `addData-${option.gigabytes}`} disabled={contextAction?.startsWith("addData-")} className="justify-center">
								{option.label}
							</Button>
						))}
					</div>
				</Collapse>
			</div>
		);
	};
	const { className, ...restProps } = props;
	const baseTableSx: Record<string, unknown> = {
		width: "100%",
		"& th, & .rb-data-table-row > td": {
			whiteSpace: "nowrap",
			paddingInline: "clamp(6px, 0.8vw, 14px) !important",
			verticalAlign: "middle",
		},
		"& th.rb-select-cell, & td.rb-select-cell, & th.rb-actions-cell, & td.rb-actions-cell":
			{
				paddingInline: "4px !important",
			},
		"& th[data-col='quick_actions'], & td[data-col='quick_actions']": {
			paddingInlineEnd: "0px !important",
		},
	};
	const tableClassName = isRTL
		? classNames(className, "rb-rtl-table")
		: className;
	const tableProps = {
		...restProps,
		className: tableClassName,
		sx: { ...baseTableSx },
	};

	const summaryData = useMemo(() => {
		const hasCompleteSummary =
			adminOptions.length > 0 || total <= admins.length;
		const summaryAdmins = hasCompleteSummary
			? adminOptions.length
				? adminOptions
				: admins
			: [];
		const nowUnix = Math.floor(Date.now() / 1000);
		const expiredCount = summaryAdmins.filter((admin) =>
			getAdminIsExpired(admin, nowUnix),
		).length;
		const limitedCount = summaryAdmins.filter(
			(admin) => !getAdminIsExpired(admin, nowUnix) && getAdminIsLimited(admin),
		).length;
		const totals = hasCompleteSummary ? summarizeAdmins(summaryAdmins) : null;
		return {
			totalCount: adminOptions.length || total,
			usersTotal: totals ? totals.users : null,
			onlineUsersTotal: totals ? totals.online : null,
			usageTotal: totals ? totals.usage : null,
			fullAccessCount: hasCompleteSummary
				? summaryAdmins.filter((admin) => admin.role === AdminRole.FullAccess)
						.length
				: null,
			sudoCount: hasCompleteSummary
				? summaryAdmins.filter((admin) => admin.role === AdminRole.Sudo).length
				: null,
			resellerCount: hasCompleteSummary
				? summaryAdmins.filter((admin) => admin.role === AdminRole.Reseller)
						.length
				: null,
			standardCount: hasCompleteSummary
				? summaryAdmins.filter((admin) => admin.role === AdminRole.Standard)
						.length
				: null,
			activeCount: hasCompleteSummary
				? summaryAdmins.filter(
						(admin) =>
							admin.status === AdminStatus.Active &&
							!getAdminIsExpired(admin, nowUnix) &&
							!getAdminIsLimited(admin),
					).length
				: null,
			expiredCount: hasCompleteSummary ? expiredCount : null,
			limitedCount: hasCompleteSummary ? limitedCount : null,
			disabledCount: hasCompleteSummary
				? summaryAdmins.filter(
						(admin) =>
							admin.status === AdminStatus.Disabled &&
							!getAdminIsExpired(admin, nowUnix) &&
							!getAdminIsLimited(admin),
					).length
				: null,
		};
	}, [adminOptions, admins, total]);
	const formatSummaryCount = (value: number | null) =>
		value === null ? "-" : formatCount(value, locale);
	const adminSummaryItems = [
		{
			label: t("total"),
			value: formatCount(summaryData.totalCount, locale),
			colorScheme: "gray",
		},
		{
			label: t("admins.roles.fullAccess"),
			value: formatSummaryCount(summaryData.fullAccessCount),
			colorScheme: "yellow",
		},
		{
			label: t("admins.roles.sudo"),
			value: formatSummaryCount(summaryData.sudoCount),
			colorScheme: "purple",
		},
		{
			label: t("admins.roles.reseller"),
			value: formatSummaryCount(summaryData.resellerCount),
			colorScheme: "blue",
		},
		{
			label: t("admins.roles.standard"),
			value: formatSummaryCount(summaryData.standardCount),
			colorScheme: "gray",
		},
		{
			label: t("status.active"),
			value: formatSummaryCount(summaryData.activeCount),
			colorScheme: "green",
		},
		{
			label: t("status.expired"),
			value: formatSummaryCount(summaryData.expiredCount),
			colorScheme: "orange",
		},
		{
			label: t("status.limited"),
			value: formatSummaryCount(summaryData.limitedCount),
			colorScheme: "red",
		},
		{
			label: t("status.disabled"),
			value: formatSummaryCount(summaryData.disabledCount),
			colorScheme: "gray",
		},
		{
			label: t("users"),
			value: formatSummaryCount(summaryData.usersTotal),
			colorScheme: "orange",
		},
		{
			label: t("onlineStatus.online"),
			value: formatSummaryCount(summaryData.onlineUsersTotal),
			colorScheme: "teal",
		},
		{
			label: t("summary.usage"),
			value:
				summaryData.usageTotal === null
					? "-"
					: formatBytes(summaryData.usageTotal),
			colorScheme: "blue",
		},
	];

	const skeletonCount = filters.limit || 5;
	const adminSorting = useMemo<SortingState>(() => {
		const currentSort = filters.sort || "";
		const desc = currentSort.startsWith("-");
		const id = desc ? currentSort.slice(1) : currentSort;
		return id ? [{ id, desc }] : [];
	}, [filters.sort]);

	const isWide = useBreakpointValue({ base: false, xl: true }) ?? false;
	const [adminSpeeds, setAdminSpeeds] = useState<AdminSpeedMap>({});
	useEffect(() => {
		let active = true;
		const loadSpeeds = () => {
			fetch<AdminSpeedMap>("/admins/speeds")
				.then((data) => {
					if (active) setAdminSpeeds(data || {});
				})
				.catch(() => undefined);
		};
		loadSpeeds();
		const timer = window.setInterval(loadSpeeds, 5000);
		return () => {
			active = false;
			window.clearInterval(timer);
		};
	}, []);
	const [tableSectionRef, [showQuickActions, showSpeed]] =
		useContainerMinWidths(QUICK_ACTIONS_MIN_TABLE_WIDTH, SPEED_MIN_TABLE_WIDTH);
	const rowActionsRef = useRef<(admin: Admin) => DataTableRowAction<Admin>[]>(
		() => [],
	);

	const adminColumns = useMemo<DataTableColumn<Admin>[]>(
		() => [
			{
				id: "username",
				header: t("username"),
				accessor: "username",
				sortable: true,
				isPrimary: true,
				priority: "primary",
				width: "1%",
				truncate: true,
				tooltip: true,
				cellAlign: "start",
				mobilePriority: 0,
				mobileMetaLabel: t("username"),
				cell: (admin) => (
					<p dir="ltr" className="font-semibold truncate max-w-[10rem] [unicode-bidi:isolate] text-panel-text">
						{admin.username}
					</p>
				),
			},
			{
				id: "status",
				header: t("status"),
				priority: "high",
				width: "1%",
				headerAlign: "center",
				mobilePriority: 1,
				mobileMetaLabel: t("status"),
				cell: (admin) => <AdminStatusBadge status={admin.status} />,
			},
			{
				id: "role",
				header: t("core.role"),
				priority: "medium",
				width: "1%",
				mobilePriority: 2,
				mobileMetaLabel: t("core.role"),
				cell: (admin) => <AdminRoleBadge role={admin.role} />,
			},
			{
				id: "users_count",
				header: t("admins.details.activeLabel"),
				sortable: true,
				priority: "high",
				width: "1%",
				headerAlign: "center",
				mobilePriority: 3,
				mobileMetaLabel: t("admins.details.activeLabel"),
				cell: (admin) => (
					<p dir="ltr" className="text-[0.875rem] font-semibold [unicode-bidi:isolate]">
						{formatCount(admin.active_users ?? 0, locale)}
						<span className="text-panel-text-muted font-medium">
							/{formatCount(admin.users_count ?? 0, locale)}
						</span>
					</p>
				),
			},
			{
				id: "online",
				header: t("admins.details.onlineLabel"),
				priority: "medium",
				width: "1%",
				headerAlign: "center",
				mobilePriority: 4,
				mobileMetaLabel: t("admins.details.onlineLabel"),
				cell: (admin) => (
					<p className="text-[0.875rem] text-green-600 dark:text-green-400 font-semibold">
						{formatCount(admin.online_users ?? 0, locale)}
					</p>
				),
			},
			{
				id: "services",
				header: t("services.title"),
				priority: "medium",
				desktopVisible: isWide,
				width: "1%",
				mobilePriority: 5,
				mobileMetaLabel: t("services.title"),
				cell: (admin) => (
					<p className="text-[0.875rem] truncate">
						{admin.services?.length
							? formatCount(admin.services.length, locale)
							: t("filters.advanced.serviceAll")}
					</p>
				),
			},
			{
				id: "data_usage",
				header: t("usersTable.traffic"),
				sortable: true,
				priority: "high",
				minWidth: "120px",
				cellAlign: "start",
				mobilePriority: 6,
				mobileSummary: true,
				mobileMetaLabel: t("usersTable.traffic"),
				cell: (admin) => (
					<div className="max-w-[32rem]">
						<UserUsageBar
							variant="stacked"
							used={getAdminEffectiveUsage(admin)}
							total={admin.data_limit ?? null}
						/>
					</div>
				),
			},
			{
				id: "speed",
				header: t("summary.speed"),
				priority: "medium",
				width: "1%",
				desktopVisible: showSpeed,
				hideOnMobile: true,
				cell: (admin) => {
					const speed = adminSpeeds[String(admin.id)];
					return (
						<div dir="ltr" className="flex flex-col gap-0 whitespace-nowrap text-[0.75rem] [font-variant-numeric:tabular-nums] [unicode-bidi:isolate]">
							<p className="text-teal-400">
								↑ {formatBytes(speed?.upload_speed ?? 0)}/s
							</p>
							<p className="text-blue-400">
								↓ {formatBytes(speed?.download_speed ?? 0)}/s
							</p>
						</div>
					);
				},
			},
			{
				id: "remaining_traffic",
				header: t("usersTable.remainingTraffic"),
				priority: "medium",
				desktopVisible: isWide,
				width: "1%",
				mobilePriority: 7,
				mobileMetaLabel: t("usersTable.remainingTraffic"),
				cell: (admin) => (
					<p dir="ltr" className={cn("leading-[1]", !admin.data_limit ? "text-[1.25rem]" : "text-[0.875rem]", !admin.data_limit ? "font-semibold" : "", !admin.data_limit ? "text-panel-text-muted" : "text-panel-text")}>
						{!admin.data_limit
							? <><span aria-hidden="true">∞</span><span className="sr-only">{t("unlimited")}</span></>
							: formatBytes(
									Math.max(admin.data_limit - getAdminEffectiveUsage(admin), 0),
								)}
					</p>
				),
			},
			{
				id: "expire",
				header: t("expire"),
				priority: "medium",
				width: "1%",
				minWidth: "88px",
				mobilePriority: 8,
				mobileMetaLabel: t("expire"),
				cell: (admin) => <UserExpiryCountdown expire={admin.expire} />,
			},
			{
				id: "quick_actions",
				header: "",
				priority: "medium",
				width: "1%",
				desktopVisible: showQuickActions,
				hideOnMobile: true,
				cell: (admin) => (
					// biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops row clicks, it is not a control
						// biome-ignore lint/a11y/useKeyWithClickEvents: same wrapper, no key action
						<div onClick={(event) => event.stopPropagation()} className="flex flex-row items-center gap-0.5">
						{rowActionsRef
							.current(admin)
							.filter((action) => QUICK_ACTION_IDS.includes(action.id))
							.map((action) => (
								<Tooltip key={action.id} label={action.label}>
									<span>
										<IconButton aria-label={String(action.label)} variant="ghost" size="sm" disabled={
												typeof action.disabled === "function"
													? action.disabled(admin)
													: action.disabled
											} onClick={() => action.onClick?.(admin)} className={cn("min-w-[28px]! h-[28px] rb-row-action", action.isDanger && "hover:text-red-400!")} >{action.icon}</IconButton>
									</span>
								</Tooltip>
							))}
					</div>
				),
			},
		],
		[adminSpeeds, isWide, showQuickActions, showSpeed, locale, t],
	);

	const adminRowActions = (admin: Admin): DataTableRowAction<Admin>[] => {
		const meta = getAdminRowMeta(admin);
		const actions: DataTableRowAction<Admin>[] = [];

		if (meta.canManage) {
			actions.push(
				{
					id: "edit",
					label: t("edit"),
					icon: <PencilIcon className="w-[16px]" />,
					onClick: () => openAdminDialog(admin),
				},
				{
					id: "permissions",
					label: t("admins.editPermissionsButton"),
					icon: <AdjustmentsHorizontalIcon className="w-[16px]" />,
					onClick: () => handleOpenPermissionsModal(admin),
				},
				{
					id: "reset",
					label: t("admins.resetUsage"),
					icon: <ResetIcon />,
					onClick: () => setResetConfirmation({ admin, type: "usage" }),
					disabled:
						actionState?.username === admin.username &&
						actionState?.type === "reset",
				},
			);
		}

		if (canManageSecurityFor(admin)) {
			actions.push({
				id: "security",
				label: t("admins.security.action"),
				icon: <ShieldCheckIcon className="w-[16px]" />,
				onClick: () => {
					setSecurityAdmin(admin);
					securityDialog.onOpen();
				},
			});
		}

		if (canManageAPIKeysFor(admin)) {
			actions.push({
				id: "apiKeys",
				label: t("admins.apiKeys.action"),
				icon: <KeyIcon className="w-[16px]" />,
				onClick: () => {
					setAPIKeysAdmin(admin);
					apiKeysDialog.onOpen();
				},
			});
		}

		if (meta.canManage && (admin.deleted_users_usage ?? 0) > 0) {
			actions.push({
				id: "resetDeleted",
				label: t("admins.resetDeletedUsage"),
				icon: <QuickPassIcon />,
				onClick: () => setResetConfirmation({ admin, type: "deleted" }),
				disabled:
					actionState?.username === admin.username &&
					actionState?.type === "resetDeleted",
			});
		}

		if (meta.showEnable) {
			actions.push({
				id: "enable",
				label: t("admins.enableAdmin"),
				icon: <EnableIcon />,
				onClick: () => handleEnableAdmin(admin),
				disabled:
					actionState?.username === admin.username &&
					actionState?.type === "enableAdmin",
			});
		}

		if (meta.showDisable) {
			actions.push({
				id: "disable",
				label: t("admins.disableAdmin"),
				icon: <DisableIcon />,
				onClick: () => startDisableAdmin(admin),
				disabled:
					actionState?.username === admin.username &&
					actionState?.type === "disableAdmin",
			});
		}

		if (meta.showAddTraffic) {
			actions.push({
				id: "addTraffic",
				label: t("services.userActions.traffic.add"),
				render: (_row, onClose) => renderAddTrafficSubmenu(admin, onClose),
			});
		}

		if (meta.canManage) {
			actions.push({
				id: "quickPassword",
				label: t("admins.quickPassword"),
				icon: <QuickPassIcon />,
				onClick: () => handleQuickPassword(admin),
				disabled: contextAction === "quickPassword",
			});
		}

		if (meta.showDelete) {
			actions.push({
				id: "delete",
				label: t("delete"),
				icon: <DeleteIcon />,
				onClick: () => startDeleteAdmin(admin),
				disabled:
					actionState?.username === admin.username &&
					actionState?.type === "deleteAdmin",
				isDanger: true,
			});
		}

		return actions;
	};
	rowActionsRef.current = adminRowActions;

	const [expandedAdminUsername, setExpandedAdminUsername] = useState<string | null>(null);
	const isDesktop = useBreakpointValue({ base: false, md: true }) ?? false;
	const renderExpandedAdmin = (admin: Admin) => {
		const actions = adminRowActions(admin).filter(Boolean);
		return (
			<div className="rb-resource-expanded">
				<AdminDetailsPanel
					admin={admin}
					actions={
						// biome-ignore lint/a11y/noStaticElementInteractions: wrapper only stops row clicks, it is not a control
							// biome-ignore lint/a11y/useKeyWithClickEvents: same wrapper, no key action
							<div onClick={(event) => event.stopPropagation()} className="flex items-center justify-end gap-1 flex-wrap rb-resource-expanded-actions">
							<div className="flex flex-row items-center gap-1 flex-wrap rb-inline-actions">
								{actions.map((action) => (
									<Tooltip key={action.id} label={action.label}>
										<span>
											<IconButton aria-label={String(action.label)} variant="ghost" size="sm" disabled={typeof action.disabled === "function" ? action.disabled(admin) : action.disabled} onClick={() => action.onClick?.(admin)} className="min-w-[30px]! h-[30px]" >{action.icon}</IconButton>
										</span>
									</Tooltip>
								))}
							</div>
						</div>
					}
				/>
			</div>
		);
	};

	return (
		<>
			<div className="flex flex-col gap-3">
				<ResourceListCard
					title={t("admins.listHeader")}
					summaryItems={adminSummaryItems}
					footerActions={footerActions}
				>
					{toolbar}
				</ResourceListCard>

				<div ref={tableSectionRef} className="rb-admins-section">
				<DataTable
					ariaLabel={t("admins")}
					data={admins}
					columns={adminColumns}
					getRowId={(admin) => admin.username}
					loading={loading}
					loadingRows={skeletonCount}
					emptyState={
						<p className="text-[0.875rem] text-panel-text-muted text-center">
							{t("admins.noAdmins")}
						</p>
					}
					enableSelection
					selectedRowIds={selectedAdminUsernames}
					selectedRows={selectedAdmins}
					selectedCount={selectedAdminUsernames.length}
					onSelectionChange={(rowIds) => setSelectedAdminUsernames(rowIds)}
					selectedLabel={t("admins.selectedCount", {
						count: selectedAdminUsernames.length,
					})}
					rowActions={adminRowActions}
					actionsDisplay="menu"
					actionsPlacement="end"
					actionsColumnWidth={showQuickActions ? "40px" : "60px"}
					showActionsOnHover
									onRowClick={isDesktop ? (admin) => setExpandedAdminUsername((current) => (current === admin.username ? null : admin.username)) : undefined}
									isRowExpanded={isDesktop ? (admin) => expandedAdminUsername === admin.username : undefined}
									renderExpandedRow={isDesktop ? renderExpandedAdmin : undefined}
					sorting={adminSorting}
					manualSorting
					showSortMenu={false}
					dir={isRTL ? "rtl" : "ltr"}
					mobileBreakpoint="md"
					tableProps={tableProps}
				/>
				</div>
			</div>

			<ConfirmDialog
				open={Boolean(resetConfirmation)}
				onClose={() => setResetConfirmation(null)}
				onConfirm={confirmUsageReset}
				title={t(
					resetConfirmation?.type === "deleted"
						? "admins.resetDeletedUsage"
						: "admins.resetUsage",
					"Reset usage",
				)}
				description={t("admins.resetUsageConfirm", {
					username: resetConfirmation?.admin.username ?? "",
				})}
				confirmLabel={t("reset")}
				loading={
					actionState?.type === "reset" || actionState?.type === "resetDeleted"
				}
			/>

			<ConfirmDialog
				open={isDeleteDialogOpen}
				onClose={closeDeleteDialogAndReset}
				onConfirm={confirmDeleteAdmin}
				title={t("delete")}
				description={t("admins.confirmDeleteMessage", {
					username: adminToDelete?.username ?? "",
				})}
				confirmLabel={t("delete")}
				colorScheme="red"
				loading={actionState?.type === "deleteAdmin"}
				isConfirmDisabled={!adminToDelete}
			/>

			<ConfirmDialog
				open={isQuickPassConfirmOpen}
				onClose={() => {
					if (contextAction === "quickPassword") return;
					closeQuickPassConfirm();
					setQuickPassAdmin(null);
				}}
				onConfirm={confirmQuickPassword}
				title={t("admins.quickPasswordConfirmTitle")}
				description={t("admins.quickPasswordConfirm", {
					username: quickPassAdmin?.username ?? "",
				})}
				confirmLabel={t("admins.quickPasswordAction")}
				colorScheme="primary"
				loading={contextAction === "quickPassword"}
			/>

			<Modal open={isQuickPassOpen} onClose={handleCloseQuickPass} isCentered>
				<ModalOverlay className="bg-blackAlpha-500" />
				<ModalContent className={cn("border rounded-2xl shadow-2xl overflow-hidden mx-4 sm:mx-0 max-w-[calc(100vw_-_32px)] sm:max-w-[440px]", dialogBg, dialogBorderColor)}>
					<ModalHeader className="px-6 pt-6 pb-2">
						<div className="flex flex-row items-center gap-3">
							<div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900 dark:text-primary-200">
								<QuickPassIcon />
							</div>
							<p>{t("admins.quickPasswordModal.title")}</p>
						</div>
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody className="px-6 pb-2">
						<div className="flex flex-col gap-3">
							<div>
								<p className="text-[0.875rem] text-gray-500">
									{t("username")}
								</p>
								<Input value={quickPassInfo?.username ?? ""} readOnly />
							</div>
							<div>
								<p className="text-[0.875rem] text-gray-500">
									{t("admins.quickPasswordModal.password")}
								</p>
								<InputGroup>
									<Input value={quickPassInfo?.password ?? ""} readOnly />
									<InputRightElement>
										<Button size="sm" variant="ghost" onClick={async () => {
												if (quickPassInfo?.password) {
													try {
														await copyTextToClipboard(quickPassInfo.password);
														toast({
															title: t("copied"),
															status: "success",
															duration: 1200,
														});
													} catch (error) {
														generateErrorMessage(error, toast);
													}
												}
											}}>
											{t("copy")}
										</Button>
									</InputRightElement>
								</InputGroup>
							</div>
							<p className="text-[0.75rem] text-orange-400">
								{t("admins.quickPasswordModal.notice")}
							</p>
						</div>
					</ModalBody>
					<ModalFooter className={cn("bg-blackAlpha-50 dark:bg-whiteAlpha-50 border-t px-6 py-4", dialogBorderColor)}>
						<Button size="md" colorScheme="primary" onClick={handleCloseQuickPass}>
							{t("close")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<ConfirmDialog
				open={isDisableDialogOpen}
				onClose={closeDisableDialogAndReset}
				onConfirm={confirmDisableAdmin}
				title={t("admins.disableAdminTitle")}
				description={
					<div className="flex flex-col gap-3">
						<p className="text-[0.875rem] text-gray-500 dark:text-gray-300">
							{t("admins.disableAdminMessage", {
								username: adminToDisable?.username ?? "",
							})}
						</p>
						<Textarea value={disableReason} onChange={(event) => setDisableReason(event.target.value)} placeholder={t("admins.disableAdminReasonPlaceholder")} />
					</div>
				}
				confirmLabel={t("admins.disableAdminConfirm")}
				colorScheme="red"
				isConfirmDisabled={disableReason.trim().length < 3}
				loading={
					actionState?.type === "disableAdmin" &&
					actionState?.username === adminToDisable?.username
				}
			/>
			<AdminPermissionsModal
				open={isPermissionsModalOpen}
				onClose={handleClosePermissionsModal}
				admin={adminForPermissions}
			/>
			<AdminSecurityDialog
				admin={securityAdmin}
				open={securityDialog.isOpen}
				onClose={() => {
					securityDialog.onClose();
					setSecurityAdmin(null);
				}}
				canManageSessions={canManageSessions}
				canManage2FA={canManage2FA}
				onChanged={() => fetchAdmins(undefined, { force: true })}
			/>
			<AdminApiKeysDialog
				admin={apiKeysAdmin}
				open={apiKeysDialog.isOpen}
				onClose={() => {
					apiKeysDialog.onClose();
					setAPIKeysAdmin(null);
				}}
			/>
		</>
	);
};

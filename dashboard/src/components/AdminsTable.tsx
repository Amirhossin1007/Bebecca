import {
	Box,
	Button,
	Collapse,
	chakra,
	HStack,
	Input,
	InputGroup,
	InputRightElement,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	SimpleGrid,
	Stack,
	type TableProps,
	Text,
	Textarea,
	useColorModeValue,
	useDisclosure,
	useToast,
} from "@chakra-ui/react";
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
import useGetUser from "hooks/useGetUser";
import {
	type FC,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import type { Admin } from "types/Admin";
import {
	AdminManagementPermission,
	AdminRole,
	AdminStatus,
	AdminTrafficLimitMode,
} from "types/Admin";
import { formatBytes } from "utils/formatByte";
import {
	generateErrorMessage,
	generateSuccessMessage,
} from "utils/toastHandler";
import { copyTextToClipboard } from "utils/clipboard";
import { AdminApiKeysDialog } from "./AdminApiKeysDialog";
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

const iconProps = {
	baseStyle: {
		strokeWidth: "2px",
		w: 3,
		h: 3,
	},
};

const ResetIcon = chakra(ArrowPathIcon, iconProps);
const DisableIcon = chakra(NoSymbolIcon, iconProps);
const EnableIcon = chakra(PlayIcon, iconProps);
const DeleteIcon = chakra(TrashIcon, iconProps);
const QuickPassIcon = chakra(KeyIcon, iconProps);
const AddDataIcon = chakra(PlusCircleIcon, iconProps);

const AdminStatusBadge: FC<{ status: AdminStatus }> = ({ status }) => {
	const { t } = useTranslation();

	return (
		<Text
			fontSize="sm"
			fontWeight="semibold"
			color={status === AdminStatus.Active ? "green.400" : "red.400"}
			textTransform="capitalize"
		>
			{status === AdminStatus.Active
				? t("status.active")
				: t("admins.disabledLabel")}
		</Text>
	);
};

const AdminRoleBadge: FC<{ role: AdminRole }> = ({ role }) => {
	const { t } = useTranslation();
	const roleStyles = {
		[AdminRole.FullAccess]: {
			color: "yellow.800",
			darkColor: "yellow.200",
			label: t("admins.roles.fullAccess"),
		},
		[AdminRole.Sudo]: {
			color: "purple.800",
			darkColor: "purple.200",
			label: t("admins.roles.sudo"),
		},
		[AdminRole.Reseller]: {
			color: "blue.800",
			darkColor: "blue.200",
			label: t("admins.roles.reseller"),
		},
		[AdminRole.Standard]: {
			color: "gray.800",
			darkColor: "gray.200",
			label: t("admins.roles.standard"),
		},
	}[role];

	return (
		<Text
			as="span"
			fontSize="xs"
			color={roleStyles.color}
			fontWeight="medium"
			_dark={{ color: roleStyles.darkColor }}
		>
			{roleStyles.label}
		</Text>
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

type AdminsTableProps = TableProps & {
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
	const dialogBg = useColorModeValue("surface.light", "surface.dark");
	const dialogBorderColor = useColorModeValue("light-border", "gray.700");
	const inlineMenuBg = useColorModeValue("blackAlpha.50", "whiteAlpha.50");
	const adminOptions = useAdminsStore((state) => state.adminOptions);
	const admins = useAdminsStore((state) => state.admins);
	const loading = useAdminsStore((state) => state.loading);
	const total = useAdminsStore((state) => state.total);
	const filters = useAdminsStore((state) => state.filters);
	const onFilterChange = useAdminsStore((state) => state.onFilterChange);
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
	const openAdminDetails = useAdminsStore((state) => state.openAdminDetails);
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
			<Box>
				<Button
					variant="ghost"
					justifyContent="flex-start"
					w="full"
					isLoading={contextAction?.startsWith("addData-")}
					isDisabled={contextAction?.startsWith("addData-")}
					aria-expanded={isOpen}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						setOpenTrafficMenuFor((current) =>
							current === admin.username ? null : admin.username,
						);
					}}
				>
					<HStack w="full" justify="space-between" spacing={3}>
						<HStack spacing={2} minW={0}>
							<AddDataIcon />
							<Text as="span" noOfLines={1}>
								{t("services.userActions.traffic.add")}
							</Text>
						</HStack>
						<ChevronRightIcon
							width={14}
							style={{
								flexShrink: 0,
								transform: isOpen
									? "rotate(90deg)"
									: isRTL
										? "rotate(180deg)"
										: undefined,
								transition: "transform 0.15s ease",
							}}
						/>
					</HStack>
				</Button>
				<Collapse in={isOpen} unmountOnExit>
					<SimpleGrid
						columns={{ base: 2, sm: 3 }}
						spacing={1}
						mt={1}
						p={2}
						bg={inlineMenuBg}
						borderWidth="1px"
						borderColor={dialogBorderColor}
						borderRadius="md"
					>
						{ADMIN_TRAFFIC_OPTIONS.map((option) => (
							<Button
								key={option.label}
								size="sm"
								variant="ghost"
								justifyContent="center"
								onClick={(event) => {
									event.stopPropagation();
									handleAddDataLimit(
										admin,
										option.gigabytes,
										closeAfterSelection,
									);
								}}
								isLoading={contextAction === `addData-${option.gigabytes}`}
								isDisabled={contextAction?.startsWith("addData-")}
							>
								{option.label}
							</Button>
						))}
					</SimpleGrid>
				</Collapse>
			</Box>
		);
	};
	const { className, sx, ...restProps } = props;
	const normalizedSx = Array.isArray(sx)
		? Object.assign({}, ...sx)
		: (sx as Record<string, unknown> | undefined);
	const baseTableSx: Record<string, unknown> = {
		width: "100%",
		tableLayout: "fixed",
		"& th, & td": {
			px: { base: 2, xl: 2.5 },
			py: 2.5,
			verticalAlign: "middle",
		},
	};
	const tableClassName = isRTL
		? classNames(className, "rb-rtl-table")
		: className;
	const tableProps = {
		...restProps,
		className: tableClassName,
		sx: { ...baseTableSx, ...(normalizedSx || {}) },
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
		return {
			totalCount: adminOptions.length || total,
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
	];

	const skeletonCount = filters.limit || 5;
	const adminSorting = useMemo<SortingState>(() => {
		const currentSort = filters.sort || "";
		const desc = currentSort.startsWith("-");
		const id = desc ? currentSort.slice(1) : currentSort;
		return id ? [{ id, desc }] : [];
	}, [filters.sort]);

	const handleAdminTableSorting = (nextSorting: SortingState) => {
		const next = nextSorting[0];
		if (!next) return;
		const allowedSorts = new Set([
			"username",
			"users_count",
			"data_usage",
			"data_limit",
		]);
		if (!allowedSorts.has(next.id)) return;
		onFilterChange({
			sort: next.desc ? `-${next.id}` : next.id,
			offset: 0,
		});
	};

	const adminColumns = useMemo<DataTableColumn<Admin>[]>(
		() => [
			{
				id: "username",
				header: t("username"),
				accessor: "username",
				sortable: true,
				isPrimary: true,
				priority: "primary",
				width: "168px",
				minWidth: "148px",
				maxWidth: "188px",
				truncate: true,
				tooltip: true,
				cellAlign: "start",
				mobilePriority: 0,
				mobileMetaLabel: t("username"),
				cell: (admin) => (
					<Text
						fontWeight="semibold"
						noOfLines={1}
						dir="ltr"
						sx={{ unicodeBidi: "isolate" }}
						color="panel.text"
					>
						{admin.username}
					</Text>
				),
			},
			{
				id: "status",
				header: t("status"),
				priority: "high",
				width: "116px",
				maxWidth: "130px",
				headerAlign: "center",
				mobilePriority: 1,
				mobileMetaLabel: t("status"),
				cell: (admin) => <AdminStatusBadge status={admin.status} />,
			},
			{
				id: "role",
				header: t("core.role"),
				priority: "high",
				width: "118px",
				maxWidth: "130px",
				mobilePriority: 2,
				mobileMetaLabel: t("core.role"),
				cell: (admin) => <AdminRoleBadge role={admin.role} />,
			},
			{
				id: "users_count",
				header: t("admins.details.activeLabel"),
				sortable: true,
				priority: "high",
				width: "92px",
				maxWidth: "104px",
				headerAlign: "center",
				mobilePriority: 3,
				mobileMetaLabel: t("admins.details.activeLabel"),
				cell: (admin) => {
					return (
						<Text
							fontSize="sm"
							fontWeight="semibold"
							dir="ltr"
							sx={{ unicodeBidi: "isolate" }}
						>
							{formatCount(admin.active_users ?? 0, locale)}
						</Text>
					);
				},
			},
			{
				id: "online",
				header: t("admins.details.onlineLabel"),
				priority: "medium",
				width: "86px",
				maxWidth: "96px",
				headerAlign: "center",
				mobilePriority: 4,
				mobileMetaLabel: t("admins.details.onlineLabel"),
				cell: (admin) => (
					<Text
						fontSize="sm"
						color="green.600"
						_dark={{ color: "green.400" }}
						fontWeight="semibold"
					>
						{formatCount(admin.online_users ?? 0, locale)}
					</Text>
				),
			},
			{
				id: "services",
				header: t("services.title"),
				priority: "medium",
				width: "112px",
				maxWidth: "130px",
				mobilePriority: 5,
				mobileMetaLabel: t("services.title"),
				cell: (admin) => (
					<Text fontSize="sm" noOfLines={1}>
						{admin.services?.length
							? formatCount(admin.services.length, locale)
							: t("filters.advanced.serviceAll")}
					</Text>
				),
			},
			{
				id: "data_usage",
				header: t("usersTable.traffic"),
				sortable: true,
				priority: "high",
				width: "clamp(240px, 22vw, 340px)",
				minWidth: "240px",
				maxWidth: "340px",
				headerAlign: "center",
				cellAlign: "start",
				mobilePriority: 6,
				mobileSummary: true,
				mobileMetaLabel: t("usersTable.traffic"),
				cell: (admin) => (
					<UserUsageBar
						variant="inline"
						used={getAdminEffectiveUsage(admin)}
						total={admin.data_limit ?? null}
					/>
				),
			},
			{
				id: "remaining_traffic",
				header: t("usersTable.remainingTraffic"),
				priority: "medium",
				width: "132px",
				minWidth: "118px",
				maxWidth: "148px",
				mobilePriority: 7,
				mobileMetaLabel: t("usersTable.remainingTraffic"),
				cell: (admin) => (
					<Text
						fontSize={!admin.data_limit ? "xl" : "sm"}
						fontWeight={!admin.data_limit ? "semibold" : undefined}
						lineHeight="1"
						color={!admin.data_limit ? "panel.textMuted" : "panel.text"}
						dir="ltr"
						aria-label={!admin.data_limit ? t("unlimited") : undefined}
					>
						{!admin.data_limit
							? "∞"
							: formatBytes(
									Math.max(admin.data_limit - getAdminEffectiveUsage(admin), 0),
								)}
					</Text>
				),
			},
			{
				id: "expire",
				header: t("expire"),
				priority: "medium",
				width: "126px",
				maxWidth: "146px",
				mobilePriority: 8,
				mobileMetaLabel: t("expire"),
				cell: (admin) => <UserExpiryCountdown expire={admin.expire} />,
			},
		],
		[locale, t],
	);

	const adminRowActions = (admin: Admin): DataTableRowAction<Admin>[] => {
		const meta = getAdminRowMeta(admin);
		const actions: DataTableRowAction<Admin>[] = [];

		if (meta.canManage) {
			actions.push(
				{
					id: "edit",
					label: t("edit"),
					icon: <PencilIcon width={16} />,
					onClick: () => openAdminDialog(admin),
				},
				{
					id: "permissions",
					label: t("admins.editPermissionsButton"),
					icon: <AdjustmentsHorizontalIcon width={16} />,
					onClick: () => handleOpenPermissionsModal(admin),
				},
				{
					id: "reset",
					label: t("admins.resetUsage"),
					icon: <ResetIcon />,
					onClick: () => setResetConfirmation({ admin, type: "usage" }),
					isDisabled:
						actionState?.username === admin.username &&
						actionState?.type === "reset",
				},
			);
		}

		if (canManageSecurityFor(admin)) {
			actions.push({
				id: "security",
				label: t("admins.security.action"),
				icon: <ShieldCheckIcon width={16} />,
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
				icon: <KeyIcon width={16} />,
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
				isDisabled:
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
				isDisabled:
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
				isDisabled:
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
				isDisabled: contextAction === "quickPassword",
			});
		}

		if (meta.showDelete) {
			actions.push({
				id: "delete",
				label: t("delete"),
				icon: <DeleteIcon />,
				onClick: () => startDeleteAdmin(admin),
				isDisabled:
					actionState?.username === admin.username &&
					actionState?.type === "deleteAdmin",
				isDanger: true,
			});
		}

		return actions;
	};

	return (
		<>
			<Stack spacing={3}>
				<ResourceListCard
					title={t("admins.listHeader")}
					summaryItems={adminSummaryItems}
					footerActions={footerActions}
				>
					{toolbar}
				</ResourceListCard>

				<DataTable
					ariaLabel={t("admins")}
					data={admins}
					columns={adminColumns}
					getRowId={(admin) => admin.username}
					isLoading={loading}
					loadingRows={skeletonCount}
					emptyState={
						<Text fontSize="sm" color="panel.textMuted" textAlign="center">
							{t("admins.noAdmins")}
						</Text>
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
					actionsColumnWidth="60px"
					showActionsOnHover
					onRowClick={(admin) => openAdminDetails(admin)}
					sorting={adminSorting}
					onSortingChange={handleAdminTableSorting}
					manualSorting
					dir={isRTL ? "rtl" : "ltr"}
					mobileBreakpoint="md"
					tableProps={tableProps}
				/>
			</Stack>

			<ConfirmDialog
				isOpen={Boolean(resetConfirmation)}
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
				isLoading={
					actionState?.type === "reset" || actionState?.type === "resetDeleted"
				}
			/>

			<ConfirmDialog
				isOpen={isDeleteDialogOpen}
				onClose={closeDeleteDialogAndReset}
				onConfirm={confirmDeleteAdmin}
				title={t("delete")}
				description={t("admins.confirmDeleteMessage", {
					username: adminToDelete?.username ?? "",
				})}
				confirmLabel={t("delete")}
				colorScheme="red"
				isLoading={actionState?.type === "deleteAdmin"}
				isConfirmDisabled={!adminToDelete}
			/>

			<ConfirmDialog
				isOpen={isQuickPassConfirmOpen}
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
				isLoading={contextAction === "quickPassword"}
			/>

			<Modal isOpen={isQuickPassOpen} onClose={handleCloseQuickPass} isCentered>
				<ModalOverlay bg="blackAlpha.500" />
				<ModalContent
					bg={dialogBg}
					borderWidth="1px"
					borderColor={dialogBorderColor}
					borderRadius="2xl"
					boxShadow="2xl"
					overflow="hidden"
					mx={{ base: 4, sm: 0 }}
					maxW={{ base: "calc(100vw - 32px)", sm: "440px" }}
				>
					<ModalHeader px={6} pt={6} pb={2}>
						<HStack spacing={3}>
							<Box
								display="inline-flex"
								alignItems="center"
								justifyContent="center"
								w={10}
								h={10}
								borderRadius="full"
								bg="primary.50"
								color="primary.600"
								_dark={{ bg: "primary.900", color: "primary.200" }}
							>
								<QuickPassIcon />
							</Box>
							<Text>{t("admins.quickPasswordModal.title")}</Text>
						</HStack>
					</ModalHeader>
					<ModalCloseButton />
					<ModalBody px={6} pb={2}>
						<Stack spacing={3}>
							<Box>
								<Text fontSize="sm" color="gray.500">
									{t("username")}
								</Text>
								<Input value={quickPassInfo?.username ?? ""} isReadOnly />
							</Box>
							<Box>
								<Text fontSize="sm" color="gray.500">
									{t("admins.quickPasswordModal.password")}
								</Text>
								<InputGroup>
									<Input value={quickPassInfo?.password ?? ""} isReadOnly />
									<InputRightElement>
										<Button
											size="sm"
											variant="ghost"
											onClick={async () => {
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
											}}
										>
											{t("copy")}
										</Button>
									</InputRightElement>
								</InputGroup>
							</Box>
							<Text fontSize="xs" color="orange.400">
								{t("admins.quickPasswordModal.notice")}
							</Text>
						</Stack>
					</ModalBody>
					<ModalFooter
						bg="blackAlpha.50"
						_dark={{ bg: "whiteAlpha.50" }}
						borderTopWidth="1px"
						borderColor={dialogBorderColor}
						px={6}
						py={4}
					>
						<Button colorScheme="primary" onClick={handleCloseQuickPass}>
							{t("close")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<ConfirmDialog
				isOpen={isDisableDialogOpen}
				onClose={closeDisableDialogAndReset}
				onConfirm={confirmDisableAdmin}
				title={t("admins.disableAdminTitle")}
				description={
					<Stack spacing={3}>
						<Text fontSize="sm" color="gray.500" _dark={{ color: "gray.300" }}>
							{t("admins.disableAdminMessage", {
								username: adminToDisable?.username ?? "",
							})}
						</Text>
						<Textarea
							value={disableReason}
							onChange={(event) => setDisableReason(event.target.value)}
							placeholder={t("admins.disableAdminReasonPlaceholder")}
						/>
					</Stack>
				}
				confirmLabel={t("admins.disableAdminConfirm")}
				colorScheme="red"
				isConfirmDisabled={disableReason.trim().length < 3}
				isLoading={
					actionState?.type === "disableAdmin" &&
					actionState?.username === adminToDisable?.username
				}
			/>
			<AdminPermissionsModal
				isOpen={isPermissionsModalOpen}
				onClose={handleClosePermissionsModal}
				admin={adminForPermissions}
			/>
			<AdminSecurityDialog
				admin={securityAdmin}
				isOpen={securityDialog.isOpen}
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
				isOpen={apiKeysDialog.isOpen}
				onClose={() => {
					apiKeysDialog.onClose();
					setAPIKeysAdmin(null);
				}}
			/>
		</>
	);
};

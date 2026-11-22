import type { SortingState } from "@tanstack/react-table";
import AddFileIcon from "assets/add_file.svg?react";
import { AddTrafficDialog } from "components/AddTrafficDialog";
import { TagChips } from "components/labels/TagChips";
import { Button } from "components/ui/button";
import { DataTableColumnMenu } from "components/ui/DataTableColumnMenu";
import { RowActionButton } from "components/ui/row-actions";
import { toast } from "components/ui/sonner";
import { Spinner } from "components/ui/spinner";
import { UsersOverviewBand } from "components/users/UsersOverviewBand";
import { useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import useGetUser from "hooks/useGetUser";
import { usePersistedColumnVisibility } from "hooks/usePersistedColumnVisibility";
import { cn } from "lib/cn";
import { withClass } from "lib/withClass";
import {
	Ban,
	CalendarDays,
	ChartColumn,
	Check,
	Check as CheckIcon,
	CirclePlus,
	Clock,
	Copy,
	Database,
	Globe,
	Link,
	Link2,
	Lock,
	Pencil,
	QrCode,
	RefreshCw,
	Server,
	Signal,
	Trash2,
	Unlink,
} from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import {
	type FC,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { AdminRole, AdminStatus, UserPermissionToggle } from "types/Admin";
import type { User, UserListItem } from "types/User";
import {
	canDeleteUserByTrafficCap,
	canViewUserTraffic,
	isUserManagementLocked,
} from "utils/adminTraffic";
import { copyTextToClipboard } from "utils/clipboard";
import { formatBytes } from "utils/formatByte";
import { generateUserLinks } from "utils/userLinks";
import {
	nextUsersFiltersForOverview,
	usersOverviewSelection,
} from "utils/usersOverview";
import { AppDialog } from "./dialogs/AppDialog";
import { ConfirmDialog, DeleteConfirmDialog } from "./dialogs/ConfirmDialog";
import { OnlineStatus } from "./OnlineStatus";
import { OperatorIdentity } from "./OperatorIdentity";
import {
	DataTable,
	type DataTableColumn,
	type DataTableRowAction,
	type RowActionItem,
	RowActionsMenu,
} from "./ui";
import {
	formatUsagePair,
	UserAdminChip,
	UserExpiryCountdown,
	UserOnlineBadge,
	UserUsageBar,
} from "./users";

const EmptySectionIcon = withClass(AddFileIcon, "");

const USER_STATUS_TEXT_COLORS: Partial<Record<UserListItem["status"], string>> =
	{
		active: "var(--color-green-400)",
		on_hold: "var(--color-purple-400)",
		expired: "var(--color-yellow-400)",
		limited: "var(--color-red-400)",
	};

const UserSpeed: FC<{ user: UserListItem }> = ({ user }) => {
	const { t } = useTranslation();
	const upload =
		useDashboard((state) => state.liveUserStats[user.username]?.upload_speed) ??
		user.upload_speed ??
		0;
	const download =
		useDashboard(
			(state) => state.liveUserStats[user.username]?.download_speed,
		) ??
		user.download_speed ??
		0;
	if (upload === 0 && download === 0) {
		return <p className="text-panel-text-muted">—</p>;
	}
	return (
		<div
			dir="ltr"
			className="rb-stat-pair flex flex-col gap-0 text-[0.75rem] leading-[1.375]"
		>
			<p>
				<span aria-hidden="true">↑</span>{" "}
				<span className="sr-only">{t("usersTable.uploadSpeed")}: </span>
				{formatBytes(upload)}/s
			</p>
			<p>
				<span aria-hidden="true">↓</span>{" "}
				<span className="sr-only">{t("usersTable.downloadSpeed")}: </span>
				{formatBytes(download)}/s
			</p>
		</div>
	);
};

const UserPresence: FC<{ user: UserListItem }> = ({ user }) => {
	const isOnline = useDashboard(
		(state) => state.liveUserStats[user.username]?.is_online,
	);
	return <UserOnlineBadge isOnline={isOnline ?? user.is_online} />;
};

const MobileUserOnlineDot: FC<{ user: UserListItem }> = ({ user }) => {
	const liveIsOnline = useDashboard(
		(state) => state.liveUserStats[user.username]?.is_online,
	);
	const isOnline = liveIsOnline ?? user.is_online;
	return (
		<span
			data-online={isOnline ? "true" : "false"}
			aria-hidden="true"
			className="rb-user-mobile-online-dot"
		/>
	);
};

const CopyIcon = () => <Copy />;
const SubscriptionLinkIcon = () => <Link2 />;
const QRIcon = () => <QrCode />;
const CopiedIcon = () => <Check />;
const EditIcon = () => <Pencil />;
const DeleteIcon = () => <Trash2 />;
const LockOverlayIcon = withClass(Lock, "w-16 md:w-20 h-16 md:h-20");
const ResetIcon = withClass(RefreshCw, "w-4 md:w-5 h-4 md:h-5");
const DisableIcon = withClass(Ban, "w-4 md:w-5 h-4 md:h-5");
const RevokeIcon = withClass(Unlink, "w-4 md:w-5 h-4 md:h-5");
const TrafficIcon = withClass(CirclePlus, "w-4 md:w-5 h-4 md:h-5");
const ExtendIcon = withClass(Clock, "w-4 md:w-5 h-4 md:h-5");
const UsageHistoryIcon = withClass(ChartColumn, "w-4 md:w-5 h-4 md:h-5");
const DataLimitIcon = withClass(Database, "w-4 md:w-5 h-4 md:h-5");
const ExpiryIcon = withClass(CalendarDays, "w-4 md:w-5 h-4 md:h-5");
const IPsIcon = withClass(Globe, "w-4 md:w-5 h-4 md:h-5");

type UserIPRecord = {
	node_id: number;
	node_name?: string;
	node_names?: string[];
	protocol: string;
	protocols?: string[];
	inbound_tag?: string;
	inbound_tags?: string[];
	session_id?: string;
	ip?: string;
	assigned_ip?: string;
	assigned_ips?: string[];
	connections?: number;
	operator_short_name?: string;
	operator_owner?: string;
	last_seen_at?: string;
};

type UserIPsResponse = {
	username: string;
	ips: UserIPRecord[];
};

const uniqueIPValues = (values: Array<string | undefined>) =>
	Array.from(
		new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]),
	).sort();

const deduplicateUserIPRecords = (records: UserIPRecord[]) => {
	const byIP = new Map<string, UserIPRecord>();
	for (const record of records) {
		const ip = (record.ip || record.assigned_ip || "").trim();
		const key =
			ip || `${record.node_id}:${record.protocol}:${record.session_id || ""}`;
		const current = byIP.get(key);
		if (!current) {
			byIP.set(key, {
				...record,
				ip,
				connections: Math.max(record.connections || 1, 1),
				node_names: uniqueIPValues([
					...(record.node_names || []),
					record.node_name,
				]),
				protocols: uniqueIPValues([
					...(record.protocols || []),
					record.protocol,
				]),
				inbound_tags: uniqueIPValues([
					...(record.inbound_tags || []),
					record.inbound_tag,
				]),
				assigned_ips: uniqueIPValues([
					...(record.assigned_ips || []),
					record.assigned_ip,
				]),
			});
			continue;
		}
		current.connections =
			(current.connections || 1) + Math.max(record.connections || 1, 1);
		current.node_names = uniqueIPValues([
			...(current.node_names || []),
			...(record.node_names || []),
			record.node_name,
		]);
		current.protocols = uniqueIPValues([
			...(current.protocols || []),
			...(record.protocols || []),
			record.protocol,
		]);
		current.inbound_tags = uniqueIPValues([
			...(current.inbound_tags || []),
			...(record.inbound_tags || []),
			record.inbound_tag,
		]);
		current.assigned_ips = uniqueIPValues([
			...(current.assigned_ips || []),
			...(record.assigned_ips || []),
			record.assigned_ip,
		]);
		if ((record.last_seen_at || "") > (current.last_seen_at || "")) {
			current.last_seen_at = record.last_seen_at;
		}
		if (!current.operator_short_name) {
			current.operator_short_name = record.operator_short_name;
		}
		if (!current.operator_owner) {
			current.operator_owner = record.operator_owner;
		}
	}
	return Array.from(byIP.values()).sort((left, right) =>
		(right.last_seen_at || "").localeCompare(left.last_seen_at || ""),
	);
};

const formatUsernamePreview = (username: string, maxLength = 20) =>
	username.length > maxLength
		? `${username.slice(0, Math.max(4, maxLength - 4))}...`
		: username;

const MobileLifetimeDetail: FC<{
	totalUsedTraffic: number;
}> = ({ totalUsedTraffic }) => (
	<p
		dir="ltr"
		className="text-[0.875rem] font-semibold text-panel-text truncate [unicode-bidi:isolate]"
	>
		{formatBytes(totalUsedTraffic)}
	</p>
);

const MobileUsageDetail: FC<{
	used: number;
	total: number | null;
}> = ({ used, total }) => (
	<p
		dir="ltr"
		className="text-[0.875rem] font-semibold text-panel-text truncate [unicode-bidi:isolate]"
	>
		{formatUsagePair(used, total)}
	</p>
);

const toMenuItems = (
	actions: DataTableRowAction<UserListItem>[],
	row: UserListItem,
): RowActionItem[] =>
	actions.map((action) => ({
		id: action.id,
		label: action.label,
		icon: action.icon,
		color: action.color,
		isDanger: action.isDanger,
		disabled:
			typeof action.disabled === "function"
				? action.disabled(row)
				: action.disabled,
		onClick: action.onClick ? () => action.onClick?.(row) : undefined,
	}));

type UsersTableProps = ComponentPropsWithoutRef<"div"> & {
	toolbar?: ReactNode;
	headerActions?: ReactNode;
};

export const UsersTable: FC<UsersTableProps> = ({
	toolbar,
	headerActions,
	...props
}) => {
	const {
		filters,
		users: usersResponse,
		onEditingUser,
		loading,
		deleteUser,
		resetDataUsage,
		revokeSubscription,
		refetchUsers,
		setQRCode,
		setSubLink,
		linkTemplates,
		onFilterChange,
	} = {
		filters: useDashboard((state) => state.filters),
		onFilterChange: useDashboard((state) => state.onFilterChange),
		users: useDashboard((state) => state.users),
		onEditingUser: useDashboard((state) => state.onEditingUser),
		loading: useDashboard((state) => state.loading),
		deleteUser: useDashboard((state) => state.deleteUser),
		resetDataUsage: useDashboard((state) => state.resetDataUsage),
		revokeSubscription: useDashboard((state) => state.revokeSubscription),
		refetchUsers: useDashboard((state) => state.refetchUsers),
		setQRCode: useDashboard((state) => state.setQRCode),
		setSubLink: useDashboard((state) => state.setSubLink),
		linkTemplates: useDashboard((state) => state.linkTemplates),
	};

	const { t, i18n } = useTranslation();
	const isDesktop = useBreakpointValue({ base: false, md: true }) ?? false;
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const locale = i18n.language || "en";

	const notify = useCallback(
		(
			title: string,
			status: "success" | "error",
			options?: { description?: string; duration?: number },
		) => {
			if (status === "error") {
				toast.error(title, {
					description: options?.description,
					duration: options?.duration ?? 2500,
				});
			} else {
				toast.success(title, {
					description: options?.description,
					duration: options?.duration ?? 2500,
				});
			}
		},
		[],
	);
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const hasFullAccess = userData.role === AdminRole.FullAccess;
	const userManagementLocked = isUserManagementLocked(
		userData,
		filters.serviceId,
	);
	const canViewTraffic = canViewUserTraffic(userData);
	const isAdminDisabled = Boolean(
		!hasPrivilegedRole && userData.status === AdminStatus.Disabled,
	);
	const canCreateUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Create]);
	const canDeleteUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Delete]);
	const canResetUsage =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.ResetUsage]);
	const canRevokeSub =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Revoke]);
	const canOpenUserDialog =
		!isAdminDisabled && (canCreateUsers || hasFullAccess);
	const canToggleUserStatus =
		!isAdminDisabled &&
		(canCreateUsers || hasFullAccess || userManagementLocked);
	const canMutateUsers =
		!isAdminDisabled && canCreateUsers && !userManagementLocked;
	const canDeleteUserActions = !isAdminDisabled && canDeleteUsers;
	const canResetUsageActions =
		!isAdminDisabled &&
		canResetUsage &&
		canViewTraffic &&
		!userManagementLocked;
	const canRevokeSubActions =
		!isAdminDisabled && canRevokeSub && !userManagementLocked;
	const disabledReason = userData.disabled_reason;

	const rowsToRender = filters.limit || 10;
	const compactRowActions = rowsToRender > 20;
	const isFiltered = usersResponse.users.length !== usersResponse.total;
	const hasUsageScopeFilter = Boolean(
		filters.search?.trim() ||
			filters.status ||
			(filters.advancedFilters && filters.advancedFilters.length > 0) ||
			filters.owner ||
			filters.serviceId,
	);
	const [contextAction, setContextAction] = useState<string | null>(null);
	const [expandedUsername, setExpandedUsername] = useState<string | null>(null);
	const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
	const [bulkAction, setBulkAction] = useState<string | null>(null);
	const [isBulkResetOpen, setIsBulkResetOpen] = useState(false);
	const [userPendingDelete, setUserPendingDelete] =
		useState<UserListItem | null>(null);
	const [ipDialog, setIPDialog] = useState<{
		username: string;
		records: UserIPRecord[];
		error?: string;
	} | null>(null);

	const visibleUsernames = useMemo(
		() => usersResponse.users.map((user) => user.username),
		[usersResponse.users],
	);
	const visibleUsernameSet = useMemo(
		() => new Set(visibleUsernames),
		[visibleUsernames],
	);
	const selectedUsernameSet = useMemo(
		() => new Set(selectedUsernames),
		[selectedUsernames],
	);
	const selectedUsers = useMemo(
		() =>
			usersResponse.users.filter((user) =>
				selectedUsernameSet.has(user.username),
			),
		[usersResponse.users, selectedUsernameSet],
	);
	const selectedUsersManagementLocked = selectedUsers.some((user) =>
		isUserManagementLocked(userData, user.service_id),
	);

	useEffect(() => {
		setSelectedUsernames((prev) =>
			prev.filter((username) => visibleUsernameSet.has(username)),
		);
	}, [visibleUsernameSet]);

	const clearSelectedUsers = () => setSelectedUsernames([]);

	const statusBreakdown = useMemo(() => {
		if (usersResponse.status_breakdown) {
			return usersResponse.status_breakdown;
		}
		const summary: Record<string, number> = {};
		usersResponse.users.forEach((user) => {
			summary[user.status] = (summary[user.status] ?? 0) + 1;
		});
		return summary;
	}, [usersResponse.status_breakdown, usersResponse.users]);

	const closeContextMenu = useCallback(() => undefined, []);

	const handleResetUsage = (user: UserListItem) => {
		useDashboard.setState({ resetUsageUser: user });
		closeContextMenu();
	};

	const handleRevokeSub = async (user: UserListItem) => {
		setContextAction("revoke");
		try {
			await revokeSubscription(user);
			notify(t("usersTable.revokeSub"), "success");
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
		} finally {
			setContextAction(null);
			closeContextMenu();
		}
	};

	const [trafficUser, setTrafficUser] = useState<UserListItem | null>(null);
	const handleAddTraffic = async (user: UserListItem, deltaBytes: number) => {
		const currentLimit = user.data_limit ?? 0;
		if (currentLimit <= 0) return;
		try {
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { data_limit: currentLimit + deltaBytes },
			});
			notify(t("usersTable.addTrafficSuccess"), "success");
			refetchUsers(true);
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
			throw error;
		}
	};

	const handleExtendExpire = async (user: UserListItem, days: number) => {
		if (user.expire === null || user.expire === 0 || user.expire === undefined)
			return;
		setContextAction("expire");
		try {
			const secondsToAdd = days * 86400;
			const nextExpire = Math.floor(user.expire + secondsToAdd);
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { expire: nextExpire },
			});
			notify(t("usersTable.extendExpireSuccess"), "success");
			refetchUsers(true);
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
		} finally {
			setContextAction(null);
			closeContextMenu();
		}
	};

	const handleDisableUser = async (user: UserListItem) => {
		if (!canToggleUserStatus || user.status === "disabled") return;
		setContextAction("disable");
		try {
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { status: "disabled" },
			});
			notify(t("usersTable.disableUser"), "success");
			refetchUsers(true);
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
		} finally {
			setContextAction(null);
			closeContextMenu();
		}
	};

	const handleEnableUser = async (user: UserListItem) => {
		if (!canToggleUserStatus || user.status !== "disabled") return;
		setContextAction("enable");
		try {
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { status: "active" },
			});
			notify(t("usersTable.enableUser"), "success");
			refetchUsers(true);
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
		} finally {
			setContextAction(null);
			closeContextMenu();
		}
	};

	const formatUserIPRecords = (records: UserIPRecord[]) => {
		if (records.length === 0) {
			return t("usersTable.noOnlineIps");
		}
		return records
			.map((record) => {
				const nodes = uniqueIPValues([
					...(record.node_names || []),
					record.node_name || `node-${record.node_id}`,
				]);
				const protocols = uniqueIPValues([
					...(record.protocols || []),
					record.protocol,
				]);
				const inbounds = uniqueIPValues([
					...(record.inbound_tags || []),
					record.inbound_tag,
				]);
				const ip = record.ip || record.assigned_ip || "-";
				const assigned = uniqueIPValues([
					...(record.assigned_ips || []),
					record.assigned_ip,
				]).filter((value) => value !== ip);
				const operator = record.operator_short_name || record.operator_owner;
				return `${protocols.join(", ")}${inbounds.length ? ` (${inbounds.join(", ")})` : ""} @ ${nodes.join(", ")}: ${ip}${assigned.length ? ` assigned=${assigned.join(",")}` : ""}${operator ? ` operator=${operator}` : ""}`;
			})
			.join("\n");
	};

	const handleGetIPs = async (user: UserListItem) => {
		setContextAction("ips");
		setIPDialog({ username: user.username, records: [] });
		closeContextMenu();
		try {
			const response = await fetch<UserIPsResponse>(
				`/user/${encodeURIComponent(user.username)}/ips`,
			);
			setIPDialog((current) =>
				current?.username === user.username
					? {
							username: user.username,
							records: deduplicateUserIPRecords(response.ips || []),
						}
					: current,
			);
		} catch (error: any) {
			const message =
				error?.data?.detail || error?.message || t("usersTable.getIpsFailed");
			setIPDialog((current) =>
				current?.username === user.username
					? { ...current, error: message }
					: current,
			);
		} finally {
			setContextAction(null);
		}
	};

	const handleCopyIPs = async () => {
		if (!ipDialog?.records.length) return;
		try {
			await copyTextToClipboard(formatUserIPRecords(ipDialog.records));
			notify(t("usersTable.ipsCopied"), "success", {
				duration: 1200,
			});
		} catch {
			notify(t("usersTable.copyFailed"), "error", {
				duration: 1600,
			});
		}
	};

	const handleDeleteUser = useCallback(
		async (user: UserListItem) => {
			setContextAction("delete");
			try {
				await deleteUser(user);
				notify(
					t("deleteUser.deleteSuccess", { username: user.username }),
					"success",
					{ duration: 3000 },
				);
				refetchUsers(true);
			} catch (error: any) {
				notify(error?.data?.detail || error?.message || t("error"), "error");
			} finally {
				setContextAction(null);
				closeContextMenu();
			}
		},
		[closeContextMenu, deleteUser, notify, refetchUsers, t],
	);

	const runBulkUserAction = async (
		action: string,
		users: UserListItem[],
		handler: (user: UserListItem) => Promise<unknown>,
		successLabel: string,
	) => {
		if (!users.length || bulkAction) return;
		setBulkAction(action);
		try {
			await Promise.all(users.map((user) => handler(user)));
			notify(successLabel, "success", {
				description: t("usersTable.bulkActionCount", {
					count: users.length,
				}),
			});
			clearSelectedUsers();
			refetchUsers(true);
		} catch (error: any) {
			notify(error?.data?.detail || error?.message || t("error"), "error");
		} finally {
			setBulkAction(null);
		}
	};

	const bulkDisableTargets = selectedUsers.filter(
		(user) => user.status !== "disabled",
	);
	const bulkEnableTargets = selectedUsers.filter(
		(user) => user.status === "disabled",
	);
	const bulkDeleteTargets = selectedUsers.filter((user) =>
		canDeleteUserByTrafficCap(userData, user),
	);

	const handleBulkDisable = () =>
		runBulkUserAction(
			"disable",
			bulkDisableTargets,
			(user) =>
				fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
					method: "PUT",
					body: { status: "disabled" },
				}),
			t("usersTable.disableUser"),
		);

	const handleBulkEnable = () =>
		runBulkUserAction(
			"enable",
			bulkEnableTargets,
			(user) =>
				fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
					method: "PUT",
					body: { status: "active" },
				}),
			t("usersTable.enableUser"),
		);

	const handleBulkReset = async () => {
		await runBulkUserAction(
			"reset",
			selectedUsers,
			(user) => resetDataUsage(user),
			t("usersTable.resetUsage"),
		);
		setIsBulkResetOpen(false);
	};

	const handleBulkRevoke = () =>
		runBulkUserAction(
			"revoke",
			selectedUsers,
			(user) => revokeSubscription(user),
			t("usersTable.revokeSub"),
		);

	const handleBulkDelete = () =>
		runBulkUserAction(
			"delete",
			bulkDeleteTargets,
			(user) => deleteUser(user),
			t("deleteUser.title"),
		);

	const userColumns = useMemo<DataTableColumn<UserListItem>[]>(() => {
		const columns: DataTableColumn<UserListItem>[] = [
			{
				id: "online",
				menuLabel: t("usersTable.online"),
				header: t("usersTable.online"),
				priority: "high",
				width: "76px",
				minWidth: "72px",
				maxWidth: "84px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: false,
				mobilePriority: 1,
				mobileMetaLabel: t("usersTable.online"),
				cell: (user) => <UserPresence user={user} />,
			},
			{
				id: "username",
				menuLabel: t("username"),
				header: t("username"),
				accessor: "username",
				sortable: true,
				isPrimary: true,
				priority: "primary",
				width: { lg: "150px", xl: "168px" },
				minWidth: "148px",
				maxWidth: "188px",
				truncate: true,
				tooltip: true,
				multiline: true,
				cellAlign: "start",
				mobilePriority: 0,
				mobileMetaLabel: t("username"),
				cell: (user) => (
					<div className="flex flex-col gap-0.5 min-w-0! items-start">
						<div className="flex flex-row items-center gap-1.5 min-w-0! max-w-full">
							<MobileUserOnlineDot user={user} />
							<p
								dir="ltr"
								className={cn(
									canOpenUserDialog ? "hover:text-panel-accent" : "",
									"font-semibold truncate max-w-full min-w-0! text-panel-text [unicode-bidi:isolate]",
								)}
							>
								{formatUsernamePreview(user.username)}
							</p>
						</div>
						<UserAdminChip adminUsername={user.admin_username} />
						<p
							style={{
								color:
									USER_STATUS_TEXT_COLORS[user.status] ??
									"var(--rb-panel-text)",
							}}
							className="text-[0.75rem] font-semibold capitalize rb-user-card-status"
						>
							{t(`status.${user.status}`)}
						</p>
					</div>
				),
			},
			{
				id: "id",
				menuLabel: t("usersTable.userId"),
				header: t("usersTable.userId"),
				accessor: (user) => user.id,
				sortable: true,
				width: "96px",
				minWidth: "84px",
				maxWidth: "120px",
				cellAlign: "start",
				mobileVisible: false,
				cell: (user) => (
					<p dir="ltr" className="text-[0.875rem] text-panel-text font-mono">
						{user.id}
					</p>
				),
			},
			{
				id: "status",
				menuLabel: t("status"),
				header: t("usersTable.status"),
				priority: "high",
				width: "112px",
				minWidth: "96px",
				maxWidth: "128px",
				headerAlign: "start",
				cellAlign: "start",
				mobilePriority: 2,
				mobileMetaLabel: t("usersTable.status"),
				cell: (user) => (
					<p
						style={{
							color:
								USER_STATUS_TEXT_COLORS[user.status] ?? "var(--rb-panel-text)",
						}}
						className="text-[0.875rem] font-semibold capitalize"
					>
						{t(`status.${user.status}`)}
					</p>
				),
			},
			{
				id: "service",
				menuLabel: t("usersTable.service"),
				header: t("usersTable.service"),
				accessor: (user) => user.service_name ?? t("usersTable.defaultService"),
				priority: "high",
				width: "118px",
				minWidth: "96px",
				maxWidth: "138px",
				truncate: true,
				tooltip: true,
				mobilePriority: 3,
				mobileVisible: true,
				mobileMetaLabel: t("usersTable.service"),
				cell: (user) => (
					<p
						className={cn(
							"text-[0.875rem] truncate max-w-full",
							user.service_name ? "text-panel-text" : "text-panel-text-muted",
						)}
					>
						{user.service_name ?? t("usersTable.defaultService")}
					</p>
				),
			},
			{
				id: "group",
				menuLabel: t("groups.group"),
				header: t("groups.group"),
				accessor: (user) => user.group?.name ?? "",
				priority: "medium",
				width: "110px",
				minWidth: "88px",
				maxWidth: "140px",
				truncate: true,
				tooltip: true,
				mobilePriority: 4,
				mobileVisible: true,
				mobileMetaLabel: t("groups.group"),
				cell: (user) => (
					<p
						className={cn(
							"text-[0.875rem] truncate max-w-full",
							user.group ? "text-panel-text" : "text-panel-text-muted",
						)}
					>
						{user.group?.name ?? "–"}
					</p>
				),
			},
			{
				id: "tags",
				menuLabel: t("tags.title"),
				header: t("tags.title"),
				priority: "low",
				width: "170px",
				minWidth: "120px",
				maxWidth: "220px",
				mobilePriority: 5,
				mobileVisible: true,
				mobileMetaLabel: t("tags.title"),
				cell: (user) => <TagChips tags={user.tags} limit={2} />,
			},
		];

		if (canViewTraffic) {
			columns.push({
				id: "used_traffic",
				menuLabel: t("usersTable.traffic"),
				header: t("usersTable.traffic"),
				sortable: true,
				priority: "high",
				width: "clamp(188px, 15vw, 240px)",
				minWidth: "188px",
				maxWidth: "240px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: true,
				mobileSummary: true,
				mobilePriority: 4,
				mobileMetaLabel: t("usersTable.traffic"),
				mobileDetailCell: (user) => (
					<MobileUsageDetail used={user.used_traffic} total={user.data_limit} />
				),
				cell: (user) => (
					<UserUsageBar
						variant="compact"
						used={user.used_traffic}
						total={user.data_limit}
					/>
				),
			});
			columns.push({
				id: "speed",
				menuLabel: t("usersTable.speed"),
				header: t("usersTable.speed"),
				priority: "high",
				width: "120px",
				minWidth: "112px",
				maxWidth: "136px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: true,
				mobilePriority: 5,
				mobileMetaLabel: t("usersTable.speed"),
				cell: (user) => <UserSpeed user={user} />,
			});
			columns.push({
				id: "remaining_traffic",
				menuLabel: t("usersTable.remainingTraffic"),
				header: t("usersTable.remainingTraffic"),
				priority: "high",
				width: "132px",
				minWidth: "114px",
				maxWidth: "148px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: true,
				mobilePriority: 6,
				mobileMetaLabel: t("usersTable.remainingTraffic"),
				cell: (user) => (
					<p
						dir="ltr"
						className={cn(
							"leading-[1]",
							!user.data_limit ? "text-[1.25rem]" : "text-[0.875rem]",
							!user.data_limit ? "font-semibold" : "",
							!user.data_limit ? "text-panel-text-muted" : "text-panel-text",
						)}
					>
						{!user.data_limit ? (
							<>
								<span aria-hidden="true">∞</span>
								<span className="sr-only">{t("unlimited")}</span>
							</>
						) : (
							formatBytes(Math.max(user.data_limit - user.used_traffic, 0))
						)}
					</p>
				),
			});
			columns.push({
				id: "lifetime_used_traffic",
				menuLabel: t("usersTable.lifetimeUsage"),
				header: t("usersTable.lifetimeUsage"),
				priority: "high",
				width: "132px",
				minWidth: "114px",
				maxWidth: "148px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: true,
				mobilePriority: 7,
				mobileMetaLabel: t("usersTable.lifetimeUsage"),
				cell: (user) => (
					<MobileLifetimeDetail totalUsedTraffic={user.lifetime_used_traffic} />
				),
			});
		}

		columns.push({
			id: "expire",
			menuLabel: t("usersTable.expire"),
			header: t("usersTable.expire"),
			sortable: true,
			priority: "high",
			width: "152px",
			minWidth: "132px",
			maxWidth: "148px",
			headerAlign: "start",
			cellAlign: "start",
			mobileVisible: true,
			mobilePriority: 8,
			mobileMetaLabel: t("usersTable.expire"),
			cell: (user) => (
				<UserExpiryCountdown expire={user.expire} status={user.status} />
			),
		});

		if (hasPrivilegedRole) {
			columns.push({
				id: "admin",
				menuLabel: t("usersTable.admin"),
				header: t("usersTable.admin"),
				desktopVisible: false,
				mobileVisible: true,
				mobilePriority: 9,
				mobileMetaLabel: t("usersTable.admin"),
				cell: (user) => <UserAdminChip adminUsername={user.admin_username} />,
			});
		}

		columns.push({
			id: "last_connection",
			header: t("bulkActions.delete.lastOnline"),
			desktopVisible: false,
			mobileVisible: true,
			mobilePriority: 10,
			mobileMetaLabel: t("bulkActions.delete.lastOnline"),
			cell: (user) => (
				<OnlineStatus
					lastOnline={user.online_at ?? null}
					isOnline={user.is_online}
					withMargin={false}
					compact
				/>
			),
		});

		return columns;
	}, [canOpenUserDialog, canViewTraffic, hasPrivilegedRole, t]);

	const userSorting = useMemo<SortingState>(() => {
		const currentSort = filters.sort || "";
		const desc = currentSort.startsWith("-");
		const id = desc ? currentSort.slice(1) : currentSort;
		if (!id) return [];
		return [{ id, desc }];
	}, [filters.sort]);

	const formatUserLink = (link?: string | null) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	};

	const copyUserText = async (text: string, successLabel: string) => {
		if (!text) return false;
		try {
			await copyTextToClipboard(text);
			notify(successLabel, "success", { duration: 1200 });
			return true;
		} catch {
			notify(t("usersTable.copyFailed"), "error", {
				duration: 1600,
			});
			return false;
		}
	};

	const getUserRowActions = (
		user: UserListItem,
	): DataTableRowAction<UserListItem>[] => {
		const rowManagementLocked = isUserManagementLocked(
			userData,
			user.service_id,
		);
		const canMutateRow = canMutateUsers && !rowManagementLocked;
		const subscriptionLink = formatUserLink(user.subscription_url);
		const configLinks = generateUserLinks(user, linkTemplates);
		const configLinksText = configLinks.join("\n");
		const actions: DataTableRowAction<UserListItem>[] = [
			{
				id: "copy-subscription",
				label: t("usersTable.copyLink"),
				icon: <SubscriptionLinkIcon />,
				disabled: !subscriptionLink,
				onClick: () => copyUserText(subscriptionLink, t("copied")),
			},
			{
				id: "copy-configs",
				label: t("usersTable.copyConfigs"),
				icon: <CopyIcon />,
				disabled: configLinks.length === 0,
				onClick: () => copyUserText(configLinksText, t("copied")),
			},
			{
				id: "qr",
				label: t("usersTable.qrCode"),
				icon: <QRIcon />,
				onClick: () => {
					setQRCode(configLinks, user.username);
					setSubLink(subscriptionLink);
				},
			},
			{
				id: "get-ips",
				label: t("usersTable.getIps"),
				icon: <IPsIcon />,
				disabled: contextAction === "ips",
				onClick: () => handleGetIPs(user),
			},
		];

		if (canOpenUserDialog && !rowManagementLocked) {
			actions.push({
				id: "edit",
				label: t("userDialog.editUser"),
				icon: <EditIcon />,
				onClick: () => onEditingUser(user),
			});
		}

		if (canViewTraffic) {
			actions.push({
				id: "usage-history",
				label: t("usersTable.usageHistory"),
				icon: <UsageHistoryIcon />,
				onClick: () => onEditingUser(user, 1),
			});
		}

		if (
			canToggleUserStatus &&
			!rowManagementLocked &&
			user.status !== "disabled"
		) {
			actions.push({
				id: "disable",
				label: t("usersTable.disableUser"),
				icon: <DisableIcon />,
				disabled: contextAction === "disable",
				onClick: () => handleDisableUser(user),
			});
		}

		if (
			canToggleUserStatus &&
			!rowManagementLocked &&
			user.status === "disabled"
		) {
			actions.push({
				id: "enable",
				label: t("usersTable.enableUser"),
				icon: <CheckIcon className="w-[16px]" />,
				disabled: contextAction === "enable",
				onClick: () => handleEnableUser(user),
			});
		}

		if (canResetUsageActions && !rowManagementLocked) {
			actions.push({
				id: "reset",
				label: t("usersTable.resetUsage"),
				icon: <ResetIcon />,
				disabled: contextAction === "reset",
				onClick: () => handleResetUsage(user),
			});
		}

		if (canRevokeSubActions && !rowManagementLocked) {
			actions.push({
				id: "revoke",
				label: t("usersTable.revokeSub"),
				icon: <RevokeIcon />,
				disabled: contextAction === "revoke",
				onClick: () => handleRevokeSub(user),
			});
		}

		if (canMutateRow && user.data_limit !== null && user.data_limit !== 0) {
			actions.push({
				id: "add-traffic",
				label: t("services.userActions.traffic.add"),
				icon: <TrafficIcon />,
				onClick: () => setTrafficUser(user),
			});
		}

		if (canMutateRow) {
			actions.push({
				id: "set-data-limit",
				label: t("usersTable.setDataLimit"),
				icon: <DataLimitIcon />,
				onClick: () =>
					useDashboard.setState({
						quickEditUser: { user, field: "data_limit" },
					}),
			});
		}

		if (
			canMutateRow &&
			user.expire !== null &&
			user.expire !== 0 &&
			user.expire !== undefined
		) {
			actions.push({
				id: "extend-expire",
				label: t("usersTable.add30Days"),
				icon: <ExtendIcon />,
				disabled: contextAction === "expire",
				onClick: () => handleExtendExpire(user, 30),
			});
		}

		if (canMutateRow) {
			actions.push({
				id: "set-expiry",
				label: t("usersTable.setExpiry"),
				icon: <ExpiryIcon />,
				onClick: () =>
					useDashboard.setState({
						quickEditUser: { user, field: "expire" },
					}),
			});
		}

		if (canDeleteUserActions && canDeleteUserByTrafficCap(userData, user)) {
			actions.push({
				id: "delete",
				label: t("deleteUser.title"),
				icon: <DeleteIcon />,
				isDanger: true,
				onClick: () => setUserPendingDelete(user),
			});
		}

		return actions;
	};

	const [columnVisibility, setColumnVisibility] =
		usePersistedColumnVisibility("users");
	const filteredUsageTotal = usersResponse.usage_total ?? null;
	const activeUsersCount =
		statusBreakdown.active ?? usersResponse.active_total ?? 0;
	const usageForSummary = canViewTraffic ? filteredUsageTotal : null;

	const renderExpandedUser = (user: UserListItem) => {
		const detailColumns = userColumns.filter(
			(column) => column.id !== "username" && column.mobileVisible !== false,
		);
		const availableActions = toMenuItems(getUserRowActions(user), user);
		const primaryActions = [
			user.status === "disabled" ? "enable" : "disable",
			"revoke",
			"reset",
			"get-ips",
		].flatMap((id) => {
			const action = availableActions.find((item) => item.id === id);
			return action ? [action] : [];
		});
		return (
			<div className="my-2.5 flex flex-col gap-3.5 rounded-2xl border border-panel-border bg-panel-elevated/40 p-4 shadow-sm sm:p-5">
				<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
					<div className="flex flex-col gap-1 rounded-xl border border-panel-border/60 bg-panel-surface p-3 transition-colors">
						<span className="text-[11px] font-medium text-panel-text-muted">
							{t("username")}
						</span>
						<p
							dir="ltr"
							className="truncate text-xs font-semibold text-panel-text [unicode-bidi:isolate] sm:text-sm"
						>
							{user.username}
						</p>
					</div>
					{detailColumns.map((column) => {
						const value =
							column.mobileDetailCell?.(user) ?? column.cell?.(user);
						if (value === null || value === undefined || value === "")
							return null;
						return (
							<div
								key={column.id}
								className="flex min-w-0 flex-col gap-1 rounded-xl border border-panel-border/60 bg-panel-surface p-3 transition-colors"
							>
								<span className="truncate text-[11px] font-medium text-panel-text-muted">
									{column.mobileMetaLabel ??
										column.mobileLabel ??
										column.header}
								</span>
								<div className="min-w-0 truncate text-xs font-semibold tabular-nums text-panel-text sm:text-sm">
									{value}
								</div>
							</div>
						);
					})}
				</div>
				<div
					role="presentation"
					onKeyDown={(event) => event.stopPropagation()}
					onClick={(event) => event.stopPropagation()}
					className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-border/50 pt-3"
				>
					<div className="flex flex-wrap items-center gap-1.5">
						{primaryActions.map((action) => (
							<Button
								key={action.id}
								type="button"
								variant="outline"
								size="sm"
								disabled={action.disabled}
								onClick={() => action.onClick?.()}
								className="h-8 gap-1.5 rounded-xl border-panel-border bg-panel-surface px-3 text-xs font-medium text-panel-text transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-accent active:scale-[0.98] touch-manipulation"
							>
								<span className="size-3.5 shrink-0 [&>svg]:size-3.5">
									{action.icon}
								</span>
								<span>{action.label}</span>
							</Button>
						))}
					</div>
					<div className="ms-auto flex items-center gap-1">
						<ActionButtons
							user={user}
							isRTL={isRTL}
							onEdit={
								canOpenUserDialog &&
								!isUserManagementLocked(userData, user.service_id)
									? () => onEditingUser(user)
									: undefined
							}
							onDelete={
								canDeleteUserActions &&
								canDeleteUserByTrafficCap(userData, user)
									? () => handleDeleteUser(user)
									: undefined
							}
						/>
					</div>
				</div>
			</div>
		);
	};

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			data-dir={isRTL ? "rtl" : "ltr"}
			{...props}
			className={cn(
				"flex flex-col gap-4 items-stretch",
				selectedUsers.length > 0 ? "pb-32" + " " + "md:pb-24" : "pb-0",
			)}
		>
			<AddTrafficDialog
				target={
					trafficUser ? { kind: "user", name: trafficUser.username } : null
				}
				onClose={() => setTrafficUser(null)}
				onApply={(deltaBytes) =>
					trafficUser
						? handleAddTraffic(trafficUser, deltaBytes)
						: Promise.resolve()
				}
			/>
			<UsersOverviewBand
				selection={usersOverviewSelection(filters)}
				onSelect={(target) =>
					onFilterChange(nextUsersFiltersForOverview(filters, target))
				}
				total={usersResponse.total}
				usersLimit={usersResponse.users_limit ?? null}
				active={activeUsersCount}
				online={usersResponse.online_total ?? 0}
				usage={usageForSummary}
				usageLabel={
					hasUsageScopeFilter
						? t("usersTable.filteredUsage")
						: t("usersTable.listUsage")
				}
				breakdown={
					statusBreakdown as Partial<
						Record<
							"active" | "expired" | "limited" | "on_hold" | "disabled",
							number
						>
					>
				}
				locale={locale}
			/>

			<div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-surface p-3 sm:p-4 shadow-xs">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div className="flex-1 min-w-0">{toolbar}</div>
					<div className="flex flex-row items-center gap-2 shrink-0">
						<DataTableColumnMenu
							columns={userColumns}
							visibility={columnVisibility}
							onChange={setColumnVisibility}
						/>
						{headerActions}
					</div>
				</div>
			</div>

			<div className="relative">
				<div
					aria-hidden={isAdminDisabled ? true : undefined}
					className={cn(
						"flex flex-col gap-3",
						isAdminDisabled ? "[filter:blur(4px)]" : "",
						isAdminDisabled ? "pointer-events-none" : "",
					)}
				>
					<DataTable
						ariaLabel={t("users")}
						data={usersResponse.users}
						columns={userColumns}
						getRowId={(user) => user.username}
						loading={loading}
						loadingRows={rowsToRender}
						emptyState={
							<EmptySection
								isFiltered={isFiltered}
								isCreateDisabled={
									isAdminDisabled || !canCreateUsers || userManagementLocked
								}
							/>
						}
						enableSelection
						columnVisibility={columnVisibility}
						selectedRowIds={selectedUsernames}
						selectedRows={selectedUsers}
						selectedCount={selectedUsers.length}
						onSelectionChange={(rowIds) => setSelectedUsernames(rowIds)}
						rowActions={getUserRowActions}
						renderRowActions={(user) => (
							<ActionButtons
								user={user}
								isRTL={isRTL}
								menuActions={toMenuItems(getUserRowActions(user), user)}
								onEdit={
									canOpenUserDialog &&
									!isUserManagementLocked(userData, user.service_id)
										? () => onEditingUser(user)
										: undefined
								}
								onDelete={
									canDeleteUserActions &&
									canDeleteUserByTrafficCap(userData, user)
										? () => handleDeleteUser(user)
										: undefined
								}
							/>
						)}
						actionsDisplay={compactRowActions ? "menu" : "inline"}
						actionsPlacement="end"
						actionsColumnWidth={compactRowActions ? "64px" : "max-content"}
						actionsAlwaysVisible
						onRowClick={
							isDesktop
								? (user) =>
										setExpandedUsername((current) =>
											current === user.username ? null : user.username,
										)
								: undefined
						}
						isRowExpanded={
							isDesktop
								? (user) => expandedUsername === user.username
								: undefined
						}
						renderExpandedRow={isDesktop ? renderExpandedUser : undefined}
						sorting={userSorting}
						manualSorting
						showSortMenu={false}
						dir={isRTL ? "rtl" : "ltr"}
						selectedLabel={t("usersTable.selectedCount", {
							count: selectedUsers.length,
						})}
						renderBulkActions={() => (
							<>
								{canToggleUserStatus && (
									<Button
										onClick={handleBulkDisable}
										disabled={
											Boolean(bulkAction) ||
											selectedUsersManagementLocked ||
											bulkDisableTargets.length === 0
										}
										variant="outline"
										size="sm"
										loading={bulkAction === "disable"}
										className="h-8.5 gap-1.5 rounded-xl border-panel-border bg-panel-surface px-3 text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
									>
										{<DisableIcon />}
										{t("usersTable.disableUser")}
									</Button>
								)}
								{canToggleUserStatus && (
									<Button
										onClick={handleBulkEnable}
										disabled={
											Boolean(bulkAction) ||
											selectedUsersManagementLocked ||
											bulkEnableTargets.length === 0
										}
										variant="outline"
										size="sm"
										loading={bulkAction === "enable"}
										className="h-8.5 gap-1.5 rounded-xl border-panel-border bg-panel-surface px-3 text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
									>
										{<CheckIcon className="w-[16px]" />}
										{t("usersTable.enableUser")}
									</Button>
								)}
								{canResetUsageActions && (
									<Button
										onClick={() => setIsBulkResetOpen(true)}
										disabled={
											Boolean(bulkAction) ||
											selectedUsersManagementLocked ||
											selectedUsers.length === 0
										}
										variant="outline"
										size="sm"
										loading={bulkAction === "reset"}
										className="h-8.5 gap-1.5 rounded-xl border-panel-border bg-panel-surface px-3 text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
									>
										{<ResetIcon />}
										{t("usersTable.resetUsage")}
									</Button>
								)}
								{canRevokeSubActions && (
									<Button
										onClick={handleBulkRevoke}
										disabled={
											Boolean(bulkAction) ||
											selectedUsersManagementLocked ||
											selectedUsers.length === 0
										}
										variant="outline"
										size="sm"
										loading={bulkAction === "revoke"}
										className="h-8.5 gap-1.5 rounded-xl border-panel-border bg-panel-surface px-3 text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
									>
										{<RevokeIcon />}
										{t("usersTable.revokeSub")}
									</Button>
								)}
								{canDeleteUserActions && (
									<DeleteConfirmDialog
										description={t("usersTable.bulkDeletePrompt")}
										onConfirm={handleBulkDelete}
									>
										<Button
											disabled={
												Boolean(bulkAction) || bulkDeleteTargets.length === 0
											}
											variant="outline"
											size="sm"
											loading={bulkAction === "delete"}
											className="h-8.5 gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 text-xs font-medium text-destructive transition-colors min-[769px]:hover:bg-destructive/20 active:scale-[0.98] touch-manipulation"
										>
											{<DeleteIcon />}
											{t("delete")}
										</Button>
									</DeleteConfirmDialog>
								)}
							</>
						)}
						tableProps={{
							className:
								"w-full [table-layout:fixed] [&_th]:px-2.5 [&_td]:px-2.5 [&_th]:py-3 [&_td]:py-3 [&_th]:align-middle [&_td]:align-middle",
						}}
					/>
				</div>
				{isAdminDisabled && (
					<div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-panel-app/90 p-6 text-center">
						<LockOverlayIcon className="mb-4 text-panel-danger opacity-90" />
						<p className="mb-2 text-lg font-bold text-panel-text">
							{t("usersTable.adminDisabledTitle")}
						</p>
						<p className="max-w-md text-sm text-panel-text-muted">
							{disabledReason || t("usersTable.adminDisabledDescription")}
						</p>
					</div>
				)}
			</div>
			<AppDialog
				open={ipDialog !== null}
				onClose={() => setIPDialog(null)}
				title={t("usersTable.ipsDialogTitle")}
				size="lg"
				contentProps={{
					className:
						"bg-panel-surface border-panel-border border rounded-[20px] overflow-hidden shadow-2xl",
				}}
				bodyProps={{ className: "pb-5 px-6 pt-2" }}
				footer={
					<div className="flex flex-row items-center w-full justify-end gap-2">
						<Button
							onClick={() => setIPDialog(null)}
							variant="outline"
							size="sm"
							className="h-9 rounded-xl border-panel-border px-4 text-xs font-medium text-panel-text min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
						>
							{t("close")}
						</Button>
						<Button
							onClick={handleCopyIPs}
							disabled={
								contextAction === "ips" ||
								Boolean(ipDialog?.error) ||
								!ipDialog?.records.length
							}
							size="sm"
							className="h-9 gap-1.5 rounded-xl bg-panel-accent px-4 text-xs font-semibold text-white shadow-xs min-[769px]:hover:bg-panel-accent/90 active:scale-[0.98] touch-manipulation"
						>
							{<CopyIcon />}
							{t("usersTable.copyIps")}
						</Button>
					</div>
				}
			>
				<div className="flex flex-col gap-4">
					<div>
						<div className="flex flex-row justify-between items-baseline gap-3">
							<p dir="ltr" className="font-bold truncate">
								{ipDialog?.username}
							</p>
							{contextAction !== "ips" && !ipDialog?.error && (
								<p className="text-[0.75rem] text-panel-text-muted shrink-0">
									{t("usersTable.ipsDialogCount", {
										count: ipDialog?.records.length ?? 0,
									})}
								</p>
							)}
						</div>
						<p className="mt-1 text-[0.875rem] text-panel-text-muted">
							{t("usersTable.ipsDialogDescription")}
						</p>
					</div>

					{contextAction === "ips" ? (
						<div className="flex items-center justify-center gap-3 py-8">
							<Spinner className="text-panel-accent" />
							<p className="text-[0.875rem] text-panel-text-muted">
								{t("usersTable.ipsDialogLoading")}
							</p>
						</div>
					) : ipDialog?.error ? (
						<div
							role="alert"
							className="border border-red-500/40 rounded-xl bg-red-500/10 text-red-500 px-3.5 py-3 text-[0.875rem]"
						>
							{ipDialog.error}
						</div>
					) : !ipDialog?.records.length ? (
						<div className="border border-panel-border/60 rounded-xl px-4 py-8 text-center bg-panel-elevated/30">
							<p className="text-[0.875rem] text-panel-text-muted">
								{t("usersTable.ipsDialogEmpty")}
							</p>
						</div>
					) : (
						<div className="flex flex-col gap-3">
							{ipDialog.records.map((record, index) => {
								const nodes = uniqueIPValues([
									...(record.node_names || []),
									record.node_name || `node-${record.node_id}`,
								]);
								const protocols = uniqueIPValues([
									...(record.protocols || []),
									record.protocol,
								]);
								const inbounds = uniqueIPValues([
									...(record.inbound_tags || []),
									record.inbound_tag,
								]);
								const ip = record.ip || record.assigned_ip || "-";
								const metadata = [
									protocols.join(", "),
									inbounds.join(", "),
									nodes.join(", "),
								]
									.filter(Boolean)
									.join(" · ");
								const assignedIPs = uniqueIPValues([
									...(record.assigned_ips || []),
									record.assigned_ip,
								]).filter((value) => value !== ip);
								const connections = Math.max(record.connections || 1, 1);

								return (
									<article
										key={ip === "-" ? `${metadata}-${index}` : ip}
										className="p-3.5 border border-panel-border/70 rounded-xl bg-panel-elevated/40"
									>
										<div className="flex-col sm:flex-row flex justify-between items-stretch sm:items-start gap-3">
											<OperatorIdentity
												shortName={record.operator_short_name}
												owner={record.operator_owner}
											/>
											<div className="min-w-0! text-start sm:text-end">
												<p
													dir="ltr"
													className="font-mono font-bold text-[0.875rem] [overflow-wrap:anywhere]"
												>
													{ip}
												</p>
												<div className="flex flex-row items-center mt-0.5 gap-1 justify-start sm:justify-end text-panel-text-secondary text-[0.75rem]">
													<Signal aria-hidden="true" className="w-[14px]" />
													<p>
														{t("usersTable.ipConnections_other", {
															count: connections,
														})}
													</p>
												</div>
											</div>
										</div>

										<div className="flex flex-row items-center mt-3 gap-3 flex-wrap text-panel-text-muted text-[0.75rem]">
											{protocols.length > 0 && (
												<div className="flex flex-row items-center gap-1">
													<Globe aria-hidden="true" className="w-[14px]" />
													<p>{protocols.join(", ")}</p>
												</div>
											)}
											{inbounds.length > 0 && (
												<div className="flex flex-row items-center gap-1">
													<Link aria-hidden="true" className="w-[14px]" />
													<p>{inbounds.join(", ")}</p>
												</div>
											)}
											{nodes.length > 0 && (
												<div className="flex flex-row items-center gap-1">
													<Server aria-hidden="true" className="w-[14px]" />
													<p>{nodes.join(", ")}</p>
												</div>
											)}
											{record.last_seen_at && (
												<div className="flex flex-row items-center gap-1">
													<Clock aria-hidden="true" className="w-[14px]" />
													<p dir="ltr">
														{dayjs(record.last_seen_at).format(
															"YYYY-MM-DD HH:mm",
														)}
													</p>
												</div>
											)}
										</div>
										{assignedIPs.length > 0 && (
											<p className="mt-1 text-[0.75rem] text-panel-text-secondary [overflow-wrap:anywhere]">
												{t("usersTable.assignedIp")}:{" "}
												<span dir="ltr" className="inline-block">
													{assignedIPs.join(", ")}
												</span>
											</p>
										)}
									</article>
								);
							})}
						</div>
					)}
				</div>
			</AppDialog>
			<ConfirmDialog
				open={Boolean(userPendingDelete)}
				onClose={() => setUserPendingDelete(null)}
				onConfirm={async () => {
					if (!userPendingDelete) return;
					await handleDeleteUser(userPendingDelete);
					setUserPendingDelete(null);
				}}
				title={t("common.confirmAction")}
				description={t("deleteUser.prompt", {
					username: userPendingDelete?.username ?? "",
				})}
				confirmLabel={t("delete")}
				colorScheme="red"
			/>
			<ConfirmDialog
				open={isBulkResetOpen}
				onClose={() => setIsBulkResetOpen(false)}
				onConfirm={handleBulkReset}
				title={t("usersTable.resetUsage")}
				description={t("usersTable.bulkResetPrompt", {
					count: selectedUsers.length,
				})}
				confirmLabel={t("reset")}
				loading={bulkAction === "reset"}
				isConfirmDisabled={selectedUsers.length === 0}
			/>
		</div>
	);
};

type ActionButtonsUser = User | UserListItem;
type ActionButtonsProps = {
	user: ActionButtonsUser;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	isRTL?: boolean;
	menuActions?: RowActionItem[];
};

const ActionButtons: FC<ActionButtonsProps> = ({
	user,
	onDelete,
	onEdit,
	isRTL,
	menuActions,
}) => {
	const { t } = useTranslation();
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const linkTemplates = useDashboard((state) => state.linkTemplates);

	const userLinks = generateUserLinks(user, linkTemplates);
	const formatLink = (link?: string | null) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	};
	const subscriptionLink = formatLink(user.subscription_url);
	const configLinksText = userLinks.join("\n");
	const hasConfigLinks = userLinks.length > 0;

	const [copied, setCopied] = useState(false);
	const [copiedConfigs, setCopiedConfigs] = useState(false);
	useEffect(() => {
		if (copied) {
			setTimeout(() => {
				setCopied(false);
			}, 1000);
		}
	}, [copied]);
	useEffect(() => {
		if (copiedConfigs) {
			setTimeout(() => {
				setCopiedConfigs(false);
			}, 1000);
		}
	}, [copiedConfigs]);

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
			}}
			className={cn(
				"flex flex-row items-center gap-1 flex-nowrap",
				isRTL ? "justify-start" : "justify-end",
			)}
		>
			<RowActionButton
				label={copied ? t("copied") : t("usersTable.copyLink")}
				icon={copied ? <CopiedIcon /> : <SubscriptionLinkIcon />}
				disabled={!subscriptionLink}
				onClick={() => {
					void copyTextToClipboard(subscriptionLink)
						.then(() => {
							setCopied(true);
						})
						.catch(() => undefined);
				}}
			/>
			<RowActionButton
				label={copiedConfigs ? t("copied") : t("usersTable.copyConfigs")}
				icon={copiedConfigs ? <CopiedIcon /> : <CopyIcon />}
				disabled={!hasConfigLinks}
				onClick={() => {
					void copyTextToClipboard(configLinksText)
						.then(() => setCopiedConfigs(true))
						.catch(() => undefined);
				}}
			/>
			<RowActionButton
				label={t("usersTable.qrCode")}
				icon={<QRIcon />}
				onClick={() => {
					const links = generateUserLinks(user, linkTemplates);
					setQRCode(links, user.username);
					setSubLink(subscriptionLink);
				}}
			/>
			{onEdit && (
				<RowActionButton
					label={t("userDialog.editUser")}
					icon={<EditIcon />}
					onClick={onEdit}
				/>
			)}
			{onDelete && (
				<DeleteConfirmDialog
					description={t("deleteUser.prompt", { username: user.username })}
					onConfirm={onDelete}
				>
					<RowActionButton
						label={t("deleteUser.title")}
						icon={<DeleteIcon />}
						danger
					/>
				</DeleteConfirmDialog>
			)}
			{menuActions && menuActions.length > 0 && (
				<RowActionsMenu actions={menuActions} label={t("actions")} />
			)}
		</div>
	);
};

type EmptySectionProps = {
	isFiltered: boolean;
	isCreateDisabled: boolean;
};

const EmptySection: FC<EmptySectionProps> = ({
	isFiltered,
	isCreateDisabled,
}) => {
	const { t } = useTranslation();
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const handleCreate = () => {
		if (isCreateDisabled) {
			return;
		}
		onCreateUser(true);
	};
	return (
		<div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-panel-border bg-panel-surface p-10 text-center">
			<EmptySectionIcon className="max-h-[160px] max-w-[160px] opacity-80" />
			<p className="text-sm font-medium text-panel-text-secondary">
				{isFiltered ? t("usersTable.noUserMatched") : t("usersTable.noUser")}
			</p>
			{!isFiltered && !isCreateDisabled && (
				<Button
					onClick={handleCreate}
					size="sm"
					className="h-9 rounded-xl bg-panel-accent px-4 text-xs font-semibold text-white shadow-xs transition-colors min-[769px]:hover:bg-panel-accent/90 active:scale-[0.98] touch-manipulation"
				>
					{t("createUser")}
				</Button>
			)}
		</div>
	);
};

import type { SortingState } from "@tanstack/react-table";
import { AddTrafficDialog } from "components/AddTrafficDialog";
import { ConfirmDialog, DeleteConfirmDialog } from "components/dialogs/ConfirmDialog";
import { DataTable } from "components/ui";
import { Button } from "components/ui/button";
import { DataTableColumnMenu } from "components/ui/DataTableColumnMenu";
import { toast } from "components/ui/sonner";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "components/ui/tooltip";
import { UsersOverviewBand } from "components/users/UsersOverviewBand";
import { useDashboard } from "contexts/DashboardContext";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import useGetUser from "hooks/useGetUser";
import { usePersistedColumnVisibility } from "hooks/usePersistedColumnVisibility";
import { cn } from "lib/cn";
import { Ban, Check, Lock, RefreshCw, Trash2, Unlink } from "lucide-react";
import {
	type ComponentPropsWithoutRef,
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
import type { UserListItem } from "types/User";
import {
	canDeleteUserByTrafficCap,
	canViewUserTraffic,
	isUserManagementLocked,
} from "utils/adminTraffic";
import {
	nextUsersFiltersForOverview,
	usersOverviewSelection,
} from "utils/usersOverview";
import { UserIPsModal } from "./users/table/UserIPsModal";
import {
	toMenuItems,
	UserRowActionButtons,
} from "./users/table/UserRowActionButtons";
import { UsersEmptyState } from "./users/table/UsersEmptyState";
import { getApiErrorMessage } from "./users/table/UserTableCells";
import { useUserColumns } from "./users/table/useUserColumns";
import { useUserRowActions } from "./users/table/useUserRowActions";

type UsersTableProps = ComponentPropsWithoutRef<"div"> & {
	toolbar?: ReactNode;
	headerActions?: ReactNode;
};

export const UsersTable: FC<UsersTableProps> = ({
	toolbar,
	headerActions,
	...props
}) => {
	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);
	const usersResponse = useDashboard((state) => state.users);
	const onEditingUser = useDashboard((state) => state.onEditingUser);
	const loading = useDashboard((state) => state.loading);
	const deleteUser = useDashboard((state) => state.deleteUser);
	const resetDataUsage = useDashboard((state) => state.resetDataUsage);
	const revokeSubscription = useDashboard((state) => state.revokeSubscription);
	const refetchUsers = useDashboard((state) => state.refetchUsers);

	const { t, i18n } = useTranslation();
	const isDesktop = useBreakpointValue({ base: false, md: true }) ?? false;
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const locale = i18n.language || "en";

	const notify = useCallback(
		(
			title: string,
			status: "success" | "error",
			options?: { description?: string; duration?: number },
		) =>
			toast[status](title, {
				description: options?.description,
				duration: options?.duration ?? 2500,
			}),
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

	const [expandedUsername, setExpandedUsername] = useState<string | null>(null);
	const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
	const [bulkAction, setBulkAction] = useState<string | null>(null);
	const [isBulkResetOpen, setIsBulkResetOpen] = useState(false);
	const [userPendingDelete, setUserPendingDelete] =
		useState<UserListItem | null>(null);

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

	const {
		contextAction,
		trafficUser,
		setTrafficUser,
		ipDialog,
		setIPDialog,
		handleAddTraffic,
		handleCopyIPs,
		handleDeleteUser,
		getUserRowActions,
	} = useUserRowActions({
		userData,
		canOpenUserDialog,
		canViewTraffic,
		canToggleUserStatus,
		canResetUsageActions,
		canRevokeSubActions,
		canMutateUsers,
		canDeleteUserActions,
		notify,
		onRequestDelete: setUserPendingDelete,
	});

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
			setSelectedUsernames([]);
			refetchUsers(true);
		} catch (error) {
			notify(getApiErrorMessage(error, t("error")), "error");
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

	const userColumns = useUserColumns({
		canOpenUserDialog,
		canViewTraffic,
		hasPrivilegedRole,
	});

	const userSorting = useMemo<SortingState>(() => {
		const currentSort = filters.sort || "";
		const desc = currentSort.startsWith("-");
		const id = desc ? currentSort.slice(1) : currentSort;
		if (!id) return [];
		return [{ id, desc }];
	}, [filters.sort]);

	const [columnVisibility, setColumnVisibility] =
		usePersistedColumnVisibility("users");

	const filteredUsageTotal = usersResponse.usage_total ?? null;
	const activeUsersCount =
		statusBreakdown.active !== undefined && statusBreakdown.active > 0
			? statusBreakdown.active
			: (usersResponse.active_total ?? statusBreakdown.active ?? 0);
	const usageForSummary = canViewTraffic ? filteredUsageTotal : null;

	const renderExpandedUser = (user: UserListItem) => {
		const detailColumns = userColumns.filter(
			(column) => column.id !== "username" && column.mobileVisible !== false,
		);
		const availableActions = toMenuItems(getUserRowActions(user), user);
		const expandedActions = [
			user.status === "disabled" ? "enable" : "disable",
			"revoke",
			"reset",
			"get-ips",
		].flatMap((id) => {
			const action = availableActions.find((item) => item.id === id);
			return action ? [action] : [];
		});

		return (
			<div className="rb-resource-expanded">
				<div data-density="compact" className="rb-resource-details">
					<div className="rb-resource-meta">
						<span className="text-panel-text-muted">{t("username")}</span>
						<p
							dir="ltr"
							className="text-panel-text min-w-0! [unicode-bidi:isolate] rb-resource-meta-value"
						>
							{user.username}
						</p>
					</div>
					{detailColumns.map((column) => (
						<div key={column.id} className="rb-resource-meta">
							<span className="text-panel-text-muted">
								{column.mobileMetaLabel ?? column.mobileLabel ?? column.header}
							</span>
							<div className="text-panel-text min-w-0! rb-resource-meta-value">
								{column.mobileDetailCell?.(user) ?? column.cell?.(user)}
							</div>
						</div>
					))}
				</div>
				<div
					onClick={(event) => event.stopPropagation()}
					className="flex items-center justify-end gap-1 flex-wrap rb-resource-expanded-actions"
				>
					<div className="flex flex-row items-center gap-1 rb-expanded-user-actions">
						{expandedActions.map((action) => (
							<Tooltip key={action.id}>
								<TooltipTrigger asChild>
									<span>
										<Button
											aria-label={String(action.label)}
											disabled={action.disabled}
											onClick={() => action.onClick?.()}
											variant="ghost"
											size="sm"
											className="size-8 p-0 min-w-[30px]! h-[30px]"
										>
											{action.icon}
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>{action.label}</TooltipContent>
							</Tooltip>
						))}
					</div>
					<UserRowActionButtons
						user={user}
						isRTL={isRTL}
						onEdit={
							canOpenUserDialog &&
							!isUserManagementLocked(userData, user.service_id)
								? () => onEditingUser(user)
								: undefined
						}
						onDelete={
							canDeleteUserActions && canDeleteUserByTrafficCap(userData, user)
								? () => handleDeleteUser(user)
								: undefined
						}
					/>
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
				selectedUsers.length > 0 ? "pb-32 md:pb-24" : "pb-0",
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

			<div className="border border-panel-border! bg-panel-surface rounded-xl overflow-hidden rb-users-header-card">
				<UsersOverviewBand
					bare
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

				<div className="border-t border-panel-border! p-3 rb-users-toolbar">
					<div className="flex-wrap flex items-center gap-2">
						<div className="max-sm:contents sm:flex-[1_1_240px] min-w-0!">
							{toolbar}
						</div>
						<div className="flex flex-row items-center gap-1 shrink-0">
							<DataTableColumnMenu
								columns={userColumns}
								visibility={columnVisibility}
								onChange={setColumnVisibility}
							/>
							{headerActions}
						</div>
					</div>
				</div>
			</div>

			<div className="relative">
				<div
					aria-hidden={isAdminDisabled ? true : undefined}
					className={cn(
						"flex flex-col gap-3",
						isAdminDisabled ? "[filter:blur(4px)] pointer-events-none" : "",
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
							<UsersEmptyState
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
							<UserRowActionButtons
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
									>
										<Ban className="w-4 md:w-5 h-4 md:h-5" />
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
									>
										<Check className="w-[16px]" />
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
									>
										<RefreshCw className="w-4 md:w-5 h-4 md:h-5" />
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
									>
										<Unlink className="w-4 md:w-5 h-4 md:h-5" />
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
											className="border border-destructive/50 bg-transparent text-destructive min-[769px]:hover:bg-destructive/10"
										>
											<Trash2 />
											{t("delete")}
										</Button>
									</DeleteConfirmDialog>
								)}
							</>
						)}
						tableProps={{
							className:
								"w-full [table-layout:fixed] [&_th]:px-2 [&_td]:px-2 [&_th]:py-2.5 [&_td]:py-2.5 [&_th]:align-middle [&_td]:align-middle xl:[&_th]:px-2.5 xl:[&_td]:px-2.5",
						}}
					/>
				</div>
				{isAdminDisabled && (
					<div className="flex-col flex absolute inset-0 items-center justify-center text-center px-6 py-8 bg-[rgba(255,_255,_255,_0.85)] dark:bg-[rgba(15,_23,_42,_0.9)] z-[overlay]">
						<Lock className="w-16 md:w-20 h-16 md:h-20 text-red-400 mb-6" />
						<p className="text-[1.25rem] font-bold mb-3">
							{t("usersTable.adminDisabledTitle")}
						</p>
						<p className="max-w-[480px] text-gray-600 dark:text-gray-200">
							{userData.disabled_reason ||
								t("usersTable.adminDisabledDescription")}
						</p>
					</div>
				)}
			</div>

			<UserIPsModal
				ipDialog={ipDialog}
				loading={contextAction === "ips"}
				onClose={() => setIPDialog(null)}
				onCopyIPs={handleCopyIPs}
			/>

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

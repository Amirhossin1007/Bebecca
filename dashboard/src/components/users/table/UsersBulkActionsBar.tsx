import { ConfirmDialog } from "components/dialogs/ConfirmDialog";
import { Button } from "components/ui/button";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { Ban, Check, RefreshCw, Trash2, Unlink, X } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminRole, UserPermissionToggle } from "types/Admin";
import type { UserListItem } from "types/User";

export type UsersBulkActionsBarProps = {
	selectedUsers?: UserListItem[];
	selectedCount?: number;
	bulkAction?: string | null;
	canToggleStatus?: boolean;
	canResetUsage?: boolean;
	canRevokeSub?: boolean;
	canDelete?: boolean;
	disableTargetsCount?: number;
	enableTargetsCount?: number;
	deleteTargetsCount?: number;
	onDisable?: () => void;
	onEnable?: () => void;
	onReset?: () => void;
	onRevoke?: () => void;
	onDelete?: () => void;
	onClearSelection: () => void;
};

export const UsersBulkActionsBar: FC<UsersBulkActionsBarProps> = ({
	selectedUsers = [],
	selectedCount: propCount,
	onClearSelection,
}) => {
	const { t } = useTranslation();
	const { userData } = useGetUser();
	const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);

	const count = propCount ?? selectedUsers.length;
	if (count === 0) return null;

	const hasFullAccess =
		userData?.role === AdminRole.FullAccess ||
		userData?.role === AdminRole.Sudo;
	const canDelete =
		hasFullAccess ||
		Boolean(userData?.permissions?.users?.[UserPermissionToggle.Delete]);
	const canReset =
		hasFullAccess ||
		Boolean(userData?.permissions?.users?.[UserPermissionToggle.ResetUsage]);
	const canRevoke =
		hasFullAccess ||
		Boolean(userData?.permissions?.users?.[UserPermissionToggle.Revoke]);
	const canToggle = hasFullAccess || userData?.role === AdminRole.Sudo;

	const disableTargets = selectedUsers.filter((u) => u.status !== "disabled");
	const enableTargets = selectedUsers.filter((u) => u.status === "disabled");

	const handleBulkDisable = async () => {
		if (disableTargets.length === 0) return;
		setActionLoading(true);
		try {
			const editUser = useDashboard.getState().editUser;
			await Promise.all(
				disableTargets.map((u) =>
					editUser(u.username, { status: "disabled" } as any),
				),
			);
			toast.success(
				t("bulkActions.disableSuccess", { count: disableTargets.length }),
			);
			useDashboard.getState().refetchUsers(true);
		} finally {
			setActionLoading(false);
		}
	};

	const handleBulkEnable = async () => {
		if (enableTargets.length === 0) return;
		setActionLoading(true);
		try {
			const editUser = useDashboard.getState().editUser;
			await Promise.all(
				enableTargets.map((u) =>
					editUser(u.username, { status: "active" } as any),
				),
			);
			toast.success(
				t("bulkActions.enableSuccess", { count: enableTargets.length }),
			);
			useDashboard.getState().refetchUsers(true);
		} finally {
			setActionLoading(false);
		}
	};

	const handleBulkReset = async () => {
		setActionLoading(true);
		try {
			const resetDataUsage = useDashboard.getState().resetDataUsage;
			await Promise.all(selectedUsers.map((u) => resetDataUsage(u as any)));
			toast.success(
				t("bulkActions.resetSuccess", { count: selectedUsers.length }),
			);
			useDashboard.getState().refetchUsers(true);
		} finally {
			setActionLoading(false);
		}
	};

	const handleBulkRevoke = async () => {
		setActionLoading(true);
		try {
			const revokeSub = useDashboard.getState().revokeSubscription;
			await Promise.all(selectedUsers.map((u) => revokeSub(u as any)));
			toast.success(
				t("bulkActions.revokeSuccess", { count: selectedUsers.length }),
			);
			useDashboard.getState().refetchUsers(true);
		} finally {
			setActionLoading(false);
		}
	};

	const handleBulkDelete = async () => {
		setActionLoading(true);
		try {
			const deleteUser = useDashboard.getState().deleteUser;
			await Promise.all(selectedUsers.map((u) => deleteUser(u as any)));
			toast.success(
				t("bulkActions.deleteSuccess", { count: selectedUsers.length }),
			);
			onClearSelection();
			useDashboard.getState().refetchUsers(true);
		} finally {
			setActionLoading(false);
			setConfirmDeleteOpen(false);
		}
	};

	return (
		<>
			<div className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-panel-border bg-panel-surface p-3 shadow-2xl sm:bottom-8 sm:px-4">
				<div className="flex items-center gap-2">
					<span className="flex size-7 items-center justify-center rounded-xl bg-panel-accent text-xs font-bold text-white shadow-xs">
						{count}
					</span>
					<span className="hidden text-xs font-semibold text-panel-text sm:inline">
						{t("usersTable.selectedCount", { count })}
					</span>
				</div>

				<div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
					{canToggle && disableTargets.length > 0 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionLoading}
							onClick={handleBulkDisable}
							className="h-8 gap-1 rounded-xl border-panel-border bg-panel-card px-2.5 text-xs font-medium"
						>
							<Ban className="size-3.5 text-amber-500" />
							<span className="hidden sm:inline">
								{t("usersTable.disableUser")}
							</span>
						</Button>
					)}

					{canToggle && enableTargets.length > 0 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionLoading}
							onClick={handleBulkEnable}
							className="h-8 gap-1 rounded-xl border-panel-border bg-panel-card px-2.5 text-xs font-medium"
						>
							<Check className="size-3.5 text-emerald-500" />
							<span className="hidden sm:inline">
								{t("usersTable.enableUser")}
							</span>
						</Button>
					)}

					{canReset && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionLoading}
							onClick={handleBulkReset}
							className="h-8 gap-1 rounded-xl border-panel-border bg-panel-card px-2.5 text-xs font-medium"
						>
							<RefreshCw className="size-3.5 text-blue-500" />
							<span className="hidden sm:inline">
								{t("usersTable.resetUsage")}
							</span>
						</Button>
					)}

					{canRevoke && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionLoading}
							onClick={handleBulkRevoke}
							className="h-8 gap-1 rounded-xl border-panel-border bg-panel-card px-2.5 text-xs font-medium"
						>
							<Unlink className="size-3.5 text-purple-500" />
							<span className="hidden sm:inline">
								{t("usersTable.revokeSubscription")}
							</span>
						</Button>
					)}

					{canDelete && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={actionLoading}
							onClick={() => setConfirmDeleteOpen(true)}
							className="h-8 gap-1 rounded-xl border-red-500/30 bg-red-500/10 px-2.5 text-xs font-medium text-red-500 min-[769px]:hover:bg-red-500/20"
						>
							<Trash2 className="size-3.5" />
							<span className="hidden sm:inline">{t("delete")}</span>
						</Button>
					)}
				</div>

				<button
					type="button"
					onClick={onClearSelection}
					className="flex size-7 items-center justify-center rounded-xl border border-panel-border/70 text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text cursor-pointer active:scale-95"
					title={t("clear")}
				>
					<X className="size-3.5" />
				</button>
			</div>

			<ConfirmDialog
				open={confirmDeleteOpen}
				loading={actionLoading}
				colorScheme="red"
				title={t("deleteUsersConfirm.title", "Delete Selected Users")}
				description={t("deleteUsersConfirm.description", { count })}
				onClose={() => setConfirmDeleteOpen(false)}
				onConfirm={handleBulkDelete}
			/>
		</>
	);
};

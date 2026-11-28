import type { DataTableRowAction } from "components/ui";
import { useDashboard } from "contexts/DashboardContext";
import {
	Ban,
	CalendarDays,
	ChartColumn,
	Check,
	CirclePlus,
	Clock,
	Copy,
	Database,
	Globe,
	Link2,
	Pencil,
	QrCode,
	RefreshCw,
	Trash2,
	Unlink,
} from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetch } from "service/http";
import type { UserApi, UserListItem } from "types/User";
import {
	canDeleteUserByTrafficCap,
	isUserManagementLocked,
} from "utils/adminTraffic";
import { copyTextToClipboard } from "utils/clipboard";
import { generateUserLinks } from "utils/userLinks";
import { getApiErrorMessage } from "./UserTableCells";
import {
	deduplicateUserIPRecords,
	formatUserIPRecords,
	type UserIPDialogState,
	type UserIPsResponse,
} from "./userIPsUtils";

type NotifyFn = (
	title: string,
	status: "success" | "error",
	options?: { description?: string; duration?: number },
) => void;

type UseUserRowActionsOptions = {
	userData: UserApi;
	canOpenUserDialog: boolean;
	canViewTraffic: boolean;
	canToggleUserStatus: boolean;
	canResetUsageActions: boolean;
	canRevokeSubActions: boolean;
	canMutateUsers: boolean;
	canDeleteUserActions: boolean;
	notify: NotifyFn;
	onRequestDelete: (user: UserListItem) => void;
};

export const useUserRowActions = ({
	userData,
	canOpenUserDialog,
	canViewTraffic,
	canToggleUserStatus,
	canResetUsageActions,
	canRevokeSubActions,
	canMutateUsers,
	canDeleteUserActions,
	notify,
	onRequestDelete,
}: UseUserRowActionsOptions) => {
	const { t } = useTranslation();
	const onEditingUser = useDashboard((state) => state.onEditingUser);
	const deleteUser = useDashboard((state) => state.deleteUser);
	const revokeSubscription = useDashboard((state) => state.revokeSubscription);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const linkTemplates = useDashboard((state) => state.linkTemplates);

	const [contextAction, setContextAction] = useState<string | null>(null);
	const [trafficUser, setTrafficUser] = useState<UserListItem | null>(null);
	const [ipDialog, setIPDialog] = useState<UserIPDialogState | null>(null);

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
			notify(t("usersTable.copyFailed"), "error", { duration: 1600 });
			return false;
		}
	};

	const handleResetUsage = (user: UserListItem) => {
		useDashboard.setState({ resetUsageUser: user });
	};

	const handleRevokeSub = async (user: UserListItem) => {
		setContextAction("revoke");
		try {
			await revokeSubscription(user);
			notify(t("usersTable.revokeSub"), "success");
		} catch (error) {
			notify(getApiErrorMessage(error, t("error")), "error");
		} finally {
			setContextAction(null);
		}
	};

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
		} catch (error) {
			notify(getApiErrorMessage(error, t("error")), "error");
			throw error;
		}
	};

	const handleExtendExpire = async (user: UserListItem, days: number) => {
		if (user.expire === null || user.expire === 0 || user.expire === undefined)
			return;
		setContextAction("expire");
		try {
			const nextExpire = Math.floor(user.expire + days * 86400);
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { expire: nextExpire },
			});
			notify(t("usersTable.extendExpireSuccess"), "success");
			refetchUsers(true);
		} catch (error) {
			notify(getApiErrorMessage(error, t("error")), "error");
		} finally {
			setContextAction(null);
		}
	};

	const updateUserStatus = async (
		user: UserListItem,
		nextStatus: "disabled" | "active",
	) => {
		const actionKey = nextStatus === "disabled" ? "disable" : "enable";
		setContextAction(actionKey);
		try {
			await fetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { status: nextStatus },
			});
			notify(
				t(
					nextStatus === "disabled"
						? "usersTable.disableUser"
						: "usersTable.enableUser",
				),
				"success",
			);
			refetchUsers(true);
		} catch (error) {
			notify(getApiErrorMessage(error, t("error")), "error");
		} finally {
			setContextAction(null);
		}
	};

	const handleDisableUser = async (user: UserListItem) => {
		if (!canToggleUserStatus || user.status === "disabled") return;
		await updateUserStatus(user, "disabled");
	};

	const handleEnableUser = async (user: UserListItem) => {
		if (!canToggleUserStatus || user.status !== "disabled") return;
		await updateUserStatus(user, "active");
	};

	const handleGetIPs = async (user: UserListItem) => {
		setContextAction("ips");
		setIPDialog({ username: user.username, records: [] });
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
		} catch (error) {
			const message = getApiErrorMessage(error, t("usersTable.getIpsFailed"));
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
			await copyTextToClipboard(
				formatUserIPRecords(ipDialog.records, t("usersTable.noOnlineIps")),
			);
			notify(t("usersTable.ipsCopied"), "success", { duration: 1200 });
		} catch {
			notify(t("usersTable.copyFailed"), "error", { duration: 1600 });
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
			} catch (error) {
				notify(getApiErrorMessage(error, t("error")), "error");
			} finally {
				setContextAction(null);
			}
		},
		[deleteUser, notify, refetchUsers, t],
	);

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
				icon: <Link2 />,
				disabled: !subscriptionLink,
				onClick: () => copyUserText(subscriptionLink, t("copied")),
			},
			{
				id: "copy-configs",
				label: t("usersTable.copyConfigs"),
				icon: <Copy />,
				disabled: configLinks.length === 0,
				onClick: () => copyUserText(configLinksText, t("copied")),
			},
			{
				id: "qr",
				label: t("usersTable.qrCode"),
				icon: <QrCode />,
				onClick: () => {
					setQRCode(configLinks, user.username);
					setSubLink(subscriptionLink);
				},
			},
			{
				id: "get-ips",
				label: t("usersTable.getIps"),
				icon: <Globe className="w-4 md:w-5 h-4 md:h-5" />,
				disabled: contextAction === "ips",
				onClick: () => handleGetIPs(user),
			},
		];

		if (canOpenUserDialog && !rowManagementLocked) {
			actions.push({
				id: "edit",
				label: t("userDialog.editUser"),
				icon: <Pencil />,
				onClick: () => onEditingUser(user),
			});
		}

		if (canViewTraffic) {
			actions.push({
				id: "usage-history",
				label: t("usersTable.usageHistory"),
				icon: <ChartColumn className="w-4 md:w-5 h-4 md:h-5" />,
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
				icon: <Ban className="w-4 md:w-5 h-4 md:h-5" />,
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
				icon: <Check className="w-[16px]" />,
				disabled: contextAction === "enable",
				onClick: () => handleEnableUser(user),
			});
		}

		if (canResetUsageActions && !rowManagementLocked) {
			actions.push({
				id: "reset",
				label: t("usersTable.resetUsage"),
				icon: <RefreshCw className="w-4 md:w-5 h-4 md:h-5" />,
				disabled: contextAction === "reset",
				onClick: () => handleResetUsage(user),
			});
		}

		if (canRevokeSubActions && !rowManagementLocked) {
			actions.push({
				id: "revoke",
				label: t("usersTable.revokeSub"),
				icon: <Unlink className="w-4 md:w-5 h-4 md:h-5" />,
				disabled: contextAction === "revoke",
				onClick: () => handleRevokeSub(user),
			});
		}

		if (canMutateRow && user.data_limit !== null && user.data_limit !== 0) {
			actions.push({
				id: "add-traffic",
				label: t("services.userActions.traffic.add"),
				icon: <CirclePlus className="w-4 md:w-5 h-4 md:h-5" />,
				onClick: () => setTrafficUser(user),
			});
		}

		if (canMutateRow) {
			actions.push({
				id: "set-data-limit",
				label: t("usersTable.setDataLimit"),
				icon: <Database className="w-4 md:w-5 h-4 md:h-5" />,
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
				icon: <Clock className="w-4 md:w-5 h-4 md:h-5" />,
				disabled: contextAction === "expire",
				onClick: () => handleExtendExpire(user, 30),
			});
		}

		if (canMutateRow) {
			actions.push({
				id: "set-expiry",
				label: t("usersTable.setExpiry"),
				icon: <CalendarDays className="w-4 md:w-5 h-4 md:h-5" />,
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
				icon: <Trash2 />,
				isDanger: true,
				onClick: () => onRequestDelete(user),
			});
		}

		return actions;
	};

	return {
		contextAction,
		trafficUser,
		setTrafficUser,
		ipDialog,
		setIPDialog,
		handleAddTraffic,
		handleCopyIPs,
		handleDeleteUser,
		getUserRowActions,
	};
};

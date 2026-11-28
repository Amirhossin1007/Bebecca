import { Pagination } from "components/Pagination";
import { UsersTable } from "components/UsersTable";
import { PageHeader, PageLoadingSkeleton } from "components/ui";
import { UsersCreateButton, UsersFilterBar } from "components/users";
import { RefreshSplitButton } from "components/users/RefreshSplitButton";
import { UserActionDialog } from "components/users/UserActionDialog";
import { useOnlineUsersPolling } from "components/users/useOnlineUsersPolling";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { Lock } from "lucide-react";
import { type FC, lazy, Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AdminStatus } from "types/Admin";

const UserDialog = lazy(async () => ({
	default: (await import("components/UserDialog")).UserDialog,
}));
const QRCodeDialog = lazy(async () => ({
	default: (await import("components/QRCodeDialog")).QRCodeDialog,
}));
const UserQuickEditModal = lazy(async () => ({
	default: (await import("components/users/UserQuickEditModal"))
		.UserQuickEditModal,
}));

export const UsersPage: FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const loading = useDashboard((state) => state.loading);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const isUserDialogOpen = useDashboard(
		(state) => state.isCreatingNewUser || Boolean(state.editingUser),
	);
	const isQRCodeDialogOpen = useDashboard(
		(state) => state.QRcodeLinks !== null,
	);
	const isQuickEditOpen = useDashboard((state) => state.quickEditUser !== null);
	const { userData, getUserIsPending } = useGetUser();
	const isAdminDisabled = userData.status === AdminStatus.Disabled;

	const { autoRefreshInterval, setAutoRefreshInterval, refreshOnlineUsers } =
		useOnlineUsersPolling({
			disabled: getUserIsPending || isAdminDisabled,
		});

	useEffect(() => {
		if (getUserIsPending || isAdminDisabled) return;
		const shouldOpenCreate = sessionStorage.getItem("openCreateUser");
		if (shouldOpenCreate === "true") {
			sessionStorage.removeItem("openCreateUser");
			useDashboard.getState().onCreateUser(true);
		}
	}, [getUserIsPending, isAdminDisabled]);

	if (getUserIsPending) {
		return <PageLoadingSkeleton />;
	}

	if (isAdminDisabled) {
		return (
			<div
				dir={isRTL ? "rtl" : "ltr"}
				className="flex flex-col gap-5 items-stretch"
			>
				<PageHeader title={t("users")} />
				<div className="flex-col flex items-center border border-panel-border! rounded-[8px] justify-center min-h-[420px] px-6 py-10 text-center">
					<Lock className="h-12 w-12 text-red-400 mb-5" />
					<p className="text-[1.25rem] font-bold mb-2">
						{t("usersTable.adminDisabledTitle")}
					</p>
					<p className="text-panel-text-secondary max-w-[520px]">
						{userData.disabled_reason ||
							t("usersTable.adminDisabledDescription")}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			className="flex flex-col gap-4 items-stretch rb-users-section"
		>
			<UsersTable
				toolbar={<UsersFilterBar />}
				headerActions={
					<>
						<RefreshSplitButton
							onRefresh={() => {
								refetchUsers(true);
								void refreshOnlineUsers();
							}}
							loading={loading}
							interval={autoRefreshInterval}
							onIntervalChange={setAutoRefreshInterval}
						/>
						<UsersCreateButton />
					</>
				}
			/>
			<Pagination />
			{isUserDialogOpen && (
				<Suspense fallback={null}>
					<UserDialog />
				</Suspense>
			)}
			{isQRCodeDialogOpen && (
				<Suspense fallback={null}>
					<QRCodeDialog />
				</Suspense>
			)}
			<UserActionDialog action="reset" />
			<UserActionDialog action="revoke" />
			{isQuickEditOpen && (
				<Suspense fallback={null}>
					<UserQuickEditModal />
				</Suspense>
			)}
		</div>
	);
};

export default UsersPage;

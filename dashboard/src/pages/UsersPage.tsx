import { Pagination } from "components/Pagination";
import { UsersTable } from "components/UsersTable";
import { PageHeader, PageLoadingSkeleton } from "components/ui";
import { Button } from "components/ui/button";
import { Dialog, DialogContent } from "components/ui/dialog";
import { toast } from "components/ui/sonner";
import { UsersCreateButton, UsersFilterBar } from "components/users";
import { RefreshSplitButton } from "components/users/RefreshSplitButton";
import { UsersOverviewBand } from "components/users/UsersOverviewBand";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { cn } from "lib/cn";
import { Lock, RefreshCw } from "lucide-react";
import {
	type FC,
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { fetch } from "service/http";
import { AdminStatus } from "types/Admin";
import {
	nextUsersFiltersForOverview,
	usersOverviewSelection,
} from "utils/usersOverview";

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

type OnlineUsersResponse =
	| string[]
	| {
			users: string[];
			speeds: Record<string, { upload_speed: number; download_speed: number }>;
	  };

const UserActionDialog: FC<{ action: "reset" | "revoke" }> = ({ action }) => {
	const { t } = useTranslation();
	const resetUsageUser = useDashboard((state) => state.resetUsageUser);
	const revokeSubscriptionUser = useDashboard(
		(state) => state.revokeSubscriptionUser,
	);
	const resetDataUsage = useDashboard((state) => state.resetDataUsage);
	const revokeSubscription = useDashboard((state) => state.revokeSubscription);

	const [loading, setLoading] = useState(false);
	const user = action === "reset" ? resetUsageUser : revokeSubscriptionUser;
	const isRevoke = action === "revoke";

	const onClose = () => {
		useDashboard.setState(
			isRevoke ? { revokeSubscriptionUser: null } : { resetUsageUser: null },
		);
	};

	const onSubmit = () => {
		if (!user) return;
		setLoading(true);
		(isRevoke ? revokeSubscription(user) : resetDataUsage(user))
			.then(() => {
				toast.success(
					t(isRevoke ? "revokeUserSub.success" : "resetUserUsage.success", {
						username: user.username,
					}),
					{ duration: 3000 },
				);
				onClose();
			})
			.catch(() => {
				toast.error(
					t(isRevoke ? "revokeUserSub.error" : "resetUserUsage.error"),
					{ duration: 3000 },
				);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	if (!user) return null;

	return (
		<Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm rounded-[20px] border border-panel-border bg-panel-card p-6 shadow-2xl z-[1600]">
				<div className="flex flex-col items-center text-center">
					<div className="flex size-12 items-center justify-center rounded-2xl bg-panel-accent/10 text-panel-accent mb-3.5">
						<RefreshCw className={cn("size-5", loading && "animate-spin")} />
					</div>
					<h3 className="text-base font-bold text-panel-text">
						{t(isRevoke ? "revokeUserSub.title" : "resetUserUsage.title")}
					</h3>
					<p className="mt-2 text-xs text-panel-text-secondary leading-relaxed max-w-xs">
						<Trans
							components={{
								b: <b className="font-semibold text-panel-text" />,
							}}
						>
							{t(isRevoke ? "revokeUserSub.prompt" : "resetUserUsage.prompt", {
								username: user.username,
							})}
						</Trans>
					</p>
					<div className="flex items-center gap-2.5 mt-6 w-full">
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							className="flex-1 h-9 rounded-xl border-panel-border bg-panel-surface text-xs font-medium text-panel-text"
						>
							{t("cancel")}
						</Button>
						<Button
							type="button"
							onClick={onSubmit}
							disabled={loading}
							className="flex-1 h-9 rounded-xl bg-panel-accent text-xs font-semibold text-white shadow-xs transition-colors min-[769px]:hover:bg-panel-accent/90"
						>
							{t(isRevoke ? "revoke" : "reset")}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export const UsersPage: FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const locale = i18n.language || "en";

	const loading = useDashboard((state) => state.loading);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const usersResponse = useDashboard((state) => state.users);
	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);

	const isUserDialogOpen = useDashboard(
		(state) => state.isCreatingNewUser || Boolean(state.editingUser),
	);
	const isQRCodeDialogOpen = useDashboard(
		(state) => state.QRcodeLinks !== null,
	);
	const isQuickEditOpen = useDashboard((state) => state.quickEditUser !== null);
	const { userData, getUserIsPending } = useGetUser();
	const isAdminDisabled = userData.status === AdminStatus.Disabled;
	const [autoRefreshInterval, setAutoRefreshInterval] = useState(5000);

	const topSpeedUsernameRef = useRef<string | undefined>(undefined);
	const onlineRefreshInFlightRef = useRef(false);

	const refreshOnlineUsers = useCallback(async () => {
		if (onlineRefreshInFlightRef.current) return;
		onlineRefreshInFlightRef.current = true;
		try {
			const state = useDashboard.getState();
			const visibleUsernames = state.users.users.map((u) => u.username);
			const needsGlobalSpeeds =
				state.filters.advancedFilters?.includes("top_speed");
			if (!needsGlobalSpeeds && visibleUsernames.length === 0) return;

			const response = await fetch<OnlineUsersResponse>("/users/onlines", {
				query: {
					details: true,
					usernames: needsGlobalSpeeds ? undefined : visibleUsernames.join(","),
				},
			});
			const usernames = Array.isArray(response) ? response : response.users;
			const speeds = Array.isArray(response) ? {} : response.speeds;
			const online = new Set(usernames);

			let topSpeedUsername = "";
			let topSpeed = 0;
			for (const [username, speed] of Object.entries(speeds)) {
				const total = (speed.upload_speed ?? 0) + (speed.download_speed ?? 0);
				if (total > topSpeed) {
					topSpeed = total;
					topSpeedUsername = username;
				}
			}

			const previousTopSpeedUsername = topSpeedUsernameRef.current;
			topSpeedUsernameRef.current = topSpeedUsername;

			useDashboard.setState((currentState) => {
				const liveUserStats = Object.fromEntries(
					currentState.users.users.map((user) => {
						const speed = speeds[user.username];
						return [
							user.username,
							{
								is_online: online.has(user.username),
								upload_speed: speed?.upload_speed ?? 0,
								download_speed: speed?.download_speed ?? 0,
							},
						];
					}),
				);
				return { liveUserStats };
			});

			if (
				previousTopSpeedUsername !== undefined &&
				previousTopSpeedUsername !== topSpeedUsername &&
				state.filters.advancedFilters?.includes("top_speed")
			) {
				state.refetchUsers(true);
			}
		} catch {
		} finally {
			onlineRefreshInFlightRef.current = false;
		}
	}, []);

	useEffect(() => {
		if (getUserIsPending || isAdminDisabled) return;
		useDashboard.getState().refetchUsers(true);
		fetchInbounds();
	}, [getUserIsPending, isAdminDisabled]);

	useEffect(() => {
		if (getUserIsPending || isAdminDisabled || !autoRefreshInterval) return;
		void refreshOnlineUsers();
		const timer = window.setInterval(
			() => void refreshOnlineUsers(),
			autoRefreshInterval,
		);
		return () => window.clearInterval(timer);
	}, [
		autoRefreshInterval,
		getUserIsPending,
		isAdminDisabled,
		refreshOnlineUsers,
	]);

	useEffect(() => {
		if (getUserIsPending || isAdminDisabled || !autoRefreshInterval) return;
		const refreshWhenActive = () => {
			if (document.visibilityState === "visible" && navigator.onLine) {
				void refreshOnlineUsers();
			}
		};
		document.addEventListener("visibilitychange", refreshWhenActive);
		window.addEventListener("online", refreshWhenActive);
		return () => {
			document.removeEventListener("visibilitychange", refreshWhenActive);
			window.removeEventListener("online", refreshWhenActive);
		};
	}, [
		autoRefreshInterval,
		getUserIsPending,
		isAdminDisabled,
		refreshOnlineUsers,
	]);

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
				<div className="flex flex-col items-center justify-center min-h-[420px] rounded-[20px] border border-panel-border bg-panel-card px-6 py-10 text-center">
					<Lock className="size-12 text-red-400 mb-4" />
					<p className="text-lg font-bold text-panel-text mb-2">
						{t("usersTable.adminDisabledTitle")}
					</p>
					<p className="text-xs text-panel-text-secondary max-w-md">
						{userData.disabled_reason ||
							t("usersTable.adminDisabledDescription")}
					</p>
				</div>
			</div>
		);
	}

	const breakdown = (usersResponse.status_breakdown ?? {}) as Partial<
		Record<"active" | "expired" | "limited" | "on_hold" | "disabled", number>
	>;

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			className="flex flex-col gap-4 items-stretch w-full"
		>
			<UsersOverviewBand
				selection={usersOverviewSelection(filters)}
				onSelect={(target) =>
					onFilterChange(nextUsersFiltersForOverview(filters, target))
				}
				total={usersResponse.total ?? 0}
				usersLimit={usersResponse.users_limit ?? null}
				active={usersResponse.active_total ?? 0}
				online={usersResponse.online_total ?? 0}
				usage={usersResponse.usage_total ?? 0}
				usageLabel={t("usersTable.listUsage")}
				breakdown={breakdown}
				locale={locale}
			/>

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

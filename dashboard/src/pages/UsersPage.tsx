import { Pagination } from "components/Pagination";
import { UsersTable } from "components/UsersTable";
import { PageHeader, PageLoadingSkeleton } from "components/ui";
import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { toast } from "components/ui/sonner";
import { UsersCreateButton, UsersFilterBar } from "components/users";
import { RefreshSplitButton } from "components/users/RefreshSplitButton";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { cn } from "lib/cn";
import { Lock, RefreshCw, Unlink } from "lucide-react";
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
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const {
		resetUsageUser,
		revokeSubscriptionUser,
		resetDataUsage,
		revokeSubscription,
	} = {
		resetUsageUser: useDashboard((state) => state.resetUsageUser),
		revokeSubscriptionUser: useDashboard(
			(state) => state.revokeSubscriptionUser,
		),
		resetDataUsage: useDashboard((state) => state.resetDataUsage),
		revokeSubscription: useDashboard((state) => state.revokeSubscription),
	};
	const [loading, setLoading] = useState(false);
	const user = action === "reset" ? resetUsageUser : revokeSubscriptionUser;
	const isRevoke = action === "revoke";

	const onClose = () => {
		useDashboard.setState(
			isRevoke ? { revokeSubscriptionUser: null } : { resetUsageUser: null },
		);
	};
	const onSubmit = () => {
		if (user) {
			setLoading(true);
			(isRevoke ? revokeSubscription(user) : resetDataUsage(user))
				.then(() => {
					toast.success(
						t(isRevoke ? "revokeUserSub.success" : "resetUserUsage.success", {
							username: user.username,
						}),
						{ duration: 3000 },
					);
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
		}
	};

	return (
		<Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				dir={isRTL ? "rtl" : "ltr"}
				showCloseButton={false}
				className="w-[calc(100vw-2rem)] max-w-[400px] gap-0 overflow-hidden rounded-2xl border-panel-border bg-panel-surface p-6 text-center text-panel-text shadow-2xl"
			>
				<div
					className={cn(
						"mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl",
						isRevoke
							? "bg-amber-500/10 text-amber-500 dark:bg-amber-400/15 dark:text-amber-400"
							: "bg-blue-500/10 text-blue-500 dark:bg-blue-400/15 dark:text-blue-400",
					)}
				>
					{isRevoke ? (
						<Unlink className="size-5" />
					) : (
						<RefreshCw className="size-5" />
					)}
				</div>

				<DialogHeader className="gap-1 p-0 text-center">
					<DialogTitle className="text-base font-semibold text-panel-text text-center">
						{t(isRevoke ? "revokeUserSub.title" : "resetUserUsage.title")}
					</DialogTitle>
					{user && (
						<DialogDescription className="text-xs leading-relaxed text-panel-text-muted text-center">
							<Trans
								components={{
									b: (
										<b className="font-semibold text-panel-text [unicode-bidi:isolate]" />
									),
								}}
							>
								{t(
									isRevoke ? "revokeUserSub.prompt" : "resetUserUsage.prompt",
									{
										username: user.username,
									},
								)}
							</Trans>
						</DialogDescription>
					)}
				</DialogHeader>

				<DialogFooter className="mt-6 flex flex-row gap-2.5 p-0 sm:justify-center">
					<Button
						onClick={onClose}
						disabled={loading}
						variant="outline"
						size="sm"
						className="h-10 flex-1 rounded-xl border-panel-border text-xs font-semibold text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
					>
						{t("cancel")}
					</Button>
					<Button
						onClick={onSubmit}
						size="sm"
						loading={loading}
						className={cn(
							"h-10 flex-1 rounded-xl text-xs font-semibold text-white shadow-xs transition-colors active:scale-[0.98] touch-manipulation",
							isRevoke
								? "bg-amber-600 min-[769px]:hover:bg-amber-700"
								: "bg-panel-accent min-[769px]:hover:bg-panel-accent/90",
						)}
					>
						{t(isRevoke ? "revoke" : "reset")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

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
	const [autoRefreshInterval, setAutoRefreshInterval] = useState(5_000);
	const topSpeedUsernameRef = useRef<string | undefined>(undefined);
	const onlineRefreshInFlightRef = useRef(false);

	const refreshOnlineUsers = useCallback(async () => {
		if (
			onlineRefreshInFlightRef.current ||
			document.visibilityState === "hidden" ||
			!navigator.onLine
		) {
			return;
		}
		onlineRefreshInFlightRef.current = true;
		try {
			const dashboard = useDashboard.getState();
			const needsGlobalSpeeds =
				dashboard.filters.advancedFilters?.includes("top_speed");
			const visibleUsernames = dashboard.users.users.map(
				(user) => user.username,
			);
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
			useDashboard.setState((state) => {
				const liveUserStats = Object.fromEntries(
					state.users.users.map((user) => {
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
			const state = useDashboard.getState();
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
				<div className="flex flex-col items-center justify-center rounded-2xl border border-panel-border bg-panel-surface min-h-[420px] px-6 py-10 text-center shadow-xs">
					<div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
						<Lock className="size-7" />
					</div>
					<p className="text-lg font-bold text-panel-text mb-2">
						{t("usersTable.adminDisabledTitle")}
					</p>
					<p className="text-sm text-panel-text-secondary max-w-[520px]">
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

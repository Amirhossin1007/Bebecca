import {
	Button,
	chakra,
	Flex,
	HStack,
	Menu,
	MenuButton,
	MenuItem,
	MenuList,
	Portal,
	Spinner,
	Text,
	useToast,
	VStack,
} from "@chakra-ui/react";
import {
	ArrowPathIcon,
	ChevronDownIcon,
	LockClosedIcon,
} from "@heroicons/react/24/outline";
import { AppDialog } from "components/dialogs/AppDialog";
import { ReloadIcon } from "components/Filters";
import { Icon } from "components/Icon";
import { Pagination } from "components/Pagination";
import { UsersTable } from "components/UsersTable";
import { PageHeader, ResourceRefreshButton } from "components/ui";
import { UsersFilterBar } from "components/users";
import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
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

const AUTO_REFRESH_INTERVALS = [3_000, 5_000, 10_000, 30_000] as const;

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

const ResetIcon = chakra(ArrowPathIcon, {
	baseStyle: { w: 5, h: 5 },
});

const DisabledIcon = chakra(LockClosedIcon, {
	baseStyle: { h: 12, w: 12 },
});

const UserActionDialog: FC<{ action: "reset" | "revoke" }> = ({ action }) => {
	const { t } = useTranslation();
	const toast = useToast();
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
					toast({
						title: t(
							isRevoke ? "revokeUserSub.success" : "resetUserUsage.success",
							{ username: user.username },
						),
						status: "success",
						isClosable: true,
						position: "top",
						duration: 3000,
					});
				})
				.catch(() => {
					toast({
						title: t(isRevoke ? "revokeUserSub.error" : "resetUserUsage.error"),
						status: "error",
						isClosable: true,
						position: "top",
						duration: 3000,
					});
				})
				.finally(() => {
					setLoading(false);
				});
		}
	};

	return (
		<AppDialog
			isCentered
			isOpen={Boolean(user)}
			onClose={onClose}
			size="sm"
			title={
				<Icon color="blue">
					<ResetIcon />
				</Icon>
			}
			overlayProps={{ bg: "blackAlpha.300", backdropFilter: "blur(10px)" }}
			contentProps={{ mx: "3" }}
			headerProps={{ pt: 6 }}
			closeButtonProps={{ mt: 3 }}
			footerProps={{ display: "flex" }}
			footer={
				<>
					<Button size="sm" onClick={onClose} mr={3} w="full" variant="outline">
						{t("cancel")}
					</Button>
					<Button
						size="sm"
						w="full"
						colorScheme="blue"
						onClick={onSubmit}
						leftIcon={loading ? <Spinner size="xs" /> : undefined}
					>
						{t(isRevoke ? "revoke" : "reset")}
					</Button>
				</>
			}
		>
			<Text fontWeight="semibold" fontSize="lg">
				{t(isRevoke ? "revokeUserSub.title" : "resetUserUsage.title")}
			</Text>
			{user && (
				<Text
					mt={1}
					fontSize="sm"
					_dark={{ color: "gray.400" }}
					color="gray.600"
				>
					<Trans components={{ b: <b /> }}>
						{t(isRevoke ? "revokeUserSub.prompt" : "resetUserUsage.prompt", {
							username: user.username,
						})}
					</Trans>
				</Text>
			)}
		</AppDialog>
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
			const needsGlobalSpeeds = dashboard.filters.advancedFilters?.includes(
				"top_speed",
			);
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
			// Keep the last successful snapshot during a transient poll failure.
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
		return (
			<Flex align="center" justify="center" minH="420px">
				<Spinner size="lg" />
			</Flex>
		);
	}

	if (isAdminDisabled) {
		return (
			<VStack spacing={5} align="stretch" dir={isRTL ? "rtl" : "ltr"}>
				<PageHeader title={t("users")} />
				<Flex
					align="center"
					border="1px solid"
					borderColor="panel.border"
					borderRadius="8px"
					direction="column"
					justify="center"
					minH="420px"
					px={6}
					py={10}
					textAlign="center"
				>
					<DisabledIcon color="red.400" mb={5} />
					<Text fontSize="xl" fontWeight="bold" mb={2}>
						{t("usersTable.adminDisabledTitle")}
					</Text>
					<Text color="panel.textSecondary" maxW="520px">
						{userData.disabled_reason ||
							t("usersTable.adminDisabledDescription")}
					</Text>
				</Flex>
			</VStack>
		);
	}

	return (
		<VStack
			className="rb-users-section"
			spacing={4}
			align="stretch"
			dir={isRTL ? "rtl" : "ltr"}
		>
			<UsersTable
				toolbar={<UsersFilterBar />}
				headerActions={
					<HStack spacing={1}>
						<ResourceRefreshButton
							aria-label={t("refresh")}
							label={t("refresh")}
							icon={<ReloadIcon />}
							onClick={() => {
								refetchUsers(true);
								void refreshOnlineUsers();
							}}
							isLoading={loading}
						/>
						<Menu placement={isRTL ? "bottom-start" : "bottom-end"} isLazy>
							<MenuButton
								as={Button}
								size="sm"
								variant="ghost"
								rightIcon={<ChevronDownIcon width={14} />}
								aria-label={t("usersTable.autoRefresh")}
								px={2}
							>
								{autoRefreshInterval
									? `${t("usersTable.autoRefresh")} · ${autoRefreshInterval / 1000}s`
									: t("usersTable.autoRefreshOff")}
							</MenuButton>
							<Portal>
								<MenuList
									zIndex={1800}
									minW="170px"
									bg="panel.surface"
									borderColor="panel.border"
								>
									<MenuItem
										onClick={() => setAutoRefreshInterval(0)}
										fontWeight={autoRefreshInterval === 0 ? "bold" : "normal"}
									>
										{t("usersTable.autoRefreshOff")}
									</MenuItem>
									{AUTO_REFRESH_INTERVALS.map((interval) => (
										<MenuItem
											key={interval}
											onClick={() => setAutoRefreshInterval(interval)}
											fontWeight={
												autoRefreshInterval === interval ? "bold" : "normal"
											}
										>
											{t("usersTable.autoRefreshEvery", {
												seconds: interval / 1000,
											})}
										</MenuItem>
									))}
								</MenuList>
							</Portal>
						</Menu>
					</HStack>
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
		</VStack>
	);
};

export default UsersPage;

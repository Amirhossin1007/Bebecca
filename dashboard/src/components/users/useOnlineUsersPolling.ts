import { fetchInbounds, useDashboard } from "contexts/DashboardContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetch } from "service/http";

type OnlineUsersResponse =
	| string[]
	| {
			users: string[];
			speeds: Record<string, { upload_speed: number; download_speed: number }>;
	  };

type UseOnlineUsersPollingOptions = {
	disabled: boolean;
};

export const useOnlineUsersPolling = ({
	disabled,
}: UseOnlineUsersPollingOptions) => {
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
			return;
		} finally {
			onlineRefreshInFlightRef.current = false;
		}
	}, []);

	useEffect(() => {
		if (disabled) return;
		useDashboard.getState().refetchUsers(true);
		fetchInbounds();
	}, [disabled]);

	useEffect(() => {
		if (disabled || !autoRefreshInterval) return;
		void refreshOnlineUsers();
		const timer = window.setInterval(
			() => void refreshOnlineUsers(),
			autoRefreshInterval,
		);
		return () => window.clearInterval(timer);
	}, [autoRefreshInterval, disabled, refreshOnlineUsers]);

	useEffect(() => {
		if (disabled || !autoRefreshInterval) return;
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
	}, [autoRefreshInterval, disabled, refreshOnlineUsers]);

	return {
		autoRefreshInterval,
		setAutoRefreshInterval,
		refreshOnlineUsers,
	};
};

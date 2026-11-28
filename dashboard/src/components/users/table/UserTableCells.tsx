import { formatUsagePair, UserOnlineBadge } from "components/users";
import { useDashboard } from "contexts/DashboardContext";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "types/User";
import { formatBytes } from "utils/formatByte";

export const USER_STATUS_TEXT_COLORS: Partial<
	Record<UserListItem["status"], string>
> = {
	active: "var(--color-green-400)",
	on_hold: "var(--color-purple-400)",
	expired: "var(--color-yellow-400)",
	limited: "var(--color-red-400)",
};

export const formatUsernamePreview = (
	username: string,
	maxLength = 20,
): string =>
	username.length > maxLength
		? `${username.slice(0, Math.max(4, maxLength - 4))}...`
		: username;

export const getApiErrorMessage = (
	error: unknown,
	fallback: string,
): string => {
	const candidate = error as {
		data?: { detail?: string };
		message?: string;
	};
	return candidate?.data?.detail || candidate?.message || fallback;
};

export const UserSpeed: FC<{ user: UserListItem }> = ({ user }) => {
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
			className="rb-stat-pair flex flex-col gap-0 text-[0.75rem] leading-[1.375] font-mono tabular-nums [unicode-bidi:isolate] text-start"
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

export const UserPresence: FC<{ user: UserListItem }> = ({ user }) => {
	const isOnline = useDashboard(
		(state) => state.liveUserStats[user.username]?.is_online,
	);
	return <UserOnlineBadge isOnline={isOnline ?? user.is_online} />;
};

export const MobileUserOnlineDot: FC<{ user: UserListItem }> = ({ user }) => {
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

export const MobileLifetimeDetail: FC<{
	totalUsedTraffic: number;
}> = ({ totalUsedTraffic }) => (
	<p
		dir="ltr"
		className="text-[0.875rem] font-semibold text-panel-text font-mono tabular-nums truncate [unicode-bidi:isolate]"
	>
		{formatBytes(totalUsedTraffic)}
	</p>
);

export const MobileUsageDetail: FC<{
	used: number;
	total: number | null;
}> = ({ used, total }) => (
	<p
		dir="ltr"
		className="text-[0.875rem] font-semibold text-panel-text font-mono tabular-nums truncate [unicode-bidi:isolate]"
	>
		{formatUsagePair(used, total)}
	</p>
);

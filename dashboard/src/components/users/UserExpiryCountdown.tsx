import { cn } from "lib/cn";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Status } from "types/User";

const DAY_SECONDS = 86400;
const URGENT_WINDOW_SECONDS = DAY_SECONDS;
const EXPIRY_UNITS = [
	["Y", 365 * DAY_SECONDS],
	["M", 30 * DAY_SECONDS],
	["D", DAY_SECONDS],
	["H", 3600],
] as const;

type UserExpiryCountdownProps = {
	expire?: number | null;
	status?: Status;
	className?: string;
};

type Urgency = "none" | "soon" | "urgent" | "expired";

const pad = (value: number) => String(value).padStart(2, "0");

export const formatExpiryClock = (remainingSeconds: number): string => {
	const remaining = Math.max(0, Math.floor(remainingSeconds));
	const hours = Math.floor(remaining / 3600);
	const minutes = Math.floor((remaining % 3600) / 60);
	const seconds = remaining % 60;
	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const formatExpiryDuration = (remainingSeconds: number): string => {
	let rest = Math.max(0, Math.floor(remainingSeconds));
	const parts: string[] = [];
	for (const [label, seconds] of EXPIRY_UNITS) {
		const value = Math.floor(rest / seconds);
		if (value > 0) {
			parts.push(`${value}${label}`);
			rest %= seconds;
		}
		if (parts.length === 2) break;
	}
	return parts.join(", ") || "<1H";
};

const getUrgency = (remainingSeconds: number): Urgency => {
	if (remainingSeconds <= 0) return "expired";
	if (remainingSeconds <= URGENT_WINDOW_SECONDS) return "urgent";
	if (remainingSeconds <= 3 * DAY_SECONDS) return "soon";
	return "none";
};

const URGENCY_CLASSES: Record<Urgency, string> = {
	none: "text-panel-text-secondary",
	soon: "text-amber-500 dark:text-amber-400 font-medium",
	urgent: "text-red-500 dark:text-red-400 font-semibold",
	expired: "text-red-500 dark:text-red-400 font-semibold",
};

export const UserExpiryCountdown: FC<UserExpiryCountdownProps> = ({
	expire,
	status,
	className,
}) => {
	const { t } = useTranslation();
	const [nowSeconds, setNowSeconds] = useState(() =>
		Math.floor(Date.now() / 1000),
	);
	const remaining = expire ? expire - nowSeconds : null;
	const isLiveCountdown =
		remaining !== null && remaining > 0 && remaining < URGENT_WINDOW_SECONDS;

	useEffect(() => {
		if (!expire) return;
		const interval = window.setInterval(
			() => setNowSeconds(Math.floor(Date.now() / 1000)),
			isLiveCountdown ? 1000 : 30_000,
		);
		return () => window.clearInterval(interval);
	}, [expire, isLiveCountdown]);

	if (status === "expired" || (remaining !== null && remaining <= 0)) {
		return (
			<span
				className={cn(
					"text-[11px] tabular-nums",
					URGENCY_CLASSES.expired,
					className,
				)}
			>
				{t("usersTable.expired")}
			</span>
		);
	}

	if (!expire || remaining === null) {
		return (
			<span
				className={cn(
					"text-[11px] text-panel-text-muted tabular-nums",
					className,
				)}
			>
				∞
			</span>
		);
	}

	const urgency = getUrgency(remaining);

	if (isLiveCountdown) {
		return (
			<span
				dir="ltr"
				className={cn(
					"text-[11px] font-mono tracking-tight tabular-nums",
					URGENCY_CLASSES[urgency],
					className,
				)}
			>
				{formatExpiryClock(remaining)}
			</span>
		);
	}

	return (
		<span
			dir="ltr"
			className={cn(
				"text-[11px] tabular-nums",
				URGENCY_CLASSES[urgency],
				className,
			)}
		>
			{formatExpiryDuration(remaining)}
		</span>
	);
};

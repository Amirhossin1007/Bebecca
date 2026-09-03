import { Text } from "@chakra-ui/react";
import { type FC, useEffect, useState } from "react";
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
	/** Expiry timestamp in unix seconds; null/0 means the user never expires. */
	expire?: number | null;
	status?: Status;
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

const URGENCY_COLORS: Record<Urgency, string> = {
	none: "panel.text",
	soon: "orange.400",
	urgent: "red.400",
	expired: "red.400",
};

/**
 * Live expiry countdown for the expanded user card. Within the last 24 hours
 * it ticks every second as HH:MM:SS; further out it re-renders the relative
 * label once per half-minute so the value never goes stale on screen.
 */
export const UserExpiryCountdown: FC<UserExpiryCountdownProps> = ({
	expire,
	status,
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
			isLiveCountdown ? 1000 : 30000,
		);
		return () => window.clearInterval(interval);
	}, [expire, isLiveCountdown]);

	if (status === "on_hold" || !expire || remaining === null) {
		return (
			<Text
				fontSize="xl"
				fontWeight="semibold"
				lineHeight="1"
				color="panel.textMuted"
				aria-label={t("unlimited")}
			>
				∞
			</Text>
		);
	}

	const urgency = status === "expired" ? "expired" : getUrgency(remaining);

	return (
		<Text
			className="rb-user-expiry-countdown"
			data-urgency={urgency}
			fontSize="sm"
			fontWeight="semibold"
			color={URGENCY_COLORS[urgency]}
			dir="auto"
			noOfLines={1}
			textTransform={urgency === "expired" ? "uppercase" : undefined}
		>
			{urgency === "expired"
				? t("status.expired")
				: isLiveCountdown
					? formatExpiryClock(remaining)
					: formatExpiryDuration(remaining)}
		</Text>
	);
};

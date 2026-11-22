import { cn } from "lib/cn";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type UserOnlineBadgeProps = {
	isOnline: boolean;
	className?: string;
};

export const UserOnlineBadge: FC<UserOnlineBadgeProps> = ({
	isOnline,
	className,
}) => {
	const { t } = useTranslation();

	return (
		<span
			data-online={isOnline ? "true" : "false"}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-tight select-none",
				isOnline
					? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
					: "bg-panel-border/40 text-panel-text-muted",
				className,
			)}
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 rounded-full",
					isOnline
						? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] dark:bg-emerald-400"
						: "bg-panel-text-muted/50",
				)}
			/>
			<span>{t(isOnline ? "usersTable.online" : "usersTable.offline")}</span>
		</span>
	);
};

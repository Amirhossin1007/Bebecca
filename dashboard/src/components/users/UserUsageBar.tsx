import type { FC } from "react";
import { cn } from "lib/cn";
import { formatBytes } from "utils/formatByte";
import { getUsageTone, usageToneGradients } from "./userColors";

type UserUsageBarProps = {
	used: number;
	total: number | null;
	variant?: "compact" | "detailed" | "stacked";
	lifetimeUsed?: number;
	lifetimeLabel?: string;
	resetLabel?: string;
	className?: string;
};

export const formatUsagePair = (used: number, total: number | null): string => {
	const [usedValue, usedUnit] = formatBytes(used, 2, true);
	if (total === 0 || total === null) return `${usedValue} ${usedUnit}/∞`;

	const [totalValue, totalUnit] = formatBytes(total, 2, true);
	if (usedUnit === totalUnit) return `${usedValue}/${totalValue} ${totalUnit}`;
	return `${usedValue} ${usedUnit}/${totalValue} ${totalUnit}`;
};

export const UserUsageBar: FC<UserUsageBarProps> = ({
	used,
	total,
	variant = "compact",
	lifetimeUsed,
	lifetimeLabel,
	resetLabel,
	className,
}) => {
	const isUnlimited = total === 0 || total === null;
	const percent = isUnlimited ? 0 : Math.min((used / (total || 1)) * 100, 100);
	const tone = getUsageTone(percent, isUnlimited);
	const fillWidth = used <= 0 ? "0%" : isUnlimited ? "100%" : `${Math.max(percent, 2)}%`;
	const percentLabel = isUnlimited ? "∞" : `${Math.round(percent)}%`;

	const track = (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border/60 rb-user-usage-track">
			<div
				className="h-full rounded-full transition-[width] duration-300 rb-user-usage-fill"
				style={{
					width: fillWidth,
					backgroundImage: usageToneGradients[tone],
				}}
			/>
		</div>
	);

	if (variant === "compact") {
		return (
			<div
				data-tone={tone}
				data-variant={variant}
				className={cn("flex w-full flex-col gap-1.5 rb-user-usage", className)}
			>
				{track}
				<div
					dir="ltr"
					className="flex items-center justify-between gap-2 text-[11px] leading-none tabular-nums text-panel-text-muted select-none"
				>
					<span className="truncate [unicode-bidi:isolate] rb-user-usage-pair">
						{formatUsagePair(used, total)}
					</span>
					<span className="shrink-0 font-medium text-panel-text-secondary rb-user-usage-percent">
						{percentLabel}
					</span>
				</div>
			</div>
		);
	}

	if (variant === "stacked") {
		return (
			<div
				data-tone={tone}
				data-variant={variant}
				dir="ltr"
				className={cn("flex w-full flex-col gap-1.5 rb-user-usage", className)}
			>
				{track}
				<div className="flex items-center justify-between gap-3 text-[12px] leading-none tabular-nums whitespace-nowrap">
					<span className="truncate [unicode-bidi:isolate] rb-user-usage-pair font-medium text-panel-text">
						{formatBytes(used)}
					</span>
					<span
						className={cn(
							"truncate text-panel-text-muted rb-user-usage-pair",
							isUnlimited ? "text-[14px]" : "",
						)}
					>
						{isUnlimited ? "∞" : formatBytes(total)}
					</span>
				</div>
				{(lifetimeUsed !== undefined || resetLabel) && (
					<div className="flex items-center justify-between gap-2 text-[10px] text-panel-text-muted">
						{resetLabel ? <span className="truncate">{resetLabel}</span> : <span />}
						{lifetimeUsed !== undefined && (
							<span className="tabular-nums">
								{lifetimeLabel ? `${lifetimeLabel}: ` : ""}
								{formatBytes(lifetimeUsed)}
							</span>
						)}
					</div>
				)}
			</div>
		);
	}

	return (
		<div
			data-tone={tone}
			data-variant={variant}
			className={cn("flex w-full flex-col gap-1.5 rb-user-usage", className)}
		>
			<div className="flex items-center gap-2">
				<div className="min-w-0 flex-1">{track}</div>
				<span
					dir="ltr"
					className="w-10 shrink-0 text-end text-[11px] font-semibold tabular-nums text-panel-text-secondary rb-user-usage-percent"
				>
					{percentLabel}
				</span>
			</div>
			<div
				dir="ltr"
				className="flex items-center justify-between gap-2 text-[11px] leading-none tabular-nums text-panel-text-muted"
			>
				<span className="truncate [unicode-bidi:isolate] rb-user-usage-pair">
					{formatUsagePair(used, total)}
				</span>
				{lifetimeUsed !== undefined && (
					<span className="shrink-0 text-[10px]">
						{lifetimeLabel ? `${lifetimeLabel}: ` : ""}
						{formatBytes(lifetimeUsed)}
					</span>
				)}
			</div>
		</div>
	);
};

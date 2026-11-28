import { cn } from "lib/cn";
import type { FC } from "react";
import { formatBytes } from "utils/formatByte";
import { getUsageTone, usageToneGradients } from "./userColors";

type UserUsageBarProps = {
	used: number;
	total: number | null;
	variant?: "compact" | "detailed" | "stacked";
	lifetimeUsed?: number;
	lifetimeLabel?: string;
	resetLabel?: string;
};

const PERCENT_SLOT_WIDTH = "2.75em";

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
}) => {
	const isUnlimited = total === 0 || total === null;
	const percent = isUnlimited ? 0 : Math.min((used / (total || 1)) * 100, 100);
	const tone = getUsageTone(percent, isUnlimited);
	const fillWidth =
		used <= 0 ? "0%" : isUnlimited ? "100%" : `${Math.max(percent, 2)}%`;
	const percentLabel = isUnlimited ? "∞" : `${Math.round(percent)}%`;

	const track = (
		<div className="flex-[1_1_auto] min-w-0! rb-user-usage-track">
			<div
				style={{
					width: fillWidth,
					backgroundImage: usageToneGradients[tone],
				}}
				className="rb-user-usage-fill"
			/>
		</div>
	);

	if (variant === "compact") {
		return (
			<div
				data-tone={tone}
				data-variant={variant}
				className="flex flex-col gap-1 w-full max-w-full justify-center overflow-hidden rb-user-usage"
			>
				{track}
				<div
					dir="ltr"
					className="flex flex-row items-center justify-between gap-2 text-[0.75rem] w-full min-w-0! whitespace-nowrap"
				>
					<p className="truncate min-w-0! [unicode-bidi:isolate] rb-user-usage-pair">
						{formatUsagePair(used, total)}
					</p>
					<p className="shrink-0 rb-user-usage-percent">{percentLabel}</p>
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
				className="flex flex-col gap-1 w-full min-w-0! rb-user-usage"
			>
				{track}
				<div className="flex items-center justify-between gap-3 h-[16px] text-[0.75rem] whitespace-nowrap">
					<p className="truncate rb-user-usage-pair">{formatBytes(used)}</p>
					<p
						className={cn(
							"text-panel-text-muted truncate",
							isUnlimited ? "text-[1rem]" : "",
							"rb-user-usage-pair",
						)}
					>
						{isUnlimited ? "∞" : formatBytes(total)}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div
			data-tone={tone}
			data-variant={variant}
			className="flex flex-col gap-0.5 w-full max-w-full overflow-hidden rb-user-usage"
		>
			<div className="flex items-center gap-0 w-full min-w-0!">
				{track}
				<p
					dir="ltr"
					style={{ flex: `0 0 ${PERCENT_SLOT_WIDTH}` }}
					className="text-start rb-user-usage-percent"
				>
					{percentLabel}
				</p>
			</div>
			<div className="flex items-center w-full min-w-0! gap-2">
				<div
					dir="ltr"
					className="flex items-center flex-[1_1_auto] min-w-0! flex-wrap gap-x-3 gap-y-0.5 text-[0.75rem]"
				>
					<p className="truncate min-w-0! flex-[0_1_auto] text-start [unicode-bidi:isolate] rb-user-usage-pair">
						{formatUsagePair(used, total)}
						{resetLabel ? ` · ${resetLabel}` : ""}
					</p>
					{lifetimeUsed !== undefined && (
						<p className="text-panel-text-muted truncate shrink-0 ms-auto text-end [unicode-bidi:isolate]">
							{lifetimeLabel ? `${lifetimeLabel}: ` : ""}
							<span className="font-semibold text-panel-text-secondary">
								{formatBytes(lifetimeUsed)}
							</span>
						</p>
					)}
				</div>
				<div aria-hidden style={{ flex: `0 0 ${PERCENT_SLOT_WIDTH}` }} />
			</div>
		</div>
	);
};

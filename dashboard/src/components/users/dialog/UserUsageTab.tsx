import type { FC } from "react";
import ReactApexChart from "react-apexcharts";
import { useTranslation } from "react-i18next";
import type { User } from "types/User";
import { formatBytes } from "utils/formatByte";

type UserUsageTabProps = {
	user: User;
	usageConfig: any;
	usageFilter: string;
	onUsageFilterChange: (filter: string) => void;
	loading: boolean;
};

const USAGE_PERIODS = [
	{ key: "1d", label: "24h" },
	{ key: "3d", label: "3d" },
	{ key: "1w", label: "7d" },
	{ key: "1m", label: "30d" },
	{ key: "all", label: "All" },
];

export const UserUsageTab: FC<UserUsageTabProps> = ({
	user,
	usageConfig,
	usageFilter,
	onUsageFilterChange,
	loading,
}) => {
	const { t } = useTranslation();

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
				<div className="rounded-[12px] border border-panel-border bg-panel-surface/60 p-3">
					<p className="text-[11px] font-medium text-panel-text-secondary">
						{t("usersTable.traffic")}
					</p>
					<p
						dir="ltr"
						className="mt-1 text-sm font-bold text-panel-text font-mono tabular-nums [unicode-bidi:isolate] text-start"
					>
						{formatBytes(user.used_traffic, 2)}
					</p>
				</div>
				<div className="rounded-[12px] border border-panel-border bg-panel-surface/60 p-3">
					<p className="text-[11px] font-medium text-panel-text-secondary">
						{t("usersTable.remainingTraffic")}
					</p>
					<p
						dir="ltr"
						className="mt-1 text-sm font-bold text-panel-text font-mono tabular-nums [unicode-bidi:isolate] text-start"
					>
						{user.data_limit
							? formatBytes(Math.max(0, user.data_limit - user.used_traffic), 2)
							: t("userDialog.unlimited")}
					</p>
				</div>
				<div className="rounded-[12px] border border-panel-border bg-panel-surface/60 p-3">
					<p className="text-[11px] font-medium text-panel-text-secondary">
						{t("usersTable.lifetimeUsage")}
					</p>
					<p
						dir="ltr"
						className="mt-1 text-sm font-bold text-panel-text font-mono tabular-nums [unicode-bidi:isolate] text-start"
					>
						{formatBytes(user.lifetime_used_traffic ?? user.used_traffic, 2)}
					</p>
				</div>
				<div className="rounded-[12px] border border-panel-border bg-panel-surface/60 p-3">
					<p className="text-[11px] font-medium text-panel-text-secondary">
						{t("userDialog.dataLimit")}
					</p>
					<p
						dir="ltr"
						className="mt-1 text-sm font-bold text-panel-text font-mono tabular-nums [unicode-bidi:isolate] text-start"
					>
						{user.data_limit
							? formatBytes(user.data_limit, 2)
							: t("userDialog.unlimited")}
					</p>
				</div>
			</div>

			<div className="rounded-[16px] border border-panel-border bg-panel-surface/60 p-4 shadow-xs">
				<div className="flex items-center justify-between pb-3 border-b border-panel-border/60">
					<h4 className="text-xs font-semibold text-panel-text">
						{t("userDialog.usage")}
					</h4>
					<div className="flex items-center rounded-lg border border-panel-border bg-panel-card p-0.5">
						{USAGE_PERIODS.map((period) => (
							<button
								key={period.key}
								type="button"
								onClick={() => onUsageFilterChange(period.key)}
								className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer touch-manipulation active:scale-[0.98] ${
									usageFilter === period.key
										? "bg-panel-accent text-white shadow-xs"
										: "text-panel-text-secondary min-[769px]:hover:text-panel-text"
								}`}
							>
								{period.label}
							</button>
						))}
					</div>
				</div>

				<div className="pt-3 min-h-[220px]">
					{usageConfig?.series && usageConfig.series.length > 0 ? (
						<ReactApexChart
							options={usageConfig.options}
							series={usageConfig.series}
							type="area"
							height={220}
						/>
					) : (
						<div className="flex h-[200px] items-center justify-center text-xs text-panel-text-muted">
							{loading ? t("loading") : t("noData")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

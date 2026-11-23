import { useTranslation } from "react-i18next";
import { cn } from "lib/cn";
import { formatBytes } from "utils/formatByte";
import type { UsersOverviewSelection, UsersOverviewTarget } from "utils/usersOverview";
import { Users, Wifi, Activity, HardDrive } from "lucide-react";

export type OverviewStatusKey =
	| "active"
	| "expired"
	| "limited"
	| "on_hold"
	| "disabled";

export type UsersOverviewBandProps = {
	total: number;
	usersLimit?: number | null;
	active: number;
	online: number;
	usage: number | null;
	usageLabel?: string;
	breakdown: Partial<Record<OverviewStatusKey, number>>;
	locale: string;
	bare?: boolean;
	selection: UsersOverviewSelection;
	onSelect: (target: UsersOverviewTarget) => void;
};

const STATUS_ORDER: OverviewStatusKey[] = [
	"active",
	"expired",
	"limited",
	"on_hold",
	"disabled",
];

const STATUS_CONFIG: Record<
	OverviewStatusKey,
	{ dot: string; text: string }
> = {
	active: {
		dot: "bg-emerald-500",
		text: "text-emerald-600 dark:text-emerald-400",
	},
	expired: {
		dot: "bg-red-500",
		text: "text-red-600 dark:text-red-400",
	},
	limited: {
		dot: "bg-amber-500",
		text: "text-amber-600 dark:text-amber-400",
	},
	on_hold: {
		dot: "bg-purple-500",
		text: "text-purple-600 dark:text-purple-400",
	},
	disabled: {
		dot: "bg-panel-text-muted/60",
		text: "text-panel-text-muted",
	},
};

const count = (value: number | null | undefined, locale: string) =>
	value === null || value === undefined
		? "—"
		: new Intl.NumberFormat(locale || "en", { maximumFractionDigits: 0 }).format(value);

const percent = (value: number, locale: string) =>
	new Intl.NumberFormat(locale || "en", { maximumFractionDigits: 0 }).format(value);

export function UsersOverviewBand({
	total,
	usersLimit,
	active,
	online,
	usage,
	usageLabel,
	breakdown,
	locale,
	bare = false,
	selection,
	onSelect,
}: UsersOverviewBandProps) {
	const { t } = useTranslation();
	const activeCount = (breakdown.active !== undefined && breakdown.active > 0) ? breakdown.active : (active || breakdown.active || 0);
	const share = (value: number, of: number) => (of > 0 ? (value / of) * 100 : 0);
	const limitPercent = usersLimit ? Math.min(100, share(total, usersLimit)) : null;
	const avgUsage = usage !== null && total > 0 ? Math.round(usage / total) : 0;

	return (
		<section
			className={cn("flex flex-col gap-3", bare ? "p-0" : "w-full")}
			aria-label={t("usersStatusBreakdown")}
		>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<button
					type="button"
					onClick={() => onSelect({ kind: "all" })}
					className={cn(
						"flex flex-col justify-between gap-3 rounded-[18px] border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/40 active:scale-[0.99] touch-manipulation",
						!selection.status && !selection.online && !selection.usage
							? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
							: "border-panel-border",
					)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-panel-text-muted">
							{t("usersTable.total")}
						</span>
						<div className="flex size-7 items-center justify-center rounded-[9px] bg-panel-elevated text-panel-text-secondary">
							<Users className="size-3.5" />
						</div>
					</div>

					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-bold tabular-nums tracking-tight text-panel-text [unicode-bidi:isolate] sm:text-3xl">
							{count(total, locale)}
						</span>
						{usersLimit ? (
							<span className="text-xs font-medium tabular-nums text-panel-text-muted [unicode-bidi:isolate]">
								/ {count(usersLimit, locale)}
							</span>
						) : null}
					</div>

					<div className="text-[11px] tabular-nums text-panel-text-muted [unicode-bidi:isolate]">
						{limitPercent !== null ? (
							<span>{percent(limitPercent, locale)}% {t("capacity")}</span>
						) : (
							<span>{t("usersTable.total")}</span>
						)}
					</div>
				</button>

				<button
					type="button"
					onClick={() => onSelect({ kind: "online" })}
					className={cn(
						"flex flex-col justify-between gap-3 rounded-[18px] border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/40 active:scale-[0.99] touch-manipulation",
						selection.online
							? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
							: "border-panel-border",
					)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-panel-text-muted">
							{t("onlineStatus.online")}
						</span>
						<div className="flex size-7 items-center justify-center rounded-[9px] bg-emerald-500/10 text-emerald-500">
							<Wifi className="size-3.5" />
						</div>
					</div>

					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-bold tabular-nums tracking-tight text-panel-text [unicode-bidi:isolate] sm:text-3xl">
							{count(online, locale)}
						</span>
						<span className="inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
					</div>

					<div className="text-[11px] tabular-nums text-panel-text-muted [unicode-bidi:isolate]">
						<span>{percent(share(online, total || 1), locale)}% {t("onlineStatus.online")}</span>
					</div>
				</button>

				<button
					type="button"
					onClick={() => onSelect({ kind: "status", status: "active" })}
					className={cn(
						"flex flex-col justify-between gap-3 rounded-[18px] border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/40 active:scale-[0.99] touch-manipulation",
						selection.status === "active"
							? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
							: "border-panel-border",
					)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-panel-text-muted">
							{t("status.active")}
						</span>
						<div className="flex size-7 items-center justify-center rounded-[9px] bg-emerald-500/10 text-emerald-500">
							<Activity className="size-3.5" />
						</div>
					</div>

					<div className="flex items-baseline gap-2">
						<span className="text-2xl font-bold tabular-nums tracking-tight text-panel-text [unicode-bidi:isolate] sm:text-3xl">
							{count(activeCount, locale)}
						</span>
						<span className="text-xs font-medium tabular-nums text-panel-text-muted [unicode-bidi:isolate]">
							/ {count(total, locale)}
						</span>
					</div>

					<div className="text-[11px] tabular-nums text-panel-text-muted [unicode-bidi:isolate]">
						<span>{percent(share(activeCount, total || 1), locale)}% {t("status.active")}</span>
					</div>
				</button>

				<button
					type="button"
					onClick={() => onSelect({ kind: "usage" })}
					className={cn(
						"flex flex-col justify-between gap-3 rounded-[18px] border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/40 active:scale-[0.99] touch-manipulation",
						selection.usage
							? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
							: "border-panel-border",
					)}
				>
					<div className="flex items-center justify-between gap-2">
						<span className="text-xs font-medium text-panel-text-muted">
							{usageLabel ?? t("usersTable.listUsage")}
						</span>
						<div className="flex size-7 items-center justify-center rounded-[9px] bg-panel-elevated text-panel-text-secondary">
							<HardDrive className="size-3.5" />
						</div>
					</div>

					<div>
						<span
							dir="ltr"
							className="block text-2xl font-bold tabular-nums tracking-tight text-panel-text [unicode-bidi:isolate] sm:text-3xl text-start"
						>
							{usage === null ? "—" : formatBytes(usage, 1)}
						</span>
					</div>

					<div className="flex items-baseline gap-1 text-[11px] text-panel-text-muted">
						<span>{t("average")}:</span>
						<span dir="ltr" className="font-semibold text-panel-text tabular-nums [unicode-bidi:isolate]">
							{formatBytes(avgUsage, 1)}
						</span>
					</div>
				</button>
			</div>

			<div className="flex flex-wrap items-center gap-1.5 pt-0.5">
				{STATUS_ORDER.map((key) => {
					const isSelected = selection.status === key;
					const cfg = STATUS_CONFIG[key];
					const val = breakdown[key] ?? 0;
					return (
						<button
							key={key}
							type="button"
							onClick={() => onSelect({ kind: "status", status: key })}
							className={cn(
								"inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer active:scale-[0.98] touch-manipulation",
								isSelected
									? "border-panel-accent bg-panel-accent text-white shadow-xs"
									: "bg-panel-surface border-panel-border text-panel-text min-[769px]:hover:bg-panel-elevated",
							)}
						>
							<span
								className={cn(
									"size-1.5 rounded-full shrink-0",
									isSelected ? "bg-white" : cfg.dot,
								)}
							/>
							<span>{t(`status.${key}`)}</span>
							<span className="tabular-nums font-mono opacity-80 [unicode-bidi:isolate]">{count(val, locale)}</span>
						</button>
					);
				})}
			</div>
		</section>
	);
}

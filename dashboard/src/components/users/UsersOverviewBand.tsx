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
	{ dot: string; bar: string; badge: string; text: string }
> = {
	active: {
		dot: "bg-emerald-500",
		bar: "bg-emerald-500",
		badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
		text: "text-emerald-600 dark:text-emerald-400",
	},
	expired: {
		dot: "bg-red-500",
		bar: "bg-red-500",
		badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
		text: "text-red-600 dark:text-red-400",
	},
	limited: {
		dot: "bg-amber-500",
		bar: "bg-amber-500",
		badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
		text: "text-amber-600 dark:text-amber-400",
	},
	on_hold: {
		dot: "bg-purple-500",
		bar: "bg-purple-500",
		badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
		text: "text-purple-600 dark:text-purple-400",
	},
	disabled: {
		dot: "bg-panel-text-muted/60",
		bar: "bg-panel-text-muted/60",
		badge: "bg-panel-elevated text-panel-text-muted border-panel-border",
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
	const totals = STATUS_ORDER.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0);
	const share = (value: number, of: number) => (of > 0 ? (value / of) * 100 : 0);
	const limitPercent = usersLimit ? Math.min(100, share(total, usersLimit)) : null;

	return (
		<section
			className={cn(
				"grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4",
				bare ? "p-0" : "w-full",
			)}
			aria-label={t("usersStatusBreakdown")}
		>
			<button
				type="button"
				onClick={() => onSelect({ kind: "all" })}
				className={cn(
					"group relative flex flex-col justify-between gap-3 rounded-2xl border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/50 min-[769px]:hover:shadow-md active:scale-[0.99] touch-manipulation",
					!selection.status && !selection.online && !selection.usage
						? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
						: "border-panel-border",
				)}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-medium text-panel-text-muted">
						{t("usersTable.total")}
					</span>
					<div className="flex size-7 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
						<Users className="size-3.5" />
					</div>
				</div>

				<div className="flex items-baseline gap-2">
					<span className="text-2xl font-bold tabular-nums tracking-tight text-panel-text sm:text-3xl">
						{count(total, locale)}
					</span>
					{usersLimit ? (
						<span className="text-xs font-medium tabular-nums text-panel-text-muted">
							/ {count(usersLimit, locale)}
						</span>
					) : null}
				</div>

				{limitPercent !== null ? (
					<div className="space-y-1">
						<div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border/60">
							<div
								className="h-full rounded-full bg-panel-accent transition-[width] duration-500"
								style={{ width: `${limitPercent}%` }}
							/>
						</div>
						<div className="flex items-center justify-between text-[11px] tabular-nums text-panel-text-muted">
							<span>{percent(limitPercent, locale)}% {t("capacity")}</span>
							<span>{count(usersLimit, locale)} {t("usersLimit")}</span>
						</div>
					</div>
				) : (
					<span className="text-xs text-panel-text-muted">{t("users")}</span>
				)}
			</button>

			<div className="flex flex-col justify-between gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 text-start transition-all shadow-xs">
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-medium text-panel-text-muted">
						{t("onlineStatus.online")} &amp; {t("status.active")}
					</span>
					<div className="flex size-7 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
						<Wifi className="size-3.5" />
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() => onSelect({ kind: "online" })}
						className={cn(
							"flex flex-col gap-1 rounded-xl border p-2.5 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/50 active:scale-[0.98] touch-manipulation",
							selection.online
								? "border-panel-accent bg-panel-accent/5 ring-1 ring-panel-accent/30"
								: "border-panel-border/60 bg-panel-elevated/40",
						)}
					>
						<div className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
							<span className="text-[11px] font-medium text-panel-text-muted">
								{t("onlineStatus.online")}
							</span>
						</div>
						<span className="text-lg font-bold tabular-nums text-panel-text">
							{count(online, locale)}
						</span>
						<span className="text-[10px] tabular-nums text-panel-text-muted">
							{percent(share(online, totals || total || 1), locale)}%
						</span>
					</button>

					<button
						type="button"
						onClick={() => onSelect({ kind: "status", status: "active" })}
						className={cn(
							"flex flex-col gap-1 rounded-xl border p-2.5 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/50 active:scale-[0.98] touch-manipulation",
							selection.status === "active"
								? "border-panel-accent bg-panel-accent/5 ring-1 ring-panel-accent/30"
								: "border-panel-border/60 bg-panel-elevated/40",
						)}
					>
						<div className="flex items-center gap-1.5">
							<span className="size-2 rounded-full bg-emerald-500" />
							<span className="text-[11px] font-medium text-panel-text-muted">
								{t("status.active")}
							</span>
						</div>
						<span className="text-lg font-bold tabular-nums text-panel-text">
							{count(active, locale)}
						</span>
						<span className="text-[10px] tabular-nums text-panel-text-muted">
							{percent(share(active, totals || total || 1), locale)}%
						</span>
					</button>
				</div>
			</div>

			<div className="flex flex-col justify-between gap-3 rounded-2xl border border-panel-border bg-panel-surface p-4 text-start transition-all shadow-xs">
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5">
						<span className="text-xs font-medium text-panel-text-muted">
							{t("usersStatusBreakdown")}
						</span>
						<span className="text-xs font-semibold tabular-nums text-panel-text">
							({count(totals, locale)})
						</span>
					</div>
					<div className="flex size-7 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
						<Activity className="size-3.5" />
					</div>
				</div>

				<div className="flex h-2 w-full gap-1 overflow-hidden rounded-full bg-panel-border/50">
					{STATUS_ORDER.map((key) => {
						const val = breakdown[key] ?? 0;
						if (!val) return null;
						return (
							<div
								key={key}
								className={cn("h-full rounded-full transition-all", STATUS_CONFIG[key].bar)}
								style={{ width: `${share(val, totals || 1)}%` }}
								title={`${t(`status.${key}`)}: ${val}`}
							/>
						);
					})}
				</div>

				<div className="flex flex-wrap gap-1.5">
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
									"inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer active:scale-[0.98] touch-manipulation",
									isSelected
										? "border-panel-accent bg-panel-accent text-white shadow-xs"
										: cn("bg-panel-elevated/40 border-panel-border/60 text-panel-text min-[769px]:hover:border-panel-accent/50"),
								)}
							>
								<span
									className={cn(
										"size-1.5 rounded-full",
										isSelected ? "bg-white" : cfg.dot,
									)}
								/>
								<span>{t(`status.${key}`)}</span>
								<span className="tabular-nums opacity-80">{val}</span>
							</button>
						);
					})}
				</div>
			</div>

			<button
				type="button"
				onClick={() => onSelect({ kind: "usage" })}
				className={cn(
					"group relative flex flex-col justify-between gap-3 rounded-2xl border bg-panel-surface p-4 text-start transition-all cursor-pointer min-[769px]:hover:border-panel-accent/50 min-[769px]:hover:shadow-md active:scale-[0.99] touch-manipulation",
					selection.usage
						? "border-panel-accent shadow-xs ring-1 ring-panel-accent/30"
						: "border-panel-border",
				)}
			>
				<div className="flex items-center justify-between gap-2">
					<span className="text-xs font-medium text-panel-text-muted">
						{usageLabel ?? t("usersTable.listUsage")}
					</span>
					<div className="flex size-7 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
						<HardDrive className="size-3.5" />
					</div>
				</div>

				<div>
					<span
						dir="ltr"
						className="block text-2xl font-bold tabular-nums tracking-tight text-panel-text [unicode-bidi:isolate] sm:text-3xl"
					>
						{usage === null ? "—" : formatBytes(usage)}
					</span>
					<div className="mt-1 flex items-baseline gap-1 text-xs text-panel-text-muted">
						{usage === null || total === 0 ? (
							<span>&nbsp;</span>
						) : (
							<>
								<span className="text-panel-text-muted">{t("average")}:</span>
								<span dir="ltr" className="font-semibold text-panel-text tabular-nums [unicode-bidi:isolate]">
									{formatBytes(Math.round(usage / Math.max(1, total)))}
								</span>
								<span>/ {t("user")}</span>
							</>
						)}
					</div>
				</div>

				<div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border/40">
					<div
						className="h-full rounded-full bg-blue-500 transition-all duration-500"
						style={{ width: usage ? "100%" : "0%" }}
					/>
				</div>
			</button>
		</section>
	);
}

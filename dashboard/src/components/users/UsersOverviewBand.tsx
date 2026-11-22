import { cn } from "lib/cn";
import { HardDrive, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatBytes } from "utils/formatByte";
import type {
	UsersOverviewSelection,
	UsersOverviewTarget,
} from "utils/usersOverview";

const count = (value: number | null | undefined, locale: string) =>
	value === null || value === undefined
		? "—"
		: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

const percent = (value: number, locale: string) =>
	new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

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

const STATUS_TONE: Record<OverviewStatusKey, string> = {
	active: "bg-emerald-500",
	expired: "bg-rose-500",
	limited: "bg-amber-500",
	on_hold: "bg-purple-500",
	disabled: "bg-zinc-500",
};

export function UsersOverviewBand({
	total,
	usersLimit,
	active,
	online,
	usage,
	usageLabel,
	breakdown,
	locale,
	selection,
	onSelect,
}: UsersOverviewBandProps) {
	const { t } = useTranslation();
	const totals = STATUS_ORDER.reduce(
		(sum, key) => sum + (breakdown[key] ?? 0),
		0,
	);
	const share = (value: number, of: number) =>
		of > 0 ? (value / of) * 100 : 0;
	const limitPercent = usersLimit
		? Math.min(100, share(total, usersLimit))
		: null;
	const isAllSelected =
		!selection.online && !selection.status && !selection.usage;

	return (
		<section
			aria-label={t("usersStatusBreakdown")}
			className="relative overflow-hidden rounded-2xl border border-panel-border bg-panel-surface p-4 sm:p-5 shadow-xs transition-shadow duration-200"
		>
			<div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
				<button
					type="button"
					onClick={() => onSelect({ kind: "all" })}
					className={cn(
						"group relative flex flex-col justify-between rounded-xl p-3 sm:p-3.5 text-start transition-all outline-hidden cursor-pointer",
						"border border-panel-border/40 bg-panel-elevated/40 min-[769px]:hover:border-panel-accent/40 min-[769px]:hover:bg-panel-elevated active:scale-[0.99]",
						isAllSelected && "border-panel-accent bg-panel-accent/10 shadow-xs",
					)}
				>
					<div className="flex w-full items-center justify-between">
						<span className="text-[11px] font-medium tracking-wide text-panel-text-muted">
							{t("usersTable.total")}
						</span>
						<div
							className={cn(
								"flex size-6 items-center justify-center rounded-lg bg-panel-surface text-panel-text-muted transition-colors",
								"group-hover:text-panel-accent",
								isAllSelected && "bg-panel-accent text-white",
							)}
						>
							<Users className="size-3.5" />
						</div>
					</div>
					<div className="mt-2 w-full">
						<div className="flex items-baseline gap-1.5">
							<span className="text-2xl font-bold tracking-tight tabular-nums text-panel-text">
								{count(total, locale)}
							</span>
							{usersLimit ? (
								<span className="text-xs font-medium tabular-nums text-panel-text-muted">
									/ {count(usersLimit, locale)}
								</span>
							) : null}
						</div>
						{limitPercent !== null ? (
							<div className="mt-2.5 space-y-1">
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-border/50">
									<div
										className="h-full rounded-full bg-panel-accent transition-[width] duration-300"
										style={{ width: `${limitPercent}%` }}
									/>
								</div>
								<p className="flex items-baseline justify-between text-[10px] tabular-nums text-panel-text-muted">
									<span>{percent(limitPercent, locale)}%</span>
									<span>{count(usersLimit, locale)} max</span>
								</p>
							</div>
						) : (
							<p className="mt-1 text-[11px] text-panel-text-muted">
								{t("users")}
							</p>
						)}
					</div>
				</button>

				<div className="grid grid-cols-2 gap-2 sm:gap-2.5">
					<button
						type="button"
						onClick={() => onSelect({ kind: "online" })}
						className={cn(
							"group relative flex flex-col justify-between rounded-xl p-3 text-start transition-all outline-hidden cursor-pointer",
							"border border-panel-border/40 bg-panel-elevated/40 min-[769px]:hover:border-emerald-500/40 min-[769px]:hover:bg-panel-elevated active:scale-[0.99]",
							selection.online &&
								"border-emerald-500 bg-emerald-500/10 shadow-xs",
						)}
					>
						<div className="flex w-full items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className="relative flex size-2">
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
									<span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
								</span>
								<span className="text-[11px] font-medium text-panel-text-muted">
									{t("onlineStatus.online")}
								</span>
							</div>
						</div>
						<div className="mt-2">
							<span className="text-xl font-bold tabular-nums text-panel-text">
								{count(online, locale)}
							</span>
							<p className="mt-0.5 text-[10px] tabular-nums text-panel-text-muted">
								{percent(share(online, totals || total || 1), locale)}%
							</p>
						</div>
					</button>

					<button
						type="button"
						onClick={() => onSelect({ kind: "status", status: "active" })}
						className={cn(
							"group relative flex flex-col justify-between rounded-xl p-3 text-start transition-all outline-hidden cursor-pointer",
							"border border-panel-border/40 bg-panel-elevated/40 min-[769px]:hover:border-emerald-500/40 min-[769px]:hover:bg-panel-elevated active:scale-[0.99]",
							selection.status === "active" &&
								"border-emerald-500 bg-emerald-500/10 shadow-xs",
						)}
					>
						<div className="flex w-full items-center justify-between">
							<div className="flex items-center gap-1.5">
								<span className="size-2 rounded-full bg-emerald-500" />
								<span className="text-[11px] font-medium text-panel-text-muted">
									{t("status.active")}
								</span>
							</div>
						</div>
						<div className="mt-2">
							<span className="text-xl font-bold tabular-nums text-panel-text">
								{count(active, locale)}
							</span>
							<p className="mt-0.5 text-[10px] tabular-nums text-panel-text-muted">
								{percent(share(active, totals || total || 1), locale)}%
							</p>
						</div>
					</button>
				</div>

				<div className="col-span-2 flex flex-col justify-between rounded-xl border border-panel-border/40 bg-panel-elevated/40 p-3 sm:p-3.5 lg:col-span-1">
					<div className="flex items-center justify-between">
						<span className="text-[11px] font-medium tracking-wide text-panel-text-muted">
							{t("usersStatusBreakdown")}
						</span>
						<span className="text-[11px] font-semibold tabular-nums text-panel-text-muted">
							{count(totals, locale)}
						</span>
					</div>

					<div className="my-2.5 flex h-2 w-full gap-1 overflow-hidden rounded-full border border-panel-border/40 bg-panel-surface p-0.5">
						{STATUS_ORDER.map((key) => {
							const value = breakdown[key] ?? 0;
							if (!value) return null;
							return (
								<div
									key={key}
									className={cn(
										"h-full rounded-full transition-all",
										STATUS_TONE[key],
									)}
									style={{
										width: `${Math.max(4, share(value, totals || 1))}%`,
									}}
									title={`${t(`status.${key}`)}: ${value}`}
								/>
							);
						})}
					</div>

					<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-3">
						{STATUS_ORDER.map((key) => {
							const isActive = selection.status === key;
							return (
								<button
									key={key}
									type="button"
									onClick={() => onSelect({ kind: "status", status: key })}
									className={cn(
										"flex items-center justify-between rounded-lg px-2 py-1 text-[11px] transition-colors cursor-pointer",
										"bg-panel-surface/60 min-[769px]:hover:bg-panel-surface min-[769px]:hover:text-panel-text",
										isActive
											? "bg-panel-surface font-semibold text-panel-text ring-1 ring-panel-accent/40"
											: "text-panel-text-secondary",
									)}
								>
									<span className="flex items-center gap-1.5 truncate">
										<span
											className={cn(
												"size-1.5 shrink-0 rounded-full",
												STATUS_TONE[key],
											)}
										/>
										<span className="truncate">{t(`status.${key}`)}</span>
									</span>
									<span className="ms-1 font-mono text-[10px] tabular-nums text-panel-text">
										{count(breakdown[key] ?? 0, locale)}
									</span>
								</button>
							);
						})}
					</div>
				</div>

				<button
					type="button"
					onClick={() => onSelect({ kind: "usage" })}
					className={cn(
						"group relative col-span-2 flex flex-col justify-between rounded-xl p-3 sm:p-3.5 text-start transition-all outline-hidden cursor-pointer lg:col-span-1",
						"border border-panel-border/40 bg-panel-elevated/40 min-[769px]:hover:border-panel-accent/40 min-[769px]:hover:bg-panel-elevated active:scale-[0.99]",
						selection.usage &&
							"border-panel-accent bg-panel-accent/10 shadow-xs",
					)}
				>
					<div className="flex w-full items-center justify-between">
						<span className="text-[11px] font-medium tracking-wide text-panel-text-muted">
							{usageLabel ?? t("usersTable.listUsage")}
						</span>
						<div
							className={cn(
								"flex size-6 items-center justify-center rounded-lg bg-panel-surface text-panel-text-muted transition-colors",
								"group-hover:text-panel-accent",
								selection.usage && "bg-panel-accent text-white",
							)}
						>
							<HardDrive className="size-3.5" />
						</div>
					</div>
					<div className="mt-2 w-full">
						<div className="text-2xl font-bold tracking-tight tabular-nums text-panel-text">
							<span dir="ltr" className="[unicode-bidi:isolate]">
								{usage === null ? "—" : formatBytes(usage)}
							</span>
						</div>
						<p className="mt-1 flex items-baseline gap-1 text-[11px] tabular-nums text-panel-text-muted">
							{usage === null || total === 0 ? (
								<span>&nbsp;</span>
							) : (
								<>
									<span
										dir="ltr"
										className="font-medium text-panel-text-secondary [unicode-bidi:isolate]"
									>
										{formatBytes(Math.round(usage / Math.max(1, total)))}
									</span>
									<span>/</span>
									<span>{t("user")}</span>
								</>
							)}
						</p>
					</div>
				</button>
			</div>
		</section>
	);
}

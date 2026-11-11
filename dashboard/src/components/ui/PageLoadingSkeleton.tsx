import { Skeleton } from "components/ui/skeleton";
import { cn } from "lib/cn";
import type { FC } from "react";

export interface PageLoadingSkeletonProps {
	variant?: "entity" | "dashboard";
	canSeeGlobal?: boolean;
	isRTL?: boolean;
	className?: string;
}

const ENTITY_ROWS = ["row-1", "row-2", "row-3", "row-4", "row-5", "row-6"] as const;
const DASHBOARD_KPI_CARDS = ["cpu", "memory", "swap", "disk"] as const;
const DASHBOARD_USER_ROWS = [
	{ id: "total", labelWidth: "w-16", valWidth: "w-10", pill: false },
	{ id: "active", labelWidth: "w-14", valWidth: "w-10", pill: true },
	{ id: "online", labelWidth: "w-16", valWidth: "w-10", pill: true },
	{ id: "onhold", labelWidth: "w-20", valWidth: "w-8", pill: false },
	{ id: "limited", labelWidth: "w-18", valWidth: "w-8", pill: false },
	{ id: "expired", labelWidth: "w-20", valWidth: "w-8", pill: false },
] as const;

const glassCardClass =
	"relative overflow-hidden rounded-[20px] border border-panel-border bg-panel-surface/85 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_10px_28px_-8px_rgba(0,0,0,0.14)] shimmer-box";

export const PageLoadingSkeleton: FC<PageLoadingSkeletonProps> = ({
	variant = "entity",
	canSeeGlobal = true,
	isRTL = false,
	className,
}) => {
	if (variant === "dashboard") {
		return (
			<div
				dir={isRTL ? "rtl" : "ltr"}
				aria-busy="true"
				aria-live="polite"
				className={cn("flex w-full flex-col gap-4 min-[769px]:gap-5", className)}
			>
				<div className={cn(glassCardClass, "p-4 min-[769px]:px-6 min-[769px]:py-5")}>
					<div className="flex flex-col gap-4 min-[769px]:flex-row min-[769px]:items-center min-[769px]:justify-between">
						<div className="flex flex-col gap-2.5">
							<div className="flex items-center gap-3">
								<Skeleton className="size-10 rounded-[12px] page-skeleton" />
								<div className="flex flex-col gap-1.5">
									<Skeleton className="h-5 w-40 min-[769px]:w-48 rounded-md page-skeleton" />
									<div className="flex flex-wrap items-center gap-2">
										<Skeleton className="h-5 w-20 rounded-full page-skeleton" />
										<Skeleton className="h-5 w-24 rounded-full page-skeleton" />
										<Skeleton className="h-5 w-16 rounded-full page-skeleton" />
									</div>
								</div>
							</div>
						</div>
						<div className="grid grid-cols-3 gap-2 min-[769px]:flex min-[769px]:items-center min-[769px]:gap-2.5">
							<Skeleton className="h-9 w-full min-[769px]:w-28 rounded-[12px] page-skeleton" />
							<Skeleton className="h-9 w-full min-[769px]:w-26 rounded-[12px] page-skeleton" />
							<Skeleton className="h-9 w-full min-[769px]:w-28 rounded-[12px] page-skeleton" />
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-4 min-[769px]:gap-4">
					{DASHBOARD_KPI_CARDS.map((cardKey, index) => (
						<div
							key={cardKey}
							className={cn(glassCardClass, "flex flex-col justify-between p-4 min-[769px]:p-5")}
						>
							<div>
								<div className="mb-3.5 flex items-center justify-between gap-2">
									<div className="flex items-center gap-2.5">
										<Skeleton className="size-9 rounded-[10px] page-skeleton" />
										<Skeleton className="h-4 w-24 rounded-md page-skeleton" />
									</div>
									{index < 2 && <Skeleton className="h-6 w-16 rounded-full page-skeleton" />}
								</div>
								<div className="mb-2 flex items-baseline gap-2">
									<Skeleton className="h-7 w-20 rounded-md page-skeleton" />
									<Skeleton className="h-4 w-16 rounded-md page-skeleton" />
								</div>
							</div>
							<div className="mt-3 flex flex-col gap-2">
								<Skeleton className="h-1.5 w-full rounded-full page-skeleton" />
								<div className="flex items-center justify-between pt-1">
									<Skeleton className="h-3.5 w-20 rounded-xs page-skeleton" />
									<Skeleton className="h-3.5 w-16 rounded-xs page-skeleton" />
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="grid grid-cols-1 gap-3 min-[769px]:grid-cols-2 min-[769px]:gap-4">
					{["bandwidth", "uptime"].map((sectionKey, idx) => (
						<div key={sectionKey} className={glassCardClass}>
							<div className="flex items-center justify-between border-b border-panel-border px-4 py-3.5 min-[769px]:px-6">
								<div className="flex items-center gap-2.5">
									<Skeleton className="size-7 rounded-[8px] page-skeleton" />
									<Skeleton className="h-4 w-28 rounded-md page-skeleton" />
								</div>
								{idx === 0 && <Skeleton className="h-6 w-24 rounded-full page-skeleton" />}
							</div>
							<div className="grid grid-cols-1 gap-3 p-4 min-[480px]:grid-cols-2 min-[769px]:p-6">
								<div className="flex flex-col gap-2 rounded-[14px] border border-panel-border bg-panel-elevated/55 p-3.5">
									<Skeleton className="h-3.5 w-24 rounded-xs page-skeleton" />
									<Skeleton className="h-6 w-28 rounded-md page-skeleton" />
								</div>
								<div className="flex flex-col gap-2 rounded-[14px] border border-panel-border bg-panel-elevated/55 p-3.5">
									<Skeleton className="h-3.5 w-24 rounded-xs page-skeleton" />
									<Skeleton className="h-6 w-28 rounded-md page-skeleton" />
								</div>
							</div>
						</div>
					))}
				</div>

				<div className={glassCardClass}>
					<div className="flex items-center justify-between border-b border-panel-border px-4 py-3.5 min-[769px]:px-6">
						<div className="flex items-center gap-2.5">
							<Skeleton className="size-7 rounded-[8px] page-skeleton" />
							<Skeleton className="h-4 w-32 rounded-md page-skeleton" />
						</div>
						<Skeleton className="h-6 w-20 rounded-full page-skeleton" />
					</div>
					<div className="grid grid-cols-1 gap-3 p-4 min-[640px]:grid-cols-2 min-[769px]:gap-4 min-[769px]:p-6">
						{["panel-cpu", "panel-ram"].map((itemKey) => (
							<div
								key={itemKey}
								className="flex flex-col justify-between rounded-[16px] border border-panel-border bg-panel-elevated/45 p-4"
							>
								<div className="mb-3 flex items-center justify-between">
									<div className="flex items-center gap-2.5">
										<Skeleton className="size-8 rounded-[9px] page-skeleton" />
										<Skeleton className="h-4 w-28 rounded-md page-skeleton" />
									</div>
								</div>
								<Skeleton className="mb-3 h-6 w-24 rounded-md page-skeleton" />
								<Skeleton className="h-1.5 w-full rounded-full page-skeleton" />
							</div>
						))}
					</div>
				</div>

				<div
					className={cn(
						"grid grid-cols-1 gap-3 min-[769px]:gap-4",
						canSeeGlobal && "xl:grid-cols-2",
					)}
				>
					<div className={glassCardClass}>
						<div className="flex items-center justify-between border-b border-panel-border px-4 py-3.5 min-[769px]:px-6">
							<div className="flex items-center gap-2.5">
								<Skeleton className="size-7 rounded-[8px] page-skeleton" />
								<Skeleton className="h-4 w-24 rounded-md page-skeleton" />
							</div>
							<Skeleton className="h-7 w-32 rounded-[10px] page-skeleton" />
						</div>
						<div className="flex flex-col divide-y divide-panel-border px-4 py-2 min-[769px]:px-6">
							{DASHBOARD_USER_ROWS.map((row) => (
								<div key={row.id} className="flex items-center justify-between py-3">
									<div className="flex items-center gap-2.5">
										<Skeleton className="size-2 rounded-full page-skeleton" />
										<Skeleton className={cn("h-3.5 rounded-xs page-skeleton", row.labelWidth)} />
										{row.pill && <Skeleton className="h-4 w-10 rounded-full page-skeleton" />}
									</div>
									<Skeleton className={cn("h-4 rounded-xs page-skeleton", row.valWidth)} />
								</div>
							))}
						</div>
					</div>

					{canSeeGlobal && (
						<div className={glassCardClass}>
							<div className="flex items-center justify-between border-b border-panel-border px-4 py-3.5 min-[769px]:px-6">
								<div className="flex items-center gap-2.5">
									<Skeleton className="size-7 rounded-[8px] page-skeleton" />
									<Skeleton className="h-4 w-24 rounded-md page-skeleton" />
								</div>
							</div>
							<div className="flex flex-col divide-y divide-panel-border px-4 py-2 min-[769px]:px-6">
								{["total", "full", "sudo", "standard", "top"].map((rowKey) => (
									<div key={rowKey} className="flex items-center justify-between py-3">
										<div className="flex items-center gap-2.5">
											<Skeleton className="size-2 rounded-full page-skeleton" />
											<Skeleton className="h-3.5 w-24 rounded-xs page-skeleton" />
										</div>
										<Skeleton className="h-4 w-12 rounded-xs page-skeleton" />
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			aria-busy="true"
			aria-live="polite"
			className={cn("flex w-full flex-col items-stretch gap-4 min-[769px]:gap-5", className)}
		>
			<div className={cn(glassCardClass, "flex flex-col gap-4 p-4 min-[769px]:p-5")}>
				<div className="flex flex-col items-stretch justify-between gap-4 xl:flex-row xl:items-center">
					<div className="flex flex-col items-start gap-2">
						<Skeleton className="h-5 w-40 min-[769px]:w-52 rounded-md page-skeleton" />
						<div className="flex flex-row items-center gap-2">
							<Skeleton className="h-5 w-20 rounded-full page-skeleton" />
							<Skeleton className="h-5 w-24 rounded-full page-skeleton" />
							<Skeleton className="h-5 w-20 rounded-full page-skeleton" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-2 min-[769px]:grid-cols-4">
						{["act-1", "act-2", "act-3", "act-4"].map((id) => (
							<Skeleton
								key={id}
								className="h-9 w-full min-[769px]:w-28 rounded-[12px] page-skeleton"
							/>
						))}
					</div>
				</div>
				<div className="h-px w-full bg-panel-border/60" />
				<div className="grid grid-cols-1 gap-2 min-[769px]:grid-cols-4">
					{["flt-1", "flt-2", "flt-3", "flt-4"].map((id) => (
						<Skeleton key={id} className="h-9 w-full rounded-[12px] page-skeleton" />
					))}
				</div>
			</div>

			<div className={glassCardClass}>
				<div className="hidden gap-4 border-b border-panel-border px-5 py-3.5 min-[769px]:flex">
					{["col-1", "col-2", "col-3", "col-4", "col-5", "col-6", "col-7"].map((id, index) => (
						<Skeleton
							key={id}
							className={cn(
								"h-3 rounded-xs page-skeleton",
								index === 0 ? "w-5" : index === 1 ? "w-28" : index === 6 ? "w-12" : "w-20",
							)}
						/>
					))}
				</div>
				{ENTITY_ROWS.map((row, index) => (
					<div
						key={row}
						className={cn(
							"border-panel-border px-4 py-4 min-[769px]:px-5 min-[769px]:py-4.5",
							index === ENTITY_ROWS.length - 1 ? "border-b-0" : "border-b",
						)}
					>
						<div className="hidden items-center gap-4 min-[769px]:flex">
							<Skeleton className="size-4 rounded-xs page-skeleton" />
							<Skeleton className="h-4 w-28 rounded-xs page-skeleton" />
							<Skeleton className="h-5 w-20 rounded-full page-skeleton" />
							<Skeleton className="h-4 w-32 rounded-xs page-skeleton" />
							<Skeleton className="h-4 w-24 rounded-xs page-skeleton" />
							<Skeleton className="h-4 max-w-60 flex-1 rounded-xs page-skeleton" />
							<Skeleton className="h-7 w-28 rounded-[10px] page-skeleton" />
							<Skeleton className="h-5 w-10 rounded-xs page-skeleton" />
						</div>
						<div className="flex flex-col gap-3 min-[769px]:hidden">
							<div className="flex items-center justify-between gap-3">
								<div className="flex min-w-0 items-center gap-2.5">
									<Skeleton className="size-4 rounded-xs page-skeleton" />
									<Skeleton className="h-4 w-32 rounded-xs page-skeleton" />
								</div>
								<Skeleton className="h-5 w-20 rounded-full page-skeleton" />
							</div>
							<div className="flex justify-between gap-3">
								<Skeleton className="h-3.5 w-24 rounded-xs page-skeleton" />
								<Skeleton className="h-3.5 w-28 rounded-xs page-skeleton" />
							</div>
							<Skeleton className="h-7 w-full rounded-[10px] page-skeleton" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

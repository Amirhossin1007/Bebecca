import { Skeleton } from "components/ui/skeleton";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

import { cn } from "lib/cn";
import type { FC } from "react";

const skeletonRows = ["one", "two", "three", "four", "five", "six"];

export const PageLoadingSkeleton: FC = () => (
	<div className="flex flex-col gap-4 md:gap-5 items-stretch w-full">
		<div className="flex flex-col gap-4 border border-panel-border! rounded-[20px] bg-panel-surface p-4 md:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),_0_8px_24px_-6px_rgba(0,0,0,0.14)]">
			<div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
				<div className="flex flex-col items-start gap-2">
					<Skeleton className="h-[20px] w-[150px] md:w-[210px] page-skeleton" />
					<div className="flex flex-row items-center gap-2">
						{["total", "active", "pending"].map((id, index) => (
							<Skeleton key={id} style={{ width: `${index === 1 ? 94 : 78}px` }} className="h-[22px] rounded-full page-skeleton" />
						))}
					</div>
				</div>
				<div className="grid grid-cols-2 md:grid-cols-4 gap-2">
					{["one", "two", "three", "four"].map((id) => (
						<Skeleton key={id} className="h-[36px] w-full md:w-[118px] rounded-md page-skeleton" />
					))}
				</div>
			</div>
			<hr className="w-full border-0 border-b border-panel-border! opacity-60" />
			<div className="grid grid-cols-1 md:grid-cols-4 gap-2">
				<Skeleton className="h-[36px] w-full rounded-md page-skeleton" />
				{["filter-one", "filter-two", "filter-three"].map((id) => (
					<Skeleton key={id} className="h-[36px] w-full rounded-md page-skeleton" />
				))}
			</div>
		</div>

		<div className="border border-panel-border! rounded-[20px] bg-panel-surface overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),_0_8px_24px_-6px_rgba(0,0,0,0.14)]">
			<div className="hidden md:flex gap-4 px-4 md:px-5 py-3 border-b border-panel-border!">
				{["select", "primary", "status", "metadata", "usage", "details", "actions"].map(
					(id, index) => (
						<Skeleton key={id} className={cn("h-[12px] rounded-xs", index === 0 ? "w-[18px]" : (index === 1 ? "w-[100px]" : (index === 6 ? "w-[42px]" : "w-[76px]")), "page-skeleton")} />
					),
				)}
			</div>
			{skeletonRows.map((row, index) => (
				<div key={row} className={cn("px-4 md:px-5 py-4 md:py-5 border-panel-border!", index === skeletonRows.length - 1 ? "border-b-0" : "border-b")}>
					<div className="hidden md:flex items-center gap-4">
						<Skeleton className="h-[16px] w-[16px] page-skeleton" />
						<Skeleton className="h-[16px] w-[112px] page-skeleton" />
						<Skeleton className="h-[22px] w-[82px] rounded-full page-skeleton" />
						<Skeleton className="h-[16px] w-[132px] page-skeleton" />
						<Skeleton className="h-[16px] w-[104px] page-skeleton" />
						<Skeleton className="h-[16px] flex-1 max-w-[240px] page-skeleton" />
						<Skeleton className="h-[28px] w-[120px] page-skeleton" />
						<Skeleton className="h-[18px] w-[42px] page-skeleton" />
					</div>
					<div className="flex-col flex md:hidden gap-3">
						<div className="flex items-center justify-between gap-3">
							<div className="flex flex-row items-center gap-2 min-w-0!">
								<Skeleton className="h-[16px] w-[16px] page-skeleton" />
								<Skeleton className="h-[16px] w-[130px] page-skeleton" />
							</div>
							<Skeleton className="h-[22px] w-[82px] rounded-full page-skeleton" />
						</div>
						<div className="flex justify-between gap-3">
							<Skeleton className="h-[14px] w-[90px] page-skeleton" />
							<Skeleton className="h-[14px] w-[118px] page-skeleton" />
						</div>
						<Skeleton className="h-[28px] w-full rounded-md page-skeleton" />
					</div>
				</div>
			))}
		</div>
	</div>
);

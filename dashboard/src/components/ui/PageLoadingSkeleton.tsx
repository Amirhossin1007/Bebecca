import logoUrl from "assets/logo.svg";
import { Skeleton } from "components/ui/skeleton";
import { cn } from "lib/cn";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

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

export const PanelLoadingSkeleton: FC = () => {
	const { i18n } = useTranslation();
	const [isMobileScreen, setIsMobileScreen] = useState(() => {
		if (typeof window === "undefined") return false;
		return window.innerWidth < 769;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		const mq = window.matchMedia("(max-width: 768.98px)");
		const update = () => setIsMobileScreen(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);

	const isRTL = i18n
		? i18n.dir(i18n.language) === "rtl"
		: typeof document !== "undefined"
			? document.documentElement.dir === "rtl" ||
				document.documentElement.lang === "fa" ||
				(typeof localStorage !== "undefined" &&
					localStorage.getItem("i18nextLng") === "fa")
			: true;

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			className="relative w-full h-[100dvh] md:h-screen min-h-[100dvh] md:min-h-screen max-h-[100dvh] md:max-h-screen bg-panel-app overflow-hidden"
		>
			{!isMobileScreen && (
				<aside
					style={{
						top: "12px",
						bottom: "12px",
						insetInlineStart: "12px",
						width: "var(--rb-sidebar-width, 240px)",
						height: "calc(100vh - 24px)",
						maxHeight: "calc(100vh - 24px)",
					}}
					className="hidden md:flex fixed z-[200] flex-col justify-between p-3 bg-panel-surface border border-panel-border! rounded-[20px] shadow-sm overflow-hidden"
				>
					<div className="flex flex-col h-full justify-between">
						<div>
							<div className="flex items-center justify-between px-2.5 py-2.5 mb-2 min-h-[48px] border-b border-panel-border! shrink-0">
								<div className="flex items-center gap-2.5">
									<img
										src={logoUrl}
										alt="Rebecca"
										className="w-7 h-7 shrink-0"
									/>
									<Skeleton className="w-[78px] h-[18px] rounded-md" />
								</div>
							</div>
							<div className="flex flex-col gap-2 py-1 px-1">
								<Skeleton className="w-16 h-3 rounded-xs mb-1" />
								{Array.from({ length: 6 }).map((_, i) => (
									<Skeleton key={i} className="w-full h-9 rounded-[10px]" />
								))}
							</div>
						</div>
						<div className="pt-2 border-t border-panel-border! flex flex-col gap-2 px-1">
							<Skeleton className="w-full h-9 rounded-[10px]" />
							<Skeleton className="w-full h-9 rounded-[10px]" />
						</div>
					</div>
				</aside>
			)}

			<main
				style={{
					marginInlineStart: !isMobileScreen ? "calc(var(--rb-sidebar-width, 240px) + 24px)" : undefined,
					marginInlineEnd: !isMobileScreen ? "12px" : undefined,
				}}
				className="flex flex-col h-full overflow-hidden p-3 md:py-3 md:px-0"
			>
				<header className="h-14 shrink-0 flex items-center justify-between px-4 mb-3 rounded-[16px] bg-panel-surface border border-panel-border! shadow-sm">
					<div className="flex items-center gap-3">
						<Skeleton className="w-8 h-8 rounded-full" />
						<Skeleton className="w-32 h-4 rounded-md" />
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="w-9 h-9 rounded-full" />
						<Skeleton className="w-9 h-9 rounded-full" />
						<Skeleton className="w-9 h-9 rounded-full" />
					</div>
				</header>
				<div className="flex-1 overflow-auto rounded-[20px] border border-panel-border! bg-panel-surface p-4 md:p-6 shadow-sm">
					<PageLoadingSkeleton />
				</div>
			</main>
		</div>
	);
};

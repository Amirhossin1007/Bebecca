import logoUrl from "assets/logo.svg";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export const PageLoadingSkeleton: FC = () => (
	<div
		className="w-full h-[calc(100dvh-162px-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-24px)] max-h-[calc(100dvh-162px-env(safe-area-inset-bottom,0px))] md:max-h-[calc(100vh-24px)] rounded-[20px] border border-panel-border! bg-panel-surface shadow-xs rb-glass-item animate-pulse"
	/>
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
			className="min-h-dvh max-h-dvh h-dvh md:min-h-screen md:max-h-screen md:h-screen w-full bg-panel-app relative overflow-hidden flex"
			dir={isRTL ? "rtl" : "ltr"}
		>
			{!isMobileScreen && (
				<div
					className={`rb-desktop-sidebar hidden md:flex fixed top-3 bottom-3 w-[var(--rb-sidebar-width,240px)] h-[calc(100vh-24px)] max-h-[calc(100vh-24px)] bg-panel-surface border border-panel-border! rounded-[20px] shadow-xs z-40 flex-col overflow-hidden ${
						isRTL ? "right-3 left-auto" : "left-3 right-auto"
					}`}
				>
					<div className="flex flex-col h-full justify-between p-3">
						<div className="flex items-center justify-between px-2.5 py-2.5 mb-2 min-h-[48px] border-b border-panel-border! shrink-0">
							<div className="flex items-center gap-2.5">
								<img
									src={logoUrl}
									alt="Rebecca"
									className="w-7 h-7 shrink-0"
								/>
								<div className="w-[78px] h-[18px] rounded-md bg-panel-elevated rb-glass-item animate-pulse" />
							</div>
						</div>

						<div className="flex-1 min-h-0 overflow-hidden px-1">
							<div className="flex flex-col gap-2 py-1">
								<div className="mb-1">
									<div className="w-[50px] h-2.5 rounded-xs bg-panel-elevated px-3 mb-1.5 rb-glass-item animate-pulse" />
									<div className="h-9 rounded-[10px] bg-panel-elevated px-2.5 flex items-center justify-between mb-1 border-s-[2.5px] border-s-panel-border-strong! rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-border shrink-0" />
											<div className="w-[60px] h-3.5 rounded-md bg-panel-border" />
										</div>
									</div>

									<div className="h-[34px] rounded-lg px-2.5 flex items-center justify-between mb-1 rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[55px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
										<div className="w-2.5 h-2.5 rounded-xs bg-panel-elevated" />
									</div>

									<div className="ms-4 ps-2.5 my-1 border-s-[1.5px] border-s-panel-border!">
										<div className="h-7 rounded-md px-2 flex items-center mb-1 rb-glass-item animate-pulse">
											<div className="flex items-center gap-2">
												<div className="w-3.5 h-3.5 rounded-xs bg-panel-elevated shrink-0" />
												<div className="w-[65px] h-3 rounded-md bg-panel-elevated" />
											</div>
										</div>
										<div className="h-7 rounded-md px-2 flex items-center rb-glass-item animate-pulse">
											<div className="flex items-center gap-2">
												<div className="w-3.5 h-3.5 rounded-xs bg-panel-elevated shrink-0" />
												<div className="w-[75px] h-3 rounded-md bg-panel-elevated" />
											</div>
										</div>
									</div>

									<div className="h-[34px] rounded-lg px-2.5 flex items-center rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[50px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
									</div>
								</div>

								<div className="mb-1">
									<div className="w-[65px] h-2.5 rounded-xs bg-panel-elevated px-3 mb-1.5 rb-glass-item animate-pulse" />
									<div className="h-[34px] rounded-lg px-2.5 flex items-center mb-1 rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[55px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
									</div>
									<div className="h-[34px] rounded-lg px-2.5 flex items-center mb-1 rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[45px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
									</div>
									<div className="h-[34px] rounded-lg px-2.5 flex items-center rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[60px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
									</div>
								</div>

								<div className="mb-1">
									<div className="w-[70px] h-2.5 rounded-xs bg-panel-elevated px-3 mb-1.5 rb-glass-item animate-pulse" />
									<div className="h-[34px] rounded-lg px-2.5 flex items-center justify-between mb-1 rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[68px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
										<div className="w-2.5 h-2.5 rounded-xs bg-panel-elevated" />
									</div>
									<div className="h-[34px] rounded-lg px-2.5 flex items-center justify-between rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[72px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
										<div className="w-2.5 h-2.5 rounded-xs bg-panel-elevated" />
									</div>
								</div>

								<div>
									<div className="w-[45px] h-2.5 rounded-xs bg-panel-elevated px-3 mb-1.5 rb-glass-item animate-pulse" />
									<div className="h-[34px] rounded-lg px-2.5 flex items-center rb-glass-item animate-pulse">
										<div className="flex items-center gap-2.5">
											<div className="w-[18px] h-[18px] rounded-[4px] bg-panel-elevated shrink-0" />
											<div className="w-[85px] h-3.5 rounded-md bg-panel-elevated" />
										</div>
									</div>
								</div>
							</div>
						</div>

						<div className="w-full h-[52px] rounded-[14px] border border-panel-border! bg-panel-elevated mt-2 shrink-0 rb-glass-item animate-pulse" />
					</div>
				</div>
			)}

			<div
				className={`flex-1 flex flex-col min-w-0 overflow-hidden bg-panel-main relative ${
					isRTL ? "md:me-[calc(var(--rb-sidebar-width,240px)+20px)]" : "md:ms-[calc(var(--rb-sidebar-width,240px)+20px)]"
				}`}
			>
				<div className="relative z-30 shrink-0">
					<header
						className="h-[52px] min-h-[52px] border border-panel-border! rounded-[18px] bg-panel-surface shadow-xs mt-3 mx-3 md:mx-4 flex items-center px-3 md:px-5 justify-between gap-3"
						dir={isRTL ? "rtl" : "ltr"}
					>
						<div className="flex items-center gap-2.5 flex-1 min-w-0 h-full overflow-hidden">
							<div className="w-[34px] h-[34px] min-w-[34px] rounded-full md:rounded-[12px] border border-panel-border! bg-panel-elevated shrink-0 rb-glass-item animate-pulse" />
							<div className="w-px h-4 bg-panel-border mx-0.5 shrink-0 hidden md:block" />
							<div className="hidden md:block w-[85px] h-[18px] rounded-md bg-panel-elevated shrink-0 rb-glass-item animate-pulse" />
						</div>

						<div className="flex items-center gap-1.5 sm:gap-2 shrink-0 h-full">
							<div className="hidden md:block w-[34px] h-[34px] rounded-[12px] border border-panel-border! bg-panel-elevated rb-glass-item animate-pulse" />
							<div className="hidden sm:block w-[72px] h-8 rounded-[12px] border border-panel-border! bg-panel-elevated rb-glass-item animate-pulse" />
							<div className="hidden md:inline-flex items-center justify-center w-auto min-w-[110px] h-[34px] rounded-[12px] border border-panel-border! bg-panel-surface px-2.5 gap-2 rb-glass-item animate-pulse">
								<div className="w-5 h-5 rounded-full bg-panel-elevated shrink-0" />
								<div className="w-16 h-3 rounded-xs bg-panel-elevated" />
							</div>
							<div className="inline-flex md:hidden items-center justify-center w-[34px] h-[34px] rounded-full border border-panel-border! bg-panel-surface rb-glass-item animate-pulse">
								<div className="w-5 h-5 rounded-full bg-panel-elevated shrink-0" />
							</div>
						</div>
					</header>
				</div>

				<div className="flex-1 px-3 md:px-4 pt-3 pb-20 md:pb-3 min-h-0 w-full h-full flex flex-col">
					<div className="w-full h-[calc(100dvh-162px-env(safe-area-inset-bottom,0px))] md:h-[calc(100vh-24px)] max-h-[calc(100dvh-162px-env(safe-area-inset-bottom,0px))] md:max-h-[calc(100vh-24px)] rounded-[20px] border border-panel-border! bg-panel-surface shadow-xs rb-glass-item animate-pulse" />
				</div>
			</div>

			{isMobileScreen && (
				<div
					className="rb-mobile-dock block md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] left-0 right-0 z-50 px-3 pointer-events-none"
				>
					<div className="max-w-[min(440px,calc(100vw-20px))] mx-auto rounded-[24px] border border-panel-border! bg-panel-surface shadow-xl px-2 py-1.5">
						<div
							className="grid grid-cols-5 w-full items-center"
							dir={isRTL ? "rtl" : "ltr"}
						>
							{[
								{ id: "skel-dock-users", w: "w-7", active: false },
								{ id: "skel-dock-admins", w: "w-8", active: false },
								{ id: "skel-dock-dash", w: "w-[38px]", active: true },
								{ id: "skel-dock-account", w: "w-[34px]", active: false },
								{ id: "skel-dock-settings", w: "w-[30px]", active: false },
							].map((item) => (
								<div
									key={item.id}
									className="w-full flex flex-col items-center justify-center py-1 px-1 relative"
								>
									<div
										className={`w-full h-full py-1 flex flex-col items-center justify-center ${
											item.active ? "rounded-[16px] bg-panel-elevated border border-panel-border!" : "border-0"
										} rb-glass-item animate-pulse`}
									>
										<div
											className={`w-[22px] h-[22px] rounded-md ${
												item.active ? "bg-panel-border" : "bg-panel-elevated"
											}`}
										/>
										<div
											className={`${item.w} h-2 rounded-xs mt-1 ${
												item.active ? "bg-panel-border" : "bg-panel-elevated"
											}`}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

import logoUrl from "assets/logo.svg";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { useMediaQuery } from "hooks/useMediaQuery";
import { cn } from "lib/cn";
import { useColorMode } from "lib/color-mode";
import { BellRing, ChevronDown, X } from "lucide-react";
import {
	type FC,
	type MouseEvent as ReactMouseEvent,
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { apiBaseURL } from "service/http";
import type { SponsorAsset } from "service/sponsors";
import {
	DEFAULT_TAB_BY_PATH,
	type GroupNavItem,
	useNavSections,
} from "./layout/navConfig";
import { SponsorCarousel } from "./SponsorCarousel";

export interface AppSidebarProps {
	collapsed: boolean;
	sponsors?: SponsorAsset[];
	sidebarBanners?: SponsorAsset[];
	inDrawer?: boolean;
	onRequestExpand?: () => void;
}

const resolveAssetUrl = (rawUrl?: string): string => {
	if (!rawUrl) return "";
	if (
		rawUrl.startsWith("http://") ||
		rawUrl.startsWith("https://") ||
		rawUrl.startsWith("data:") ||
		rawUrl.startsWith("blob:")
	) {
		return rawUrl;
	}
	if (rawUrl.startsWith("/") && !rawUrl.startsWith("//") && apiBaseURL) {
		const base = apiBaseURL.replace(/\/+$/, "");
		const cleanPath = rawUrl.startsWith("/api") ? rawUrl.slice(4) : rawUrl;
		return `${base}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
	}
	return rawUrl;
};

interface SidebarLogoCarouselProps {
	sponsors?: SponsorAsset[];
	collapsed: boolean;
	inDrawer: boolean;
	colorMode: string;
	isRTL: boolean;
	onNavigateRoot: () => void;
	onRequestExpand?: () => void;
}

const SidebarLogoCarousel: FC<SidebarLogoCarouselProps> = memo(
	function SidebarLogoCarousel({
		sponsors = [],
		collapsed,
		inDrawer,
		colorMode,
		isRTL,
		onNavigateRoot,
		onRequestExpand,
	}) {
		const [activeIndex, setActiveIndex] = useState(0);
		const [isPaused, setIsPaused] = useState(false);

		const items = useMemo(() => {
			const rebeccaItem = {
				id: "rebecca",
				src: logoUrl,
				alt: "Rebecca",
				label: "Rebecca",
				isSponsor: false,
				href: undefined as string | undefined,
			};
			const validSponsors = (sponsors || [])
				.filter((s) =>
					Boolean(
						s?.image_url || (s as unknown as { src?: string })?.src,
					),
				)
				.map((s) => {
					const rawSrc =
						s.image_url || (s as unknown as { src?: string })?.src || "";
					const href =
						s.target_url || (s as unknown as { href?: string })?.href;
					return {
						id: s.id,
						src: resolveAssetUrl(rawSrc),
						alt: s.alt || s.label || "Sponsor",
						label: s.label
							? s.label.charAt(0).toUpperCase() + s.label.slice(1)
							: s.alt || "Sponsor",
						isSponsor: true,
						href,
					};
				});
			if (validSponsors.length === 0) {
				return [rebeccaItem];
			}
			const result: typeof rebeccaItem[] = [];
			for (const sp of validSponsors) {
				result.push(rebeccaItem, sp);
			}
			return result;
		}, [sponsors]);

		useEffect(() => {
			if (activeIndex >= items.length) {
				setActiveIndex(0);
			}
		}, [activeIndex, items.length]);

		useEffect(() => {
			if (isPaused || items.length < 2) return;
			const current = items[activeIndex];
			const delay = current?.isSponsor ? 7000 : 10000;
			const timer = window.setTimeout(() => {
				setActiveIndex((prev) => (prev + 1) % items.length);
			}, delay);
			return () => window.clearTimeout(timer);
		}, [isPaused, items, activeIndex]);

		const currentItem = items[activeIndex] || items[0];

		const handleClick = (e: ReactMouseEvent) => {
			e.stopPropagation();
			if (currentItem.isSponsor && currentItem.href) {
				window.open(currentItem.href, "_blank", "noopener,noreferrer");
			} else {
				onNavigateRoot();
				if (inDrawer && onRequestExpand) {
					onRequestExpand();
				}
			}
		};

		const logoGraphic = (
			<div className="flex size-[30px] shrink-0 items-center justify-center">
				{currentItem.isSponsor ? (
					<img
						src={currentItem.src}
						alt={currentItem.alt}
						draggable={false}
						onDragStart={(e) => e.preventDefault()}
						onContextMenu={(e) => e.preventDefault()}
						className="pointer-events-none size-[30px] rounded-[8px] object-contain select-none [-webkit-user-drag:none]"
					/>
				) : (
					<img
						src={currentItem.src}
						alt="Rebecca"
						draggable={false}
						style={{
							filter:
								colorMode === "dark"
									? "brightness(0) invert(1)"
									: "brightness(0)",
							transition: "filter 0.25s ease",
						}}
						className="pointer-events-none size-[30px] object-contain select-none [-webkit-user-drag:none]"
					/>
				)}
			</div>
		);

		return (
			<button
				type="button"
				title={currentItem.label}
				onClick={handleClick}
				onMouseEnter={() => setIsPaused(true)}
				onMouseLeave={() => setIsPaused(false)}
				className={cn(
					"relative flex h-[34px] min-w-0 flex-1 cursor-pointer items-center overflow-hidden text-start transition-transform duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.98]",
					collapsed ? "justify-center" : "gap-2.5",
				)}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={currentItem.id}
						initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
						animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, y: -10, filter: "blur(2px)" }}
						transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
						className={cn(
							"flex h-[34px] w-full items-center",
							collapsed ? "justify-center" : "gap-2.5",
						)}
					>
						{collapsed ? (
							<Tooltip>
								<TooltipTrigger asChild>{logoGraphic}</TooltipTrigger>
								<TooltipContent
									side={isRTL ? "left" : "right"}
									sideOffset={10}
									className="z-[2200] rounded-[10px] border border-panel-border! bg-panel-surface px-3 py-1.5 text-xs font-semibold text-panel-text shadow-lg"
								>
									{currentItem.label}
								</TooltipContent>
							</Tooltip>
						) : (
							logoGraphic
						)}
						{!collapsed ? (
							<span className="min-w-0 flex-1 truncate pt-0.5 text-[17px] font-extrabold tracking-[-0.02em] text-panel-text">
								{currentItem.label}
							</span>
						) : null}
					</motion.div>
				</AnimatePresence>
			</button>
		);
	},
);

interface CollapsedGroupPopoverProps {
	group: GroupNavItem;
	isGroupActive: boolean;
	isRTL: boolean;
	isItemActive: (url: string) => boolean;
	onNavigate: (url: string, event?: ReactMouseEvent) => void;
}

const CollapsedGroupPopover: FC<CollapsedGroupPopoverProps> = ({
	group,
	isGroupActive,
	isRTL,
	isItemActive,
	onNavigate,
}) => {
	const [open, setOpen] = useState(false);
	const isDesktop = useMediaQuery("(min-width: 769px)");
	const closeTimeoutRef = useRef<number | null>(null);
	const GroupIcon = group.icon;
	const visibleSubs = group.subItems.filter((sub) => sub.visible);

	const clearCloseTimer = () => {
		if (closeTimeoutRef.current !== null) {
			window.clearTimeout(closeTimeoutRef.current);
			closeTimeoutRef.current = null;
		}
	};

	const handleMouseEnter = () => {
		if (!isDesktop) return;
		clearCloseTimer();
		setOpen(true);
	};

	const handleMouseLeave = () => {
		if (!isDesktop) return;
		clearCloseTimer();
		closeTimeoutRef.current = window.setTimeout(() => {
			setOpen(false);
		}, 110);
	};

	useEffect(() => {
		return () => {
			if (closeTimeoutRef.current !== null) {
				window.clearTimeout(closeTimeoutRef.current);
			}
		};
	}, []);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label={group.title}
					onMouseEnter={handleMouseEnter}
					onMouseLeave={handleMouseLeave}
					onClick={() => {
						if (!isDesktop) {
							setOpen((prev) => !prev);
						} else if (visibleSubs[0]?.url) {
							onNavigate(visibleSubs[0].url);
						}
					}}
					className={cn(
						"relative flex h-[38px] w-full cursor-pointer items-center justify-center rounded-[12px] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.96] md:hover:bg-panel-elevated",
						isGroupActive
							? "bg-panel-elevated text-panel-accent font-bold"
							: "bg-transparent text-panel-text-secondary md:hover:text-panel-text",
					)}
				>
					{isGroupActive ? (
						<span className="pointer-events-none absolute inset-s-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-panel-accent" />
					) : null}
					<GroupIcon className="size-[18px] shrink-0" />
				</button>
			</PopoverTrigger>
			<PopoverContent
				dir={isRTL ? "rtl" : "ltr"}
				side={isRTL ? "left" : "right"}
				align="start"
				sideOffset={10}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onOpenAutoFocus={(e) => e.preventDefault()}
				className="z-[2200] w-auto min-w-[196px]! rounded-[16px] border border-panel-border! bg-panel-surface p-1.5 text-panel-text shadow-[0_14px_34px_rgba(0,0,0,0.28)] select-none"
			>
				<div className="mb-1 border-b border-panel-border! px-2.5 pt-1 pb-1.5 text-[11px] font-bold tracking-wider uppercase text-panel-text-muted">
					{group.title}
				</div>
				<div className="flex flex-col gap-0.5">
					{visibleSubs.map((sub) => {
						const subActive = isItemActive(sub.url);
						const SubIcon = sub.icon;
						return (
							<NavLink
								key={sub.id}
								to={sub.url}
								onClick={(e) => {
									setOpen(false);
									onNavigate(sub.url, e);
								}}
								className={cn(
									"relative flex h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 text-xs no-underline transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.98] md:hover:bg-panel-elevated",
									subActive
										? "bg-panel-elevated font-bold text-panel-accent"
										: "bg-transparent font-medium text-panel-text-secondary md:hover:text-panel-text",
								)}
							>
								<SubIcon className="size-4 shrink-0" />
								<span className="truncate">{sub.title}</span>
							</NavLink>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
};

interface SidebarBannerSectionProps {
	banners: SponsorAsset[];
	collapsed: boolean;
	inDrawer: boolean;
}

const SidebarBannerSection: FC<SidebarBannerSectionProps> = ({
	banners,
	collapsed,
	inDrawer,
}) => {
	if (collapsed || banners.length === 0) return null;

	return (
		<div
			className={cn(
				"w-full shrink-0 border-t border-panel-border! pt-2.5",
				inDrawer
					? "mx-auto max-w-[min(220px,calc(100%-48px))] pb-[calc(env(safe-area-inset-bottom,0px)+8px)]"
					: "pb-0",
			)}
		>
			<SponsorCarousel
				items={banners.map((asset) => ({
					id: asset.id,
					src: resolveAssetUrl(asset.image_url),
					alt: asset.alt || asset.label || "Sponsor",
					href: asset.target_url,
					label: asset.label,
					isSponsor: true,
				}))}
				variant="sidebar"
				animateIn={false}
			/>
		</div>
	);
};

export const AppSidebar: FC<AppSidebarProps> = memo(function AppSidebar({
	collapsed,
	sponsors = [],
	sidebarBanners = [],
	inDrawer = false,
	onRequestExpand,
}) {
	const { t, i18n } = useTranslation();
	const location = useLocation();
	const navigate = useNavigate();
	const { colorMode } = useColorMode();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const { navSections } = useNavSections();
	const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
		users_hub: true,
	});

	const handleNavigate = useCallback(
		(url: string, event?: ReactMouseEvent) => {
			event?.preventDefault();
			const defaultTab = DEFAULT_TAB_BY_PATH[url];
			const normalized = url.startsWith("/") ? url : `/${url}`;
			navigate(defaultTab ? `${normalized}#${defaultTab}` : normalized);
			if (inDrawer && onRequestExpand) {
				onRequestExpand();
			}
		},
		[inDrawer, navigate, onRequestExpand],
	);

	useEffect(() => {
		const path = location.pathname;
		if (path === "/users" || path === "/groups" || path === "/bulk-actions") {
			setOpenGroups((prev) => ({ ...prev, users_hub: true }));
		} else if (
			path.startsWith("/xray-logs") ||
			path.startsWith("/errors") ||
			path.startsWith("/access-insights") ||
			path.startsWith("/recent-actions")
		) {
			setOpenGroups((prev) => ({ ...prev, observability: true }));
		} else if (
			path.startsWith("/xray-settings") ||
			path.startsWith("/haproxy")
		) {
			setOpenGroups((prev) => ({ ...prev, core_routing: true }));
		} else if (
			path.startsWith("/settings") ||
			path.startsWith("/notifications") ||
			path.startsWith("/placeholders") ||
			path.startsWith("/phpmyadmin") ||
			path.startsWith("/external-apps")
		) {
			setOpenGroups((prev) => ({ ...prev, system_tools: true }));
		}
	}, [location.pathname]);

	const dynamicSidebarWidth = useMemo(() => {
		let maxLen = 0;
		for (const section of navSections) {
			for (const item of section.items) {
				if (item.title && item.title.length > maxLen) {
					maxLen = item.title.length;
				}
				if (item.type === "group") {
					for (const sub of item.subItems) {
						if (sub.title && sub.title.length > maxLen) {
							maxLen = sub.title.length;
						}
					}
				}
			}
		}
		if (maxLen > 20) {
			return Math.min(288, Math.round(240 + (maxLen - 20) * 5));
		}
		return 240;
	}, [navSections]);

	useEffect(() => {
		if (typeof document !== "undefined") {
			document.documentElement.style.setProperty(
				"--rb-sidebar-width",
				`${dynamicSidebarWidth}px`,
			);
		}
	}, [dynamicSidebarWidth]);

	const isItemActive = useCallback(
		(url: string) =>
			location.pathname === url ||
			(url !== "/" && location.pathname.startsWith(url)),
		[location.pathname],
	);

	return (
		<TooltipProvider delayDuration={180}>
			<aside
				dir={isRTL ? "rtl" : "ltr"}
				data-dir={isRTL ? "rtl" : "ltr"}
				data-collapsed={collapsed ? "true" : "false"}
				style={{
					width: inDrawer
						? "100%"
						: collapsed
							? "68px"
							: `var(--rb-sidebar-width, ${dynamicSidebarWidth}px)`,
					...(inDrawer ? {} : { [isRTL ? "right" : "left"]: 12 }),
				}}
				className={cn(
					"flex shrink-0 overflow-hidden bg-panel-surface select-none [touch-action:manipulation]",
					inDrawer
						? "relative h-full max-h-full w-full"
						: "fixed top-3 z-[200] h-[calc(100dvh-24px)] max-h-[calc(100dvh-24px)] rounded-[20px] border border-panel-border! shadow-[0_1px_2px_rgba(0,0,0,0.03),inset_0_1px_0_0_rgba(255,255,255,0.7)] transition-[width] duration-[260ms] ease-[cubic-bezier(0.16,1,0.3,1)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]",
				)}
			>
				<div
					className={cn(
						"flex h-full min-h-0 w-full flex-col justify-between",
						collapsed ? "p-2" : "p-3",
					)}
				>
					<div className="mb-2 flex min-h-[48px] items-center justify-between border-b border-panel-border! px-2.5 py-2.5">
						<SidebarLogoCarousel
							sponsors={sponsors}
							collapsed={collapsed}
							inDrawer={inDrawer}
							colorMode={colorMode}
							isRTL={isRTL}
							onNavigateRoot={() => navigate("/")}
							onRequestExpand={onRequestExpand}
						/>

						{inDrawer && onRequestExpand ? (
							<button
								type="button"
								data-drawer-close="true"
								aria-label={t("cancel", "Close")}
								onClick={onRequestExpand}
								className="inline-flex size-9 min-w-9 items-center justify-center rounded-full border border-panel-border! bg-panel-elevated/60 text-panel-text-secondary transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none active:scale-[0.92] min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text"
							>
								<X className="size-4" />
							</button>
						) : null}
					</div>

					<div
						dir={isRTL ? "rtl" : "ltr"}
						className={cn(
							"rb-sidebar-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
							collapsed ? "px-0" : "px-1",
						)}
					>
						<div className="flex flex-col gap-2 py-1">
							{navSections.map((section, secIdx) => {
								const visibleItems = section.items.filter(
									(item) => item.visible,
								);
								if (visibleItems.length === 0) return null;

								return (
									<div key={section.id} data-nav-section={section.id}>
										{secIdx > 0 && collapsed ? (
											<div className="mx-2 my-1.5 h-px bg-panel-border opacity-60 transition-opacity duration-200" />
										) : null}

										<div
											className={cn(
												"pointer-events-none overflow-hidden whitespace-nowrap transition-[max-height,opacity,margin] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]",
												collapsed
													? "mb-0 mt-0 max-h-0 opacity-0"
													: cn(
															"mb-1 max-h-[26px] opacity-100",
															secIdx === 0 ? "mt-0" : "mt-1.5",
														),
											)}
										>
											<span className="block truncate px-2.5 text-[10.5px] font-bold tracking-[0.06em] uppercase text-panel-text-muted">
												{section.title}
											</span>
										</div>

										<div className="flex flex-col gap-0.5">
											{visibleItems.map((item) => {
												if (item.type === "direct") {
													const isActive = isItemActive(item.url);
													const ItemIcon = item.icon;
													const showBadge = Boolean(item.badge);

													const directLink = (
														<NavLink
															to={item.url}
															onClick={(e) => handleNavigate(item.url, e)}
															className={cn(
																"relative flex h-[38px] w-full items-center overflow-hidden rounded-[12px] text-[13px] no-underline transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.98] md:hover:bg-panel-elevated",
																collapsed
																	? "justify-center px-0"
																	: "justify-start gap-2.5 px-2.5",
																isActive
																	? "bg-panel-elevated font-bold text-panel-accent"
																	: "bg-transparent font-medium text-panel-text-secondary md:hover:text-panel-text",
															)}
														>
															{isActive ? (
																<span className="pointer-events-none absolute inset-s-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-panel-accent" />
															) : null}

															<span className="relative inline-flex size-[18px] shrink-0 items-center justify-center">
																<ItemIcon className="size-[18px]" />
																{showBadge && collapsed ? (
																	<span className="absolute -top-1 -end-1 size-2 rounded-full border-[1.5px] border-panel-surface bg-panel-accent" />
																) : null}
															</span>

															{!collapsed ? (
																<span className="flex min-w-0 flex-1 items-center justify-between gap-2 overflow-hidden whitespace-nowrap">
																	<span className="truncate">{item.title}</span>
																	{showBadge ? (
																		<span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-panel-accent text-white">
																			<BellRing className="size-2.5" />
																		</span>
																	) : null}
																</span>
															) : null}
														</NavLink>
													);

													if (collapsed) {
														return (
															<Tooltip key={item.id}>
																<TooltipTrigger asChild>
																	{directLink}
																</TooltipTrigger>
																<TooltipContent
																	side={isRTL ? "left" : "right"}
																	sideOffset={10}
																	className="z-[2200] rounded-[10px] border border-panel-border! bg-panel-surface px-3 py-1.5 text-xs font-semibold text-panel-text shadow-lg"
																>
																	{item.title}
																</TooltipContent>
															</Tooltip>
														);
													}

													return <div key={item.id}>{directLink}</div>;
												}

												const visibleSubs = item.subItems.filter(
													(sub) => sub.visible,
												);
												if (visibleSubs.length === 0) return null;

												const isGroupActive = visibleSubs.some((sub) =>
													isItemActive(sub.url),
												);
												const isOpen = Boolean(openGroups[item.id]);
												const GroupIcon = item.icon;

												if (collapsed) {
													return (
														<CollapsedGroupPopover
															key={item.id}
															group={item}
															isGroupActive={isGroupActive}
															isRTL={isRTL}
															isItemActive={isItemActive}
															onNavigate={handleNavigate}
														/>
													);
												}

												return (
													<div key={item.id} data-nav-group={item.id}>
														<button
															type="button"
															aria-expanded={isOpen}
															onClick={() =>
																setOpenGroups((prev) => ({
																	...prev,
																	[item.id]: !isOpen,
																}))
															}
															className={cn(
																"relative flex h-[38px] w-full cursor-pointer items-center justify-between gap-2.5 overflow-hidden rounded-[12px] px-2.5 text-[13px] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.98] md:hover:bg-panel-elevated",
																isGroupActive && !isOpen
																	? "bg-panel-elevated font-bold text-panel-accent"
																	: isGroupActive
																		? "bg-transparent font-bold text-panel-text"
																		: "bg-transparent font-medium text-panel-text-secondary md:hover:text-panel-text",
															)}
														>
															{isGroupActive && !isOpen ? (
																<span className="pointer-events-none absolute inset-s-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-panel-accent" />
															) : null}

															<span className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
																<span
																	className={cn(
																		"inline-flex size-[18px] shrink-0 items-center justify-center",
																		isGroupActive && "text-panel-accent",
																	)}
																>
																	<GroupIcon className="size-[18px]" />
																</span>
																<span className="truncate">{item.title}</span>
															</span>

															<ChevronDown
																className={cn(
																	"size-3.5 shrink-0 text-panel-text-muted transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
																	isOpen
																		? "rotate-0"
																		: isRTL
																			? "rotate-90"
																			: "-rotate-90",
																)}
															/>
														</button>

														<AnimatePresence initial={false}>
															{isOpen ? (
																<motion.div
																	key="subitems"
																	initial={{ height: 0, opacity: 0 }}
																	animate={{ height: "auto", opacity: 1 }}
																	exit={{ height: 0, opacity: 0 }}
																	transition={{
																		duration: 0.22,
																		ease: [0.16, 1, 0.3, 1],
																	}}
																	className="overflow-hidden"
																>
																	<div className="ms-[19px] mt-1 mb-0.5 flex flex-col gap-0.5 border-s border-panel-border! ps-2.5">
																		{visibleSubs.map((sub) => {
																			const subActive = isItemActive(sub.url);
																			const SubIcon = sub.icon;

																			return (
																				<NavLink
																					key={sub.id}
																					to={sub.url}
																					onClick={(e) =>
																						handleNavigate(sub.url, e)
																					}
																					className={cn(
																						"relative flex h-[34px] items-center gap-2.5 rounded-[10px] px-2.5 text-xs no-underline transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none select-none active:scale-[0.98] md:hover:bg-panel-elevated",
																						subActive
																							? "bg-panel-elevated font-bold text-panel-accent"
																							: "bg-transparent font-medium text-panel-text-secondary md:hover:text-panel-text",
																					)}
																				>
																					{subActive ? (
																						<span className="pointer-events-none absolute -inset-s-[11.5px] top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-panel-accent" />
																					) : null}
																					<SubIcon className="size-4 shrink-0" />
																					<span className="truncate">
																						{sub.title}
																					</span>
																				</NavLink>
																			);
																		})}
																	</div>
																</motion.div>
															) : null}
														</AnimatePresence>
													</div>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<SidebarBannerSection
						banners={sidebarBanners}
						collapsed={collapsed}
						inDrawer={inDrawer}
					/>
				</div>
			</aside>
		</TooltipProvider>
	);
});


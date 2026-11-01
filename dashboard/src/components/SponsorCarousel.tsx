import { motion } from "framer-motion";
import {
	type FC,
	forwardRef,
	memo,
	type ReactNode,
	useEffect,
	useMemo,
	useState,
} from "react";

export interface SponsorCarouselItem {
	id: string;
	src: string;
	alt: string;
	href?: string;
	label?: string;
	isSponsor?: boolean;
}

interface SponsorCarouselProps {
	items: SponsorCarouselItem[];
	variant: "logo" | "banner" | "sidebar";
	collapsed?: boolean;
	animateIn?: boolean;
}

interface SponsorLinkProps {
	href?: string;
	label?: string;
	children: ReactNode;
	onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const SponsorLink = forwardRef<HTMLAnchorElement, SponsorLinkProps>(
	({ href, label, children, onClick, ...rest }, ref) => {
		if (href) {
			return (
				<a
					ref={ref}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					title={label}
					className="flex items-center justify-center gap-3 w-full h-full min-w-0 cursor-pointer select-none no-underline"
					onDragStart={(e) => e.preventDefault()}
					onContextMenu={(e) => e.preventDefault()}
					onClick={(e) => {
						e.preventDefault();
						e.stopPropagation();
						if (href) {
							window.open(href, "_blank", "noopener,noreferrer");
						}
						onClick?.(e);
					}}
					{...rest}
				>
					{children}
				</a>
			);
		}
		return (
			<div
				ref={ref as any}
				className="flex items-center justify-center gap-3 w-full h-full min-w-0 select-none"
				onDragStart={(e) => e.preventDefault()}
				onContextMenu={(e) => e.preventDefault()}
				{...rest}
			>
				{children}
			</div>
		);
	},
);
SponsorLink.displayName = "SponsorLink";

export const SponsorCarousel: FC<SponsorCarouselProps> = memo(
	({ items, variant, collapsed = false, animateIn = true }) => {
		const stableItems = useMemo(
			() => items.filter((item) => item.src),
			[items],
		);
		const [index, setIndex] = useState(0);
		const [paused, setPaused] = useState(false);
		const isBanner = variant === "banner";
		const isSidebarBanner = variant === "sidebar";
		const isVertical = isBanner || isSidebarBanner;
		const itemCount = stableItems.length;
		const currentIsSponsor = Boolean(stableItems[index]?.isSponsor);
		const currentItemId = stableItems[index]?.id ?? "";
		const [isInitial, setIsInitial] = useState(true);
		const [bannerDimensions, setBannerDimensions] = useState<{
			width: number;
			ratio: number;
		}>({ width: 220, ratio: 5.5 });
		const activeBannerSrc = isBanner ? stableItems[index]?.src : undefined;

		useEffect(() => {
			if (!isBanner || !activeBannerSrc) return;
			const probe = new window.Image();
			const updateDimensions = () => {
				if (probe.naturalWidth && probe.naturalHeight) {
					const ratio = probe.naturalWidth / probe.naturalHeight;
					const width = Math.round(ratio * 40);
					setBannerDimensions((prev) => {
						if (prev.width === width && prev.ratio === ratio) return prev;
						return { width, ratio };
					});
				}
			};
			probe.onload = updateDimensions;
			probe.src = activeBannerSrc;
			if (probe.complete) {
				updateDimensions();
			}
		}, [isBanner, activeBannerSrc]);

		useEffect(() => {
			if (index >= stableItems.length) setIndex(0);
		}, [index, stableItems.length]);

		useEffect(() => {
			if (paused || itemCount < 2 || !currentItemId) return;
			const delay =
				variant === "logo" ? (currentIsSponsor ? 7000 : 10000) : 7000;
			const timer = window.setTimeout(() => {
				setIndex((current) => (current + 1) % itemCount);
			}, delay);
			return () => window.clearTimeout(timer);
		}, [currentIsSponsor, currentItemId, itemCount, paused, variant]);

		if (stableItems.length === 0) return null;

		return (
			<motion.div
				initial={animateIn ? { y: "-140%", opacity: 0 } : false}
				animate={{ y: "0%", opacity: 1 }}
				transition={{
					duration: 0.5,
					ease: [0.16, 1, 0.3, 1],
					delay: animateIn && isInitial ? 0.7 : 0,
				}}
				style={{
					display: isBanner ? "inline-flex" : "block",
					width:
						isBanner && bannerDimensions.width
							? `${bannerDimensions.width}px`
							: "100%",
					maxWidth: "100%",
					minWidth: isBanner ? "40px" : undefined,
					alignItems: "center",
					justifyContent: isBanner ? "flex-start" : "center",
				}}
				onAnimationComplete={() => {
					if (isInitial) setIsInitial(false);
				}}
			>
				<div
					className={`overflow-hidden w-full max-w-full ${
						isBanner ? "min-w-10 h-auto max-h-10 shrink" : "h-full"
					} ${
						isBanner || isSidebarBanner
							? "rounded-[12px] border border-panel-border! bg-panel-surface shadow-xs md:hover:border-panel-border-strong! md:hover:shadow-md transition-all"
							: "rounded-[10px] border-0 bg-transparent"
					}`}
					style={{
						aspectRatio: isBanner
							? `${bannerDimensions.ratio}`
							: isSidebarBanner
								? "21 / 17"
								: undefined,
					}}
					onMouseEnter={() => setPaused(true)}
					onMouseLeave={() => setPaused(false)}
					onFocus={() => setPaused(true)}
					onBlur={() => setPaused(false)}
				>
					<div
						className={`flex ${
							isVertical ? "flex-col" : "flex-row"
						} w-full h-full transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none`}
						style={{
							transform: isVertical
								? `translateY(-${index * 100}%)`
								: `translateX(-${index * 100}%)`,
						}}
					>
						{stableItems.map((item) => {
							const effectiveHref =
								item.href ||
								(item.isSponsor ? "https://webdade.com/" : undefined);
							const hoverTitle = item.label || item.alt || "Sponsor";

							return (
								<div
									key={item.id}
									className={`min-w-full w-full ${
										isVertical ? "min-h-full" : ""
									} h-full flex items-center ${
										isBanner ? "justify-center gap-0" : "justify-start gap-3"
									} shrink-0`}
								>
									<SponsorLink href={effectiveHref} label={hoverTitle}>
										<img
											src={item.src}
											alt={item.alt}
											draggable={false}
											loading={isBanner || isSidebarBanner ? "eager" : "lazy"}
											className={`block max-w-full max-h-full ${
												isBanner
													? "object-fill"
													: isSidebarBanner
														? "object-cover"
														: "object-contain"
											} w-full h-full p-0 ${
												isBanner || isSidebarBanner
													? "rounded-[11px]"
													: "rounded-lg"
											} transition-transform duration-250 select-none pointer-events-none`}
											onLoad={(e) => {
												const img = e.currentTarget;
												if (
													img.naturalWidth &&
													img.naturalHeight &&
													isBanner
												) {
													const ratio = img.naturalWidth / img.naturalHeight;
													const width = Math.round(ratio * 40);
													setBannerDimensions({ width, ratio });
												}
											}}
											onDragStart={(e) => e.preventDefault()}
											onContextMenu={(e) => e.preventDefault()}
										/>
										{variant === "logo" && !collapsed && (
											<span className="text-lg md:text-2xl font-bold font-['Inter',system-ui,sans-serif] tracking-tight leading-none whitespace-nowrap text-panel-text truncate">
												{item.isSponsor ? item.label : "Rebecca"}
											</span>
										)}
									</SponsorLink>
								</div>
							);
						})}
					</div>
				</div>
			</motion.div>
		);
	},
);
SponsorCarousel.displayName = "SponsorCarousel";

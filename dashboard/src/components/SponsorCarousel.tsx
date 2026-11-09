import { cn } from "lib/cn";
import {
	useEffect,
	useMemo,
	useState,
	type FC,
	type ReactNode,
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
}

const SponsorLink: FC<{ href?: string; children: ReactNode }> = ({
	href,
	children,
}) =>
	href ? (
		<a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 w-full h-full min-w-0!">
			{children}
		</a>
	) : (
		<>{children}</>
	);

export const SponsorCarousel: FC<SponsorCarouselProps> = ({
	items,
	variant,
	collapsed = false,
}) => {
	const stableItems = useMemo(() => items.filter((item) => item.src), [items]);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);
	const itemCount = stableItems.length;
	const currentIsSponsor = Boolean(stableItems[index]?.isSponsor);
	const currentItemId = stableItems[index]?.id ?? "";

	useEffect(() => {
		if (index >= stableItems.length) setIndex(0);
	}, [index, stableItems.length]);

	useEffect(() => {
		if (paused || itemCount < 2 || !currentItemId) return;
		const delay =
			variant === "logo" ? (currentIsSponsor ? 5000 : 10000) : 6000;
		const timer = window.setTimeout(() => {
			setIndex((current) => (current + 1) % itemCount);
		}, delay);
		return () => window.clearTimeout(timer);
	}, [currentIsSponsor, currentItemId, itemCount, paused, variant]);

	if (stableItems.length === 0) return null;

	const isBanner = variant === "banner";
	const isSidebarBanner = variant === "sidebar";
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: pauses the carousel while hovered or focused; it is not a control
		<div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} className={cn("overflow-hidden w-full border border-none rounded-md shadow-none", isBanner ? "aspect-[4_/_1]" + " " + "md:aspect-[8_/_1]" : (isSidebarBanner ? "aspect-[21_/_8.5]" + " " + "md:aspect-[21_/_17]" : ""))}>
			<div style={{ transform: `translateX(-${index * 100}%)` }} className="flex w-full h-full motion-reduce:[transition:none] [&_img]:border-0 [&_img]:outline-none [transition:transform_450ms_cubic-bezier(0.16,_1,_0.3,_1)]">
				{stableItems.map((item) => {
					const image = (
						<img src={item.src} alt={item.alt} loading="lazy" className={cn("block max-w-full max-h-full border border-none rounded-md", isBanner ? "object-cover" : "object-contain", isBanner || isSidebarBanner ? "w-full" : "w-8", isBanner || isSidebarBanner ? "h-full" : "h-8")} />
					);
					return (
						<div key={item.id} className={cn("min-w-full! h-full flex items-center", isBanner ? "justify-center" : "justify-start", isBanner ? "gap-0" : "gap-3")}>
							<SponsorLink href={item.href}>
								{image}
								{variant === "logo" && !collapsed && (
									<p className={"text-[1.125rem] md:text-[1.5rem] font-bold [font-family:'Inter',_system-ui,_sans-serif] tracking-tight leading-[1] whitespace-nowrap text-panel-text truncate"}>
										{item.isSponsor ? item.label : "Rebecca"}
									</p>
								)}
							</SponsorLink>
						</div>
					);
				})}
			</div>
		</div>
	);
};

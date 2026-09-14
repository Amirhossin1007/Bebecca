import { Box, Image, Text } from "@chakra-ui/react";
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
	sponsorPrefix?: string;
	fallbackLabel?: string;
}

const SponsorLink: FC<{ href?: string; children: ReactNode }> = ({
	href,
	children,
}) =>
	href ? (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	) : (
		<>{children}</>
	);

export const SponsorCarousel: FC<SponsorCarouselProps> = ({
	items,
	variant,
	collapsed = false,
	sponsorPrefix = "Sponsored by",
	fallbackLabel = "Rebecca",
}) => {
	const stableItems = useMemo(() => items.filter((item) => item.src), [items]);
	const [index, setIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	useEffect(() => {
		if (index >= stableItems.length) setIndex(0);
	}, [index, stableItems.length]);

	useEffect(() => {
		if (paused || stableItems.length < 2) return;
		const timer = window.setInterval(() => {
			setIndex((current) => (current + 1) % stableItems.length);
		}, 6000);
		return () => window.clearInterval(timer);
	}, [paused, stableItems.length]);

	if (stableItems.length === 0) return null;

	const isBanner = variant === "banner";
	const isSidebarBanner = variant === "sidebar";
	return (
		<Box
			overflow="hidden"
			w="full"
			aspectRatio={
				isBanner
					? { base: "4 / 1", md: "8 / 1" }
					: isSidebarBanner
						? "3 / 2"
						: undefined
			}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
		>
			<Box
				display="flex"
				w="full"
				h="full"
				transform={`translateX(-${index * 100}%)`}
				transition="transform 450ms cubic-bezier(0.16, 1, 0.3, 1)"
				sx={{ "@media (prefers-reduced-motion: reduce)": { transition: "none" } }}
			>
				{stableItems.map((item) => {
					const image = (
						<Image
							src={item.src}
							alt={item.alt}
							loading="lazy"
								display="block"
								maxW="full"
								maxH="full"
								objectFit={isBanner || isSidebarBanner ? "cover" : "contain"}
								w={isBanner || isSidebarBanner ? "full" : 8}
								h={isBanner || isSidebarBanner ? "full" : 8}
							/>
					);
					return (
						<Box
							key={item.id}
							minW="full"
							h="full"
							display="flex"
							alignItems="center"
							justifyContent={isBanner ? "center" : "flex-start"}
							gap={isBanner ? 0 : 3}
						>
							<SponsorLink href={item.href}>{image}</SponsorLink>
							{!isBanner && !collapsed && (
								<Text fontSize="lg" fontWeight="bold" color="panel.text" noOfLines={1}>
									{item.isSponsor
										? `${sponsorPrefix} ${item.label || item.alt}`
										: item.label || fallbackLabel}
								</Text>
							)}
						</Box>
					);
				})}
			</Box>
		</Box>
	);
};

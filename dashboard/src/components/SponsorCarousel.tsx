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
}

const SponsorLink: FC<{ href?: string; children: ReactNode }> = ({
	href,
	children,
}) =>
	href ? (
		<Box
			as="a"
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			display="flex"
			alignItems="center"
			gap={3}
			w="full"
			h="full"
			minW={0}
		>
			{children}
		</Box>
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
		<Box
			overflow="hidden"
			w="full"
			border="none"
			borderRadius="md"
			boxShadow="none"
			aspectRatio={
				isBanner
					? { base: "4 / 1", md: "8 / 1" }
					: isSidebarBanner
						? "21 / 17"
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
				sx={{
					"@media (prefers-reduced-motion: reduce)": { transition: "none" },
					img: { border: "none", outline: "none" },
				}}
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
							objectFit={isBanner ? "cover" : "contain"}
							w={isBanner || isSidebarBanner ? "full" : 8}
							h={isBanner || isSidebarBanner ? "full" : 8}
							border="none"
							borderRadius="md"
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
							<SponsorLink href={item.href}>
								{image}
								{variant === "logo" && !collapsed && (
									<Text
										fontSize={{ base: "lg", md: "2xl" }}
										fontWeight="bold"
										fontFamily="'Inter', system-ui, sans-serif"
										letterSpacing="tight"
										lineHeight="1"
										whiteSpace="nowrap"
										color="panel.text"
										noOfLines={1}
									>
										{item.isSponsor ? item.label : "Rebecca"}
									</Text>
								)}
							</SponsorLink>
						</Box>
					);
				})}
			</Box>
		</Box>
	);
};

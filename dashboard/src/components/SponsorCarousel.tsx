import { Box, Image, Text, useColorModeValue } from "@chakra-ui/react";
import {
	forwardRef,
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
				<Box
					as="a"
					ref={ref}
					href={href}
					target="_blank"
					rel="noopener noreferrer"
					title={label}
					display="flex"
					alignItems="center"
					justifyContent="center"
					gap={3}
					w="full"
					h="full"
					minW={0}
					cursor="pointer"
					userSelect="none"
					sx={{
						WebkitUserDrag: "none",
						WebkitTouchCallout: "none",
					}}
					onDragStart={(e: React.DragEvent) => e.preventDefault()}
					onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
					onClick={onClick}
					{...rest}
				>
					{children}
				</Box>
			);
		}
		return (
			<Box
				ref={ref as any}
				display="flex"
				alignItems="center"
				justifyContent="center"
				gap={3}
				w="full"
				h="full"
				minW={0}
				userSelect="none"
				sx={{
					WebkitUserDrag: "none",
					WebkitTouchCallout: "none",
				}}
				onDragStart={(e: React.DragEvent) => e.preventDefault()}
				onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
				{...rest}
			>
				{children}
			</Box>
		);
	},
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
	const frameBg = useColorModeValue("panel.surface", "panel.surface");
	const frameBorder = useColorModeValue("panel.border", "panel.border");

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
	const isVertical = isBanner || isSidebarBanner;

	return (
		<Box
			overflow="hidden"
			w="full"
			borderRadius={isBanner || isSidebarBanner ? "14px" : "10px"}
			borderWidth={isBanner || isSidebarBanner ? "1px" : "0px"}
			borderColor={frameBorder}
			bg={isBanner || isSidebarBanner ? frameBg : "transparent"}
			boxShadow={
				isBanner || isSidebarBanner
					? "0 4px 16px rgba(0, 0, 0, 0.08)"
					: "none"
			}
			aspectRatio={
				isBanner
					? { base: "4 / 1", md: "8 / 1" }
					: isSidebarBanner
						? "21 / 17"
						: undefined
			}
			transition="all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
			_hover={{
				md: {
					borderColor: "panel.borderStrong",
					boxShadow: "0 6px 20px rgba(0, 0, 0, 0.14)",
				},
			}}
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
		>
			<Box
				display="flex"
				flexDirection={isVertical ? "column" : "row"}
				w="full"
				h="full"
				transform={
					isVertical
						? `translateY(-${index * 100}%)`
						: `translateX(-${index * 100}%)`
				}
				transition="transform 500ms cubic-bezier(0.16, 1, 0.3, 1)"
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
							draggable={false}
							loading="lazy"
							display="block"
							maxW="full"
							maxH="full"
							objectFit={isBanner ? "cover" : "contain"}
							w={isBanner || isSidebarBanner ? "full" : 8}
							h={isBanner || isSidebarBanner ? "full" : 8}
							borderRadius={isBanner || isSidebarBanner ? "10px" : "8px"}
							transition="transform 0.25s ease"
							userSelect="none"
							sx={{
								WebkitUserDrag: "none",
								pointerEvents: "none",
							}}
							onDragStart={(e) => e.preventDefault()}
							onContextMenu={(e) => e.preventDefault()}
						/>
					);
					const effectiveHref = item.href || (item.isSponsor ? "https://webdade.com/" : undefined);
					const hoverTitle = item.label || item.alt || "Sponsor";

					return (
						<Box
							key={item.id}
							minW="full"
							w="full"
							minH={isVertical ? "full" : undefined}
							h="full"
							display="flex"
							alignItems="center"
							justifyContent={isBanner ? "center" : "flex-start"}
							gap={isBanner ? 0 : 3}
							flexShrink={0}
						>
							<SponsorLink href={effectiveHref} label={hoverTitle}>
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

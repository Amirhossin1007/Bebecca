import {
	Box,
	Divider,
	Flex,
	HStack,
	SimpleGrid,
	Skeleton,
	Stack,
	VStack,
} from "@chakra-ui/react";
import type { FC } from "react";

const skeletonRows = ["one", "two", "three", "four", "five", "six"];

export const PageLoadingSkeleton: FC = () => (
	<VStack
		spacing={{ base: 4, md: 5 }}
		align="stretch"
		w="full"
		sx={{
			"@keyframes pageSkeletonPulse": {
				"0%, 100%": { opacity: 0.45 },
				"50%": { opacity: 0.8 },
			},
			"& .page-skeleton": {
				animation: "pageSkeletonPulse 1.8s ease-in-out infinite",
			},
		}}
	>
		<Stack
			spacing={4}
			borderWidth="1px"
			borderColor="panel.border"
			borderRadius="20px"
			bg="panel.surface"
			p={{ base: 4, md: 5 }}
			boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.14)"
		>
			<Stack
				direction={{ base: "column", xl: "row" }}
				spacing={4}
				align={{ base: "stretch", xl: "center" }}
				justify="space-between"
			>
				<VStack align="flex-start" spacing={2}>
					<Skeleton className="page-skeleton" h="20px" w={{ base: "150px", md: "210px" }} />
					<HStack spacing={2}>
						{["total", "active", "pending"].map((id, index) => (
							<Skeleton
								key={id}
								className="page-skeleton"
								h="22px"
								w={`${index === 1 ? 94 : 78}px`}
								borderRadius="full"
							/>
						))}
					</HStack>
				</VStack>
				<SimpleGrid columns={{ base: 2, md: 4 }} spacing={2}>
					{["one", "two", "three", "four"].map((id) => (
						<Skeleton
							key={id}
							className="page-skeleton"
							h="36px"
							w={{ base: "full", md: "118px" }}
							borderRadius="md"
						/>
					))}
				</SimpleGrid>
			</Stack>
			<Divider />
			<SimpleGrid columns={{ base: 1, md: 4 }} spacing={2}>
				<Skeleton className="page-skeleton" h="36px" w="full" borderRadius="md" />
				{["filter-one", "filter-two", "filter-three"].map((id) => (
					<Skeleton
						key={id}
						className="page-skeleton"
						h="36px"
						w="full"
						borderRadius="md"
					/>
				))}
			</SimpleGrid>
		</Stack>

		<Box
			borderWidth="1px"
			borderColor="panel.border"
			borderRadius="20px"
			bg="panel.surface"
			overflow="hidden"
			boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.14)"
		>
			<Flex
				display={{ base: "none", md: "flex" }}
				gap={4}
				px={{ base: 4, md: 5 }}
				py={3}
				borderBottomWidth="1px"
				borderColor="panel.border"
			>
				{["select", "primary", "status", "metadata", "usage", "details", "actions"].map(
					(id, index) => (
						<Skeleton
							key={id}
							className="page-skeleton"
							h="12px"
							w={
								index === 0
									? "18px"
									: index === 1
										? "100px"
										: index === 6
											? "42px"
											: "76px"
							}
							borderRadius="sm"
						/>
					),
				)}
			</Flex>
			{skeletonRows.map((row, index) => (
				<Box
					key={row}
					px={{ base: 4, md: 5 }}
					py={{ base: 4, md: 5 }}
					borderBottomWidth={index === skeletonRows.length - 1 ? 0 : "1px"}
					borderColor="panel.border"
				>
					<Flex display={{ base: "none", md: "flex" }} align="center" gap={4}>
						<Skeleton className="page-skeleton" h="16px" w="16px" />
						<Skeleton className="page-skeleton" h="16px" w="112px" />
						<Skeleton className="page-skeleton" h="22px" w="82px" borderRadius="full" />
						<Skeleton className="page-skeleton" h="16px" w="132px" />
						<Skeleton className="page-skeleton" h="16px" w="104px" />
						<Skeleton className="page-skeleton" h="16px" flex="1" maxW="240px" />
						<Skeleton className="page-skeleton" h="28px" w="120px" />
						<Skeleton className="page-skeleton" h="18px" w="42px" />
					</Flex>
					<Stack display={{ base: "flex", md: "none" }} spacing={3}>
						<Flex align="center" justify="space-between" gap={3}>
							<HStack spacing={2} minW={0}>
								<Skeleton className="page-skeleton" h="16px" w="16px" />
								<Skeleton className="page-skeleton" h="16px" w="130px" />
							</HStack>
							<Skeleton className="page-skeleton" h="22px" w="82px" borderRadius="full" />
						</Flex>
						<Flex justify="space-between" gap={3}>
							<Skeleton className="page-skeleton" h="14px" w="90px" />
							<Skeleton className="page-skeleton" h="14px" w="118px" />
						</Flex>
						<Skeleton className="page-skeleton" h="28px" w="full" borderRadius="md" />
					</Stack>
				</Box>
			))}
		</Box>
	</VStack>
);

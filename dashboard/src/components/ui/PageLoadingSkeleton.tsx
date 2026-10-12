import {
	Box,
	Flex,
	HStack,
	SimpleGrid,
	Stack,
	VStack,
} from "@chakra-ui/react";
import type { FC } from "react";

export const PageLoadingSkeleton: FC = () => (
	<VStack
		spacing={{ base: 3.5, md: 4.5 }}
		align="stretch"
		w="full"
		sx={{
			"@keyframes rbGlassPulse": {
				"0%, 100%": {
					opacity: 0.4,
					transform: "scale(1)",
				},
				"50%": {
					opacity: 0.75,
					transform: "scale(1.002)",
				},
			},
			"& .rb-glass-item": {
				animation: "rbGlassPulse 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
			},
		}}
	>
		<Flex
			align="center"
			justify="space-between"
			px={1}
			py={0.5}
			flexWrap="wrap"
			gap={3}
		>
			<VStack align="flex-start" spacing={1.5}>
				<Box
					className="rb-glass-item"
					w={{ base: "130px", sm: "160px" }}
					h="24px"
					borderRadius="8px"
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
				/>
				<Box
					className="rb-glass-item"
					w={{ base: "75px", sm: "95px" }}
					h="14px"
					borderRadius="md"
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
				/>
			</VStack>
			<HStack spacing={2} align="center">
				<Box
					className="rb-glass-item"
					w={{ base: "80px", sm: "100px" }}
					h="32px"
					borderRadius="full"
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
				/>
				<Box
					className="rb-glass-item"
					w={{ base: "70px", sm: "88px" }}
					h="32px"
					borderRadius="full"
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
				/>
			</HStack>
		</Flex>

		<SimpleGrid
			columns={{ base: 1, sm: 2, xl: 4 }}
			gap={{ base: 3, md: 4 }}
			sx={{
				"@media screen and (min-width: 768px) and (max-width: 910px)": {
					"body:not(:has([data-sidebar-collapsed='true'])) &": {
						gridTemplateColumns: "1fr !important",
					},
				},
			}}
		>
			{[1, 2, 3, 4].map((i) => (
				<Box
					key={i}
					className="rb-glass-item"
					bg="panel.surface"
					borderRadius="20px"
					borderWidth="1px"
					borderColor="panel.border"
					p={{ base: 4, sm: 5 }}
					minH={{ base: "110px", md: "128px" }}
					display="flex"
					flexDirection="column"
					justifyContent="space-between"
					boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.12)"
					backdropFilter="blur(8px)"
				>
					<Flex justify="space-between" align="center">
						<HStack spacing={2.5}>
							<Box
								w="32px"
								h="32px"
								borderRadius="10px"
								bg="panel.elevated"
								flexShrink={0}
							/>
							<Box
								w={i % 2 === 0 ? "80px" : "105px"}
								h="15px"
								borderRadius="md"
								bg="panel.elevated"
							/>
						</HStack>
						<Box
							w="22px"
							h="22px"
							borderRadius="full"
							bg="panel.elevated"
						/>
					</Flex>

					<Stack spacing={2} mt={3}>
						<Box
							w={i === 1 ? "110px" : "85px"}
							h="26px"
							borderRadius="md"
							bg="panel.elevated"
						/>
						<Box
							w="full"
							h="3px"
							borderRadius="full"
							bg="panel.elevated"
							opacity={0.6}
						/>
					</Stack>
				</Box>
			))}
		</SimpleGrid>

		<Box
			className="rb-glass-item"
			bg="panel.surface"
			borderRadius="20px"
			borderWidth="1px"
			borderColor="panel.border"
			p={{ base: 4, sm: 5, md: 6 }}
			minH={{ base: "260px", md: "340px" }}
			boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.12)"
			backdropFilter="blur(8px)"
			display="flex"
			flexDirection="column"
			justifyContent="space-between"
		>
			<Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
				<HStack spacing={2.5}>
					<Box w="28px" h="28px" borderRadius="8px" bg="panel.elevated" />
					<Box w="130px" h="18px" borderRadius="md" bg="panel.elevated" />
				</HStack>
				<HStack spacing={2}>
					<Box w="70px" h="28px" borderRadius="full" bg="panel.elevated" />
					<Box w="70px" h="28px" borderRadius="full" bg="panel.elevated" />
				</HStack>
			</Flex>

			<VStack spacing={3} align="stretch" flex="1" justify="center" py={4}>
				<Box w="full" h="14px" borderRadius="md" bg="panel.elevated" opacity={0.6} />
				<Box w="85%" h="14px" borderRadius="md" bg="panel.elevated" opacity={0.45} />
				<Box w="70%" h="14px" borderRadius="md" bg="panel.elevated" opacity={0.3} />
			</VStack>

			<Flex justify="space-between" align="center" pt={3} borderTopWidth="1px" borderColor="panel.border">
				<Box w="90px" h="14px" borderRadius="sm" bg="panel.elevated" opacity={0.5} />
				<Box w="60px" h="14px" borderRadius="sm" bg="panel.elevated" opacity={0.5} />
			</Flex>
		</Box>
	</VStack>
);
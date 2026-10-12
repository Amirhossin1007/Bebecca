import {
	Box,
	Flex,
	HStack,
	SimpleGrid,
	Spacer,
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

export const PanelLoadingSkeleton: FC = () => {
	const isRTL =
		typeof document !== "undefined"
			? document.documentElement.dir === "rtl" ||
				document.documentElement.lang === "fa"
			: true;

	return (
		<Box
			minH="100vh"
			w="full"
			bg="panel.bg"
			dir={isRTL ? "rtl" : "ltr"}
			position="relative"
			sx={{
				"@keyframes rbGlassPulse": {
					"0%, 100%": {
						opacity: 0.42,
						transform: "scale(1)",
					},
					"50%": {
						opacity: 0.78,
						transform: "scale(1.002)",
					},
				},
				"& .rb-glass-item": {
					animation: "rbGlassPulse 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite",
				},
			}}
		>
			<Box
				display={{ base: "none", md: "flex" }}
				position="fixed"
				top={0}
				bottom={0}
				insetInlineStart={0}
				w="var(--rb-sidebar-width, 240px)"
				bg="panel.surface"
				borderInlineEndWidth="1px"
				borderColor="panel.border"
				backdropFilter="blur(16px)"
				zIndex={10}
				flexDirection="column"
				className="rb-glass-item"
			>
				<Flex
					h="60px"
					px={4}
					align="center"
					justify="space-between"
					borderBottomWidth="1px"
					borderColor="panel.border"
					flexShrink={0}
				>
					<HStack spacing={2.5}>
						<Box
							w="32px"
							h="32px"
							borderRadius="10px"
							bg="panel.elevated"
							borderWidth="1px"
							borderColor="panel.border"
							flexShrink={0}
						/>
						<Box
							w="72px"
							h="18px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</HStack>
					<Box
						w="36px"
						h="18px"
						borderRadius="full"
						bg="panel.elevated"
					/>
				</Flex>

				<VStack align="stretch" spacing={1} p={3} flex="1">
					<Flex
						h="38px"
						borderRadius="12px"
						bg="panel.elevated"
						px={3}
						align="center"
						justify="space-between"
					>
						<HStack spacing={2.5}>
							<Box
								w="20px"
								h="20px"
								borderRadius="6px"
								bg="panel.border"
								flexShrink={0}
							/>
							<Box
								w="60px"
								h="14px"
								borderRadius="md"
								bg="panel.border"
							/>
						</HStack>
						<Box
							w="5px"
							h="14px"
							borderRadius="full"
							bg="panel.border"
						/>
					</Flex>

					<Box
						w="42px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={3}
						mb={1}
						mx={2}
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
					>
						<HStack spacing={2.5}>
							<Box
								w="20px"
								h="20px"
								borderRadius="6px"
								bg="panel.elevated"
								flexShrink={0}
							/>
							<Box
								w="65px"
								h="14px"
								borderRadius="md"
								bg="panel.elevated"
							/>
						</HStack>
						<Box
							w="10px"
							h="10px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>

					<Flex
						h="30px"
						borderRadius="8px"
						ps={8}
						pe={3}
						align="center"
					>
						<Box
							w="60px"
							h="12px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</Flex>
					<Flex
						h="30px"
						borderRadius="8px"
						ps={8}
						pe={3}
						align="center"
					>
						<Box
							w="75px"
							h="12px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</Flex>

					<Box
						w="36px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={2.5}
						mb={1}
						mx={2}
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
					>
						<HStack spacing={2.5}>
							<Box
								w="20px"
								h="20px"
								borderRadius="6px"
								bg="panel.elevated"
								flexShrink={0}
							/>
							<Box
								w="70px"
								h="14px"
								borderRadius="md"
								bg="panel.elevated"
							/>
						</HStack>
						<Box
							w="10px"
							h="10px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>

					<Box
						w="46px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={2.5}
						mb={1}
						mx={2}
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
					>
						<HStack spacing={2.5}>
							<Box
								w="20px"
								h="20px"
								borderRadius="6px"
								bg="panel.elevated"
								flexShrink={0}
							/>
							<Box
								w="62px"
								h="14px"
								borderRadius="md"
								bg="panel.elevated"
							/>
						</HStack>
						<Box
							w="10px"
							h="10px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>

					<Box
						w="64px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={2.5}
						mb={1}
						mx={2}
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
					>
						<HStack spacing={2.5}>
							<Box
								w="20px"
								h="20px"
								borderRadius="6px"
								bg="panel.elevated"
								flexShrink={0}
							/>
							<Box
								w="78px"
								h="14px"
								borderRadius="md"
								bg="panel.elevated"
							/>
						</HStack>
						<Box
							w="10px"
							h="10px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>
				</VStack>

				<Box p={3} flexShrink={0}>
					<Box
						h="48px"
						borderRadius="14px"
						bg="panel.elevated"
						borderWidth="1px"
						borderColor="panel.border"
					/>
				</Box>
			</Box>

			<Flex
				position="sticky"
				top={0}
				h={{ base: "56px", md: "60px" }}
				ms={{ base: 0, md: "var(--rb-sidebar-width, 240px)" }}
				bg="panel.surface"
				borderBottomWidth="1px"
				borderColor="panel.border"
				backdropFilter="blur(16px)"
				align="center"
				justify="space-between"
				px={{ base: 3, sm: 4, md: 5 }}
				zIndex={9}
				className="rb-glass-item"
			>
				<Flex
					display={{ base: "none", md: "flex" }}
					align="center"
					gap={2.5}
				>
					<Box
						w="34px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					/>
					<Box
						w="1px"
						h="16px"
						bg="panel.border"
						mx={1}
					/>
					<HStack spacing={2} align="center">
						<Box
							w="16px"
							h="16px"
							borderRadius="4px"
							bg="panel.elevated"
						/>
						<Box
							w="8px"
							h="12px"
							borderRadius="xs"
							bg="panel.elevated"
						/>
						<Box
							w="65px"
							h="16px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</HStack>
				</Flex>

				<Flex
					display={{ base: "flex", md: "none" }}
					align="center"
					gap={2.5}
				>
					<Box
						w="34px"
						h="34px"
						borderRadius="full"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					/>
					<HStack spacing={2} align="center">
						<Box
							w="24px"
							h="24px"
							borderRadius="8px"
							bg="panel.elevated"
						/>
						<Box
							w="65px"
							h="16px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</HStack>
				</Flex>

				<Spacer />

				<HStack
					spacing={{ base: 1.5, sm: 2 }}
					align="center"
				>
					<Box
						display={{ base: "none", md: "block" }}
						w="115px"
						h="32px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					/>
					<Box
						w={{ base: "65px", sm: "75px" }}
						h={{ base: "28px", sm: "32px" }}
						borderRadius={{ base: "10px", sm: "12px" }}
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
					/>
					<Flex
						align="center"
						justify="center"
						w={{ base: "34px", md: "115px" }}
						h="34px"
						borderRadius={{ base: "full", md: "12px" }}
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.surface"
						px={{ base: 0, md: 2.5 }}
						gap={2}
					>
						<Box
							w="22px"
							h="22px"
							borderRadius="full"
							bg="panel.elevated"
							flexShrink={0}
						/>
						<Box
							display={{ base: "none", md: "block" }}
							w="50px"
							h="12px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>
				</HStack>
			</Flex>

			<Box
				ms={{ base: 0, md: "var(--rb-sidebar-width, 240px)" }}
				p={{ base: 3, sm: 4, md: 5 }}
			>
				<PageLoadingSkeleton />
			</Box>
		</Box>
	);
};
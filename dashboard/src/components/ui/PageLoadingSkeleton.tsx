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

		<Box
			className="rb-glass-item"
			bg="panel.surface"
			borderRadius="20px"
			borderWidth="1px"
			borderColor="panel.border"
			p={{ base: 4, sm: 5 }}
			boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.12)"
			backdropFilter="blur(8px)"
		>
			<Flex justify="space-between" align="center" mb={4}>
				<HStack spacing={2.5}>
					<Box
						w="28px"
						h="28px"
						borderRadius="8px"
						bg="panel.elevated"
						flexShrink={0}
					/>
					<Box w="120px" h="16px" borderRadius="md" bg="panel.elevated" />
				</HStack>
				<Box w="65px" h="20px" borderRadius="full" bg="panel.elevated" />
			</Flex>

			<SimpleGrid columns={{ base: 1, sm: 3 }} gap={3}>
				{[1, 2, 3].map((idx) => (
					<Box
						key={idx}
						p={3}
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.surface"
					>
						<Box w="65px" h="12px" borderRadius="sm" bg="panel.elevated" mb={2} />
						<Box w="95px" h="22px" borderRadius="md" bg="panel.elevated" mb={2} />
						<Box w="full" h="4px" borderRadius="full" bg="panel.elevated" opacity={0.6} />
					</Box>
				))}
			</SimpleGrid>
		</Box>

		<Box
			className="rb-glass-item"
			bg="panel.surface"
			borderRadius="20px"
			borderWidth="1px"
			borderColor="panel.border"
			overflow="hidden"
			boxShadow="inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 24px -6px rgba(0,0,0,0.12)"
			backdropFilter="blur(8px)"
		>
			<Flex
				px={{ base: 4, sm: 5, md: 6 }}
				py={3.5}
				justify="space-between"
				align="center"
				borderBottomWidth="1px"
				borderColor="panel.border"
			>
				<HStack spacing={2.5}>
					<Box w="24px" h="24px" borderRadius="6px" bg="panel.elevated" />
					<Box w="105px" h="16px" borderRadius="md" bg="panel.elevated" />
				</HStack>
				<Box w="75px" h="24px" borderRadius="8px" bg="panel.elevated" />
			</Flex>

			<Box p={{ base: 4, sm: 5, md: 6 }}>
				<Stack spacing={0}>
					{[
						{ id: "skel-gen-1", w1: "135px", w2: "80px", tagW: "60px" },
						{ id: "skel-gen-2", w1: "115px", w2: "95px", tagW: "70px" },
						{ id: "skel-gen-3", w1: "155px", w2: "75px", tagW: "55px" },
						{ id: "skel-gen-4", w1: "125px", w2: "90px", tagW: "65px" },
						{ id: "skel-gen-5", w1: "145px", w2: "85px", tagW: "60px" },
					].map((row, idx) => (
						<Flex
							key={row.id}
							justify="space-between"
							align="center"
							py={3}
							borderBottomWidth={idx === 4 ? "0" : "1px"}
							borderColor="panel.border"
						>
							<HStack spacing={3} minW={0}>
								<Box
									w="8px"
									h="8px"
									borderRadius="full"
									bg="panel.elevated"
									flexShrink={0}
								/>
								<VStack align="flex-start" spacing={1}>
									<Box w={row.w1} h="14px" borderRadius="md" bg="panel.elevated" />
									<Box w={row.w2} h="11px" borderRadius="sm" bg="panel.elevated" opacity={0.7} />
								</VStack>
							</HStack>
							<Box w={row.tagW} h="20px" borderRadius="full" bg="panel.elevated" />
						</Flex>
					))}
				</Stack>
			</Box>
		</Box>
	</VStack>
);

export const PanelLoadingSkeleton: FC = () => {
	const isRTL =
		typeof document !== "undefined"
			? document.documentElement.dir === "rtl" ||
				document.documentElement.lang === "fa" ||
				(typeof localStorage !== "undefined" &&
					localStorage.getItem("i18nextLng") === "fa")
			: true;

	return (
		<Box
			minH="100vh"
			w="full"
			bg="panel.app"
			dir={isRTL ? "rtl" : "ltr"}
			position="relative"
			overflow="hidden"
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
				top="12px"
				bottom="12px"
				right={isRTL ? "12px" : "auto"}
				left={isRTL ? "auto" : "12px"}
				w="var(--rb-sidebar-width, 240px)"
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				borderRadius="20px"
				boxShadow="0 20px 48px rgba(0, 0, 0, 0.4)"
				backdropFilter="blur(16px)"
				zIndex={200}
				flexDirection="column"
				overflow="hidden"
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
							w="34px"
							h="34px"
							borderRadius="12px"
							bg="panel.elevated"
							borderWidth="1px"
							borderColor="panel.border"
							flexShrink={0}
							className="rb-glass-item"
						/>
						<Box
							w="72px"
							h="18px"
							borderRadius="md"
							bg="panel.elevated"
							className="rb-glass-item"
						/>
					</HStack>
					<Box
						w="38px"
						h="18px"
						borderRadius="full"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
				</Flex>

				<VStack align="stretch" spacing={1} p={3} flex="1" overflow="hidden">
					<Flex
						h="40px"
						borderRadius="14px"
						bg="panel.elevated"
						borderWidth="1px"
						borderColor="panel.border"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
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
								w="65px"
								h="14px"
								borderRadius="md"
								bg="panel.border"
							/>
						</HStack>
						<Box
							w="6px"
							h="16px"
							borderRadius="full"
							bg="panel.border"
						/>
					</Flex>

					<Box
						w="45px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={3}
						mb={1.5}
						mx={2}
						className="rb-glass-item"
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
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

					<Flex
						h="28px"
						borderRadius="8px"
						ps={7}
						pe={3}
						align="center"
						className="rb-glass-item"
					>
						<Box
							w="60px"
							h="12px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</Flex>
					<Flex
						h="28px"
						borderRadius="8px"
						ps={7}
						pe={3}
						align="center"
						className="rb-glass-item"
					>
						<Box
							w="75px"
							h="12px"
							borderRadius="md"
							bg="panel.elevated"
						/>
					</Flex>

					<Box
						w="55px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={3}
						mb={1.5}
						mx={2}
						className="rb-glass-item"
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
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
					</Flex>

					<Box
						w="65px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={3}
						mb={1.5}
						mx={2}
						className="rb-glass-item"
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
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
								w="75px"
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
						w="55px"
						h="10px"
						borderRadius="sm"
						bg="panel.elevated"
						mt={3}
						mb={1.5}
						mx={2}
						className="rb-glass-item"
					/>
					<Flex
						h="38px"
						borderRadius="12px"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
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
					</Flex>
				</VStack>

				<Box p={3} flexShrink={0}>
					<Flex
						h="48px"
						borderRadius="14px"
						bg="panel.elevated"
						borderWidth="1px"
						borderColor="panel.border"
						px={3}
						align="center"
						justify="space-between"
						className="rb-glass-item"
					>
						<HStack spacing={2.5}>
							<Box
								w="26px"
								h="26px"
								borderRadius="full"
								bg="panel.border"
								flexShrink={0}
							/>
							<Box
								w="65px"
								h="14px"
								borderRadius="md"
								bg="panel.border"
							/>
						</HStack>
						<Box
							w="18px"
							h="18px"
							borderRadius="4px"
							bg="panel.border"
						/>
					</Flex>
				</Box>
			</Box>

			<Flex
				display={{ base: "none", md: "flex" }}
				mt="3"
				mr={isRTL ? "calc(var(--rb-sidebar-width, 240px) + 20px)" : "4"}
				ml={isRTL ? "4" : "calc(var(--rb-sidebar-width, 240px) + 20px)"}
				h="52px"
				minH="52px"
				borderRadius="18px"
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				backdropFilter="blur(16px)"
				align="center"
				justify="space-between"
				px={4}
				zIndex={100}
			>
				<HStack spacing={2.5} align="center">
					<Box
						w="34px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box w="1px" h="16px" bg="panel.border" mx={0.5} />
					<Box
						w="18px"
						h="18px"
						borderRadius="4px"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="75px"
						h="18px"
						borderRadius="md"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
				</HStack>

				<HStack spacing={2} align="center">
					<Box
						w="34px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="72px"
						h="32px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="34px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="34px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Flex
						align="center"
						justify="center"
						w="105px"
						h="34px"
						borderRadius="12px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.surface"
						px={2.5}
						gap={2}
						className="rb-glass-item"
					>
						<Box
							w="22px"
							h="22px"
							borderRadius="full"
							bg="panel.elevated"
							flexShrink={0}
						/>
						<Box
							w="50px"
							h="12px"
							borderRadius="sm"
							bg="panel.elevated"
						/>
					</Flex>
				</HStack>
			</Flex>

			<Flex
				display={{ base: "flex", md: "none" }}
				mt="3"
				mx="3"
				h="52px"
				minH="52px"
				borderRadius="18px"
				bg="panel.surface"
				borderWidth="1px"
				borderColor="panel.border"
				backdropFilter="blur(16px)"
				align="center"
				justify="space-between"
				px={3}
				zIndex={100}
			>
				<HStack spacing={2} align="center">
					<Box
						w="34px"
						h="34px"
						borderRadius="full"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="75px"
						h="18px"
						borderRadius="md"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
				</HStack>

				<HStack spacing={1.5} align="center">
					<Box
						w="32px"
						h="32px"
						borderRadius="10px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
					<Box
						w="68px"
						h="28px"
						borderRadius="10px"
						borderWidth="1px"
						borderColor="panel.border"
						bg="panel.elevated"
						className="rb-glass-item"
					/>
				</HStack>
			</Flex>

			<Box
				mr={{
					base: "3",
					md: isRTL ? "calc(var(--rb-sidebar-width, 240px) + 20px)" : "4",
				}}
				ml={{
					base: "3",
					md: isRTL ? "4" : "calc(var(--rb-sidebar-width, 240px) + 20px)",
				}}
				pt="3"
				pb={{ base: "95px", md: "4" }}
			>
				<PageLoadingSkeleton />
			</Box>

			<Box
				display={{ base: "block", md: "none" }}
				position="fixed"
				bottom="calc(env(safe-area-inset-bottom, 0px) + 12px)"
				left="0"
				right="0"
				zIndex={1500}
				px="3"
				pointerEvents="none"
			>
				<Box
					maxW="min(440px, calc(100vw - 20px))"
					mx="auto"
					borderRadius="24px"
					borderWidth="1px"
					borderColor="panel.border"
					bg="panel.surface"
					backdropFilter="blur(16px)"
					boxShadow="0 20px 48px rgba(0, 0, 0, 0.4)"
					px="2"
					py="1.5"
				>
					<Flex align="center" justify="space-around">
						{[
							{ id: "dock-skel-settings", labelW: "32px", active: false },
							{ id: "dock-skel-account", labelW: "36px", active: false },
							{ id: "dock-skel-dash", labelW: "38px", active: true },
							{ id: "dock-skel-notif", labelW: "34px", active: false },
							{ id: "dock-skel-users", labelW: "32px", active: false },
						].map((tab) => (
							<VStack
								key={tab.id}
								spacing={1}
								py={1}
								px={2}
								borderRadius="16px"
								bg={tab.active ? "panel.elevated" : "transparent"}
								borderWidth={tab.active ? "1px" : "0px"}
								borderColor="panel.border"
								className="rb-glass-item"
							>
								<Box
									w="20px"
									h="20px"
									borderRadius="full"
									bg={tab.active ? "panel.border" : "panel.elevated"}
								/>
								<Box
									w={tab.labelW}
									h="8px"
									borderRadius="sm"
									bg={tab.active ? "panel.border" : "panel.elevated"}
								/>
							</VStack>
						))}
					</Flex>
				</Box>
			</Box>
		</Box>
	);
};
import {
	Badge,
	Box,
	Button,
	chakra,
	Flex,
	HStack,
	IconButton,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Portal,
	Stack,
	Text,
	VStack,
	useDisclosure,
} from "@chakra-ui/react";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	BellIcon,
	EnvelopeOpenIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import {
	createContext,
	type FC,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { getNotifications, markNotificationsRead } from "service/notifications";
import type { NotificationItem } from "types/Notification";

const BellIconStyled = chakra(BellIcon, { baseStyle: { w: 4, h: 4 } });

type NotificationContextValue = {
	unread: number;
	items: NotificationItem[];
	isOpen: boolean;
	onOpen: () => void;
	onClose: () => void;
	markAll: () => void;
	isMarkingAll: boolean;
	openItem: (item: NotificationItem) => void;
	incomingNotification: NotificationItem | null;
	dismissIncomingNotification: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const { t, i18n } = useTranslation();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { isOpen, onOpen, onClose } = useDisclosure();
	const [incomingNotification, setIncomingNotification] =
		useState<NotificationItem | null>(null);
	const previousItemsRef = useRef<number[] | null>(null);
	const initialFetchDone = useRef(false);

	const inbox = useQuery(
		["notifications", "bell"],
		() => getNotifications({ limit: 8 }),
		{
			refetchInterval: 25000,
			refetchOnWindowFocus: true,
		},
	);

	const markAllMutation = useMutation(() => markNotificationsRead({ all: true }), {
		onSuccess: () => queryClient.invalidateQueries("notifications"),
	});

	const markOneMutation = useMutation(
		(id: number) => markNotificationsRead({ ids: [id] }),
		{
			onSuccess: () => queryClient.invalidateQueries("notifications"),
		},
	);

	const unread = inbox.data?.unread ?? 0;
	const items = inbox.data?.items ?? [];

	useEffect(() => {
		if (!inbox.data) return;

		const currentIds = items.map((i) => i.id);

		if (!initialFetchDone.current) {
			initialFetchDone.current = true;
			previousItemsRef.current = currentIds;
			return;
		}

		if (previousItemsRef.current) {
			const previousIds = new Set(previousItemsRef.current);
			const newItems = items.filter(
				(i) => !previousIds.has(i.id) && i.read_at === null,
			);
			if (newItems.length > 0) {
				setIncomingNotification(newItems[0]);
			}
		}

		previousItemsRef.current = currentIds;
	}, [inbox.data, items]);

	useEffect(() => {
		if (!incomingNotification) return;
		const timer = setTimeout(() => {
			setIncomingNotification(null);
		}, 7000);
		return () => clearTimeout(timer);
	}, [incomingNotification]);

	const markAll = useCallback(() => {
		markAllMutation.mutate();
	}, [markAllMutation]);

	const openItem = useCallback(
		(item: NotificationItem) => {
			if (item.read_at === null) {
				markOneMutation.mutate(item.id);
			}
			onClose();
			navigate("/notifications");
		},
		[markOneMutation, navigate, onClose],
	);

	const dismissIncomingNotification = useCallback(() => {
		setIncomingNotification(null);
	}, []);

	const isRTL = i18n.dir(i18n.language) === "rtl";

	return (
		<NotificationContext.Provider
			value={{
				unread,
				items,
				isOpen,
				onOpen,
				onClose,
				markAll,
				isMarkingAll: markAllMutation.isLoading,
				openItem,
				incomingNotification,
				dismissIncomingNotification,
			}}
		>
			{children}

			<Portal>
				<AnimatePresence>
					{incomingNotification && (
						<Box
							position="fixed"
							top="16px"
							insetInlineEnd="16px"
							zIndex={10010}
							maxW="min(380px, calc(100vw - 32px))"
							w="full"
							pointerEvents="auto"
						>
							<motion.div
								initial={{ opacity: 0, y: -16, scale: 0.96 }}
								animate={{ opacity: 1, y: 0, scale: 1 }}
								exit={{ opacity: 0, y: -10, scale: 0.96 }}
								transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
							>
								<Box
									dir={isRTL ? "rtl" : "ltr"}
									p={3.5}
									borderRadius="16px"
									bg="panel.surface"
									borderWidth="1px"
									borderColor="var(--chakra-colors-accent)"
									boxShadow="0 8px 30px rgba(0, 0, 0, 0.16), 0 0 0 1px var(--chakra-colors-accent)"
									position="relative"
									overflow="hidden"
								>
									<HStack spacing={3} align="flex-start">
										<Flex
											w="34px"
											h="34px"
											borderRadius="10px"
											bg="var(--chakra-colors-accent)"
											color="white"
											align="center"
											justify="center"
											flexShrink={0}
										>
											<BellIconStyled />
										</Flex>
										<VStack align="flex-start" spacing={1} flex="1" minW="0">
											<HStack justify="space-between" w="full">
												<Text
													fontSize="13px"
													fontWeight="700"
													color="panel.text"
													noOfLines={1}
												>
													{incomingNotification.title}
												</Text>
												<IconButton
													size="xs"
													variant="ghost"
													aria-label={t("cancel")}
													icon={<XMarkIcon width={14} height={14} />}
													onClick={dismissIncomingNotification}
													borderRadius="full"
													h="22px"
													w="22px"
													minW="22px"
												/>
											</HStack>
											<Text
												fontSize="12px"
												color="panel.textSecondary"
												noOfLines={2}
												lineHeight="tall"
											>
												{incomingNotification.body}
											</Text>
											<Button
												size="xs"
												variant="ghost"
												color="var(--chakra-colors-accent)"
												fontWeight="600"
												px={0}
												h="auto"
												mt={1}
												_hover={{ bg: "transparent", textDecoration: "underline" }}
												onClick={() => {
													openItem(incomingNotification);
													dismissIncomingNotification();
												}}
											>
												{t("notifications.bell.label")}
											</Button>
										</VStack>
									</HStack>
								</Box>
							</motion.div>
						</Box>
					)}
				</AnimatePresence>
			</Portal>

			<Modal
				isOpen={isOpen}
				onClose={onClose}
				isCentered
				autoFocus={false}
				returnFocusOnClose={false}
				trapFocus={false}
				blockScrollOnMount={false}
			>
				<ModalOverlay bg="blackAlpha.600" backdropFilter="blur(8px)" />
				<ModalContent
					dir={isRTL ? "rtl" : "ltr"}
					bg="panel.surface"
					borderWidth="1px"
					borderColor="panel.border"
					borderRadius="20px"
					boxShadow="0 24px 60px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--chakra-colors-panel-border)"
					maxW={{ base: "calc(100vw - 28px)", sm: "460px" }}
					maxH="min(620px, calc(100vh - 80px))"
					my="auto"
					mx="auto"
					display="flex"
					flexDirection="column"
					overflow="hidden"
				>
					<ModalHeader
						borderBottomWidth="1px"
						borderColor="panel.border"
						p={4}
						bg="panel.surface"
					>
						<HStack justify="space-between" align="center">
							<HStack spacing={2.5}>
								<Flex
									w="32px"
									h="32px"
									borderRadius="10px"
									bg="panel.elevated"
									borderWidth="1px"
									borderColor="panel.border"
									align="center"
									justify="center"
									color="panel.text"
								>
									<BellIconStyled />
								</Flex>
								<Text fontSize="15px" fontWeight="700" color="panel.text">
									{t("notifications.menu")}
								</Text>
								{unread > 0 && (
									<Badge
										borderRadius="full"
										px={2}
										py={0.5}
										fontSize="11px"
										fontWeight="700"
										colorScheme="primary"
										bg="var(--chakra-colors-accent)"
										color="white"
									>
										{unread}
									</Badge>
								)}
							</HStack>
							<HStack spacing={1}>
								{unread > 0 && (
									<Button
										size="xs"
										variant="ghost"
										fontSize="11px"
										fontWeight="600"
										color="panel.textSecondary"
										_hover={{ bg: "panel.elevated", color: "panel.text" }}
										onClick={markAll}
										isLoading={markAllMutation.isLoading}
									>
										{t("notifications.inbox.markAllRead")}
									</Button>
								)}
								<ModalCloseButton
									position="static"
									size="sm"
									borderRadius="full"
									_hover={{ bg: "panel.elevated" }}
								/>
							</HStack>
						</HStack>
					</ModalHeader>

					<ModalBody p={3} overflowY="auto">
						{items.length === 0 ? (
							<Flex
								direction="column"
								align="center"
								justify="center"
								py={14}
								px={4}
								textAlign="center"
							>
								<Flex
									w="48px"
									h="48px"
									borderRadius="14px"
									bg="panel.elevated"
									borderWidth="1px"
									borderColor="panel.border"
									align="center"
									justify="center"
									color="panel.textMuted"
									mb={3}
								>
									<EnvelopeOpenIcon width={22} height={22} />
								</Flex>
								<Text fontSize="14px" fontWeight="600" color="panel.text" mb={1}>
									{t("notifications.bell.empty")}
								</Text>
							</Flex>
						) : (
							<Stack spacing={2}>
								{items.map((item) => {
									const isUnread = item.read_at === null;
									return (
										<Box
											key={item.id}
											as="button"
											textAlign="start"
											p={3}
											borderRadius="14px"
											borderWidth="1px"
											borderColor={isUnread ? "var(--chakra-colors-accent)" : "panel.border"}
											borderInlineStartWidth={isUnread ? "3px" : "1px"}
											borderInlineStartColor={
												isUnread ? "var(--chakra-colors-accent)" : "panel.border"
											}
											bg={isUnread ? "panel.elevated" : "panel.surface"}
											transition="all 0.16s cubic-bezier(0.16, 1, 0.3, 1)"
											_hover={{
												md: {
													borderColor: "panel.borderStrong",
													transform: "translateY(-1px)",
													boxShadow: "0 3px 10px rgba(0, 0, 0, 0.05)",
												},
											}}
											_active={{ transform: "scale(0.99)" }}
											onClick={() => openItem(item)}
										>
											<HStack justify="space-between" mb={1.5} align="center">
												<HStack spacing={2} minW={0}>
													{isUnread && (
														<Box
															w="6px"
															h="6px"
															borderRadius="full"
															bg="var(--chakra-colors-accent)"
															flexShrink={0}
														/>
													)}
													<Text
														fontSize="13px"
														fontWeight={isUnread ? "700" : "600"}
														color="panel.text"
														isTruncated
													>
														{item.title}
													</Text>
												</HStack>
												<Text
													fontSize="11px"
													color="panel.textMuted"
													flexShrink={0}
													dir="ltr"
													sx={{ unicodeBidi: "isolate", fontVariantNumeric: "tabular-nums" }}
												>
													{dayjs.unix(item.created_at).format("HH:mm · MM/DD")}
												</Text>
											</HStack>
											<Text
												fontSize="12px"
												color="panel.textSecondary"
												noOfLines={2}
												lineHeight="tall"
											>
												{item.body}
											</Text>
										</Box>
									);
								})}
							</Stack>
						)}
					</ModalBody>

					<ModalFooter
						borderTopWidth="1px"
						borderColor="panel.border"
						p={3}
						bg="panel.surface"
					>
						<Button
							w="full"
							size="sm"
							h="38px"
							borderRadius="12px"
							variant="outline"
							borderColor="panel.border"
							bg="panel.surface"
							color="panel.text"
							fontWeight="600"
							fontSize="13px"
							rightIcon={
								isRTL ? (
									<ArrowLeftIcon width={14} height={14} />
								) : (
									<ArrowRightIcon width={14} height={14} />
								)
							}
							_hover={{ md: { bg: "panel.elevated", borderColor: "panel.borderStrong" } }}
							_active={{ transform: "scale(0.98)" }}
							onClick={() => {
								onClose();
								navigate("/notifications");
							}}
						>
							{t("notifications.bell.viewAll")}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</NotificationContext.Provider>
	);
};

export const useNotificationCenter = () => {
	const context = useContext(NotificationContext);
	if (!context) {
		throw new Error("useNotificationCenter must be used within NotificationProvider");
	}
	return context;
};

export const NotificationMenuItem: FC<{ onBeforeOpen?: () => void }> = ({
	onBeforeOpen,
}) => {
	const { t } = useTranslation();
	const { unread, onOpen } = useNotificationCenter();

	return (
		<Button
			variant="ghost"
			w="full"
			h="38px"
			justifyContent="flex-start"
			fontWeight="500"
			fontSize="13px"
			borderRadius="12px"
			px={3}
			bg="transparent"
			color="panel.text"
			transition="all 0.16s cubic-bezier(0.2, 0, 0, 1)"
			_hover={{ md: { bg: "panel.elevated" } }}
			_active={{ bg: "panel.elevated", transform: "scale(0.98)" }}
			_focusVisible={{ bg: "panel.elevated" }}
			onClick={() => {
				if (onBeforeOpen) onBeforeOpen();
				onOpen();
			}}
		>
			<HStack justify="space-between" w="full" minW={0} spacing={2.5}>
				<HStack spacing={2.5} minW={0}>
					<BellIconStyled flexShrink={0} color="panel.text" />
					<Text noOfLines={1} color="panel.text">
						{t("notifications.menu")}
					</Text>
				</HStack>
				{unread > 0 && (
					<Badge
						borderRadius="full"
						px={2}
						py={0.5}
						fontSize="11px"
						fontWeight="700"
						bg="var(--chakra-colors-accent)"
						color="white"
					>
						{unread} {t("notifications.inbox.unread")}
					</Badge>
				)}
			</HStack>
		</Button>
	);
};

export const NotificationBell: FC = () => {
	const { t } = useTranslation();
	const { unread, onOpen } = useNotificationCenter();

	return (
		<Box position="relative" display="inline-flex">
			<IconButton
				aria-label={t("notifications.bell.label")}
				icon={<BellIcon width={18} height={18} />}
				size="sm"
				variant="ghost"
				h="34px"
				w="34px"
				borderRadius={{ base: "full", md: "12px" }}
				borderWidth="1px"
				borderColor="panel.border"
				bg="panel.surface"
				color="panel.textSecondary"
				_hover={{
					md: {
						bg: "panel.elevated",
						borderColor: "panel.borderStrong",
						color: "panel.text",
					},
				}}
				_active={{ transform: "scale(0.96)" }}
				onClick={onOpen}
			/>
			{unread > 0 && (
				<Box
					position="absolute"
					top="-2px"
					insetInlineEnd="-2px"
					w="9px"
					h="9px"
					borderRadius="full"
					bg="var(--chakra-colors-accent)"
					border="2px solid var(--chakra-colors-panel-surface)"
				/>
			)}
		</Box>
	);
};

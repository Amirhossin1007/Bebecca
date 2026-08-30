import {
	Box,
	Button,
	chakra,
	Collapse,
	HStack,
	IconButton,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalHeader,
	ModalOverlay,
	Text,
	useBreakpointValue,
	VStack,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	QrCodeIcon,
} from "@heroicons/react/24/outline";
import { QRCodeCanvas } from "qrcode.react";
import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "utils/clipboard";
import { getConfigLabelFromLink } from "utils/configLabel";
import { getSwipeTargetIndex } from "utils/carousel";
import { useDashboard } from "../contexts/DashboardContext";
import { Icon } from "./Icon";

const QRCode = chakra(QRCodeCanvas);
const NextIcon = chakra(ChevronRightIcon, {
	baseStyle: {
		w: 6,
		h: 6,
		color: "gray.600",
		_dark: {
			color: "white",
		},
	},
});
const PrevIcon = chakra(ChevronLeftIcon, {
	baseStyle: {
		w: 6,
		h: 6,
		color: "gray.600",
		_dark: {
			color: "white",
		},
	},
});
const QRIcon = chakra(QrCodeIcon, {
	baseStyle: {
		w: 5,
		h: 5,
	},
});

const clickPulse = keyframes`
	0% { transform: scale(1); }
	40% { transform: scale(0.94); }
	70% { transform: scale(1.04); }
	100% { transform: scale(1); }
`;

export const QRCodeDialog: FC = () => {
	const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
	const qrCodeUsername = useDashboard((state) => state.qrCodeUsername);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const subscribeUrl = useDashboard((state) => state.subscribeUrl);
	const isOpen = QRcodeLinks !== null;
	const [index, setIndex] = useState(0);
	const [copiedSub, setCopiedSub] = useState(false);
	const [copiedConfigIndex, setCopiedConfigIndex] = useState<number | null>(
		null,
	);
	const [configAnimIndex, setConfigAnimIndex] = useState<number | null>(null);
	const [subAnimSeed, setSubAnimSeed] = useState(0);
	const [configAnimSeed, setConfigAnimSeed] = useState(0);
	const [showConfigQrs, setShowConfigQrs] = useState(false);
	const touchStartX = useRef<number | null>(null);
	const suppressNextCopy = useRef(false);
	const { t } = useTranslation();
	const qrSize = useBreakpointValue({ base: 220, sm: 260, md: 300 }) ?? 220;
	const onClose = () => {
		setQRCode(null);
		setSubLink(null);
	};

	const copySubscribeLink = () => {
		void copyTextToClipboard(subscribeQrLink).then(() => {
			setCopiedSub(true);
			setSubAnimSeed((prev) => prev + 1);
		});
	};

	const copyConfigLink = (link: string, itemIndex: number) => {
		void copyTextToClipboard(link).then(() => {
			setCopiedConfigIndex(itemIndex);
			setConfigAnimIndex(itemIndex);
			setConfigAnimSeed((prev) => prev + 1);
		});
	};

	const subscribeQrLink = String(subscribeUrl).startsWith("/")
		? window.location.origin + subscribeUrl
		: String(subscribeUrl);

	const configItems = useMemo(() => {
		const links = QRcodeLinks ?? [];
		return links.map((link, itemIndex) => {
			const label =
				getConfigLabelFromLink(link) ||
				t("userDialog.links.configFallback", {
					index: itemIndex + 1,
				});
			return { link, label };
		});
	}, [QRcodeLinks, t]);

	const activeIndex =
		configItems.length > 0 ? Math.min(index, configItems.length - 1) : 0;
	const activeConfig = configItems[activeIndex];
	const activeConfigLabel = configItems[activeIndex]?.label ?? "";

	useEffect(() => {
		if (isOpen) {
			setIndex(0);
			setShowConfigQrs(false);
		}
	}, [isOpen]);

	useEffect(() => {
		if (index >= configItems.length && configItems.length > 0) {
			setIndex(0);
		}
	}, [index, configItems.length]);

	useEffect(() => {
		if (!isOpen) {
			setCopiedSub(false);
			setCopiedConfigIndex(null);
			setConfigAnimIndex(null);
		}
	}, [isOpen]);

	useEffect(() => {
		if (!copiedSub) return undefined;
		const timer = window.setTimeout(() => setCopiedSub(false), 1000);
		return () => window.clearTimeout(timer);
	}, [copiedSub]);

	useEffect(() => {
		if (copiedConfigIndex === null) return undefined;
		const timer = window.setTimeout(() => setCopiedConfigIndex(null), 1000);
		return () => window.clearTimeout(timer);
	}, [copiedConfigIndex]);

	return (
		<Modal isOpen={isOpen} onClose={onClose}>
			<ModalOverlay bg="blackAlpha.300" backdropFilter="blur(10px)" />
			<ModalContent
				mx={{ base: 3, md: 4 }}
				w="full"
				maxW="3xl"
				maxH="92vh"
				overflow="hidden"
			>
				<ModalHeader pt={6}>
					<HStack spacing={3} align="center">
						<Icon color="primary">
							<QRIcon color="white" />
						</Icon>
						{qrCodeUsername && (
							<Box minW={0}>
								<Text fontSize="xs" color="gray.500">
									{t("username")}
								</Text>
								<Text
									dir="ltr"
									fontSize="md"
									fontWeight="semibold"
									noOfLines={1}
								>
									{qrCodeUsername}
								</Text>
							</Box>
						)}
					</HStack>
				</ModalHeader>
				<ModalCloseButton mt={3} />
				{QRcodeLinks && (
					<ModalBody
						gap={{ base: 4, lg: 10 }}
						px={{ base: 4, sm: 6, lg: 10 }}
						pb={{ base: 5, md: 6 }}
						display="flex"
						justifyContent="center"
						flexDirection={{
							base: "column",
							lg: "row",
						}}
						overflowY="auto"
					>
						{subscribeUrl && (
							<VStack spacing={2}>
								<Text display="block" textAlign="center" fontWeight="semibold">
									{t("qrcodeDialog.sublink")}
								</Text>
								{copiedSub && (
									<Box
										bg="green.500"
										color="white"
										fontSize="xs"
										px={2}
										py={0.5}
										borderRadius="full"
									>
										{t("copied")}
									</Box>
								)}
								<Box
									key={`sub-qr-${subAnimSeed}`}
									cursor="pointer"
									role="button"
									tabIndex={0}
									aria-label={t("copy")}
									animation={
										copiedSub && subAnimSeed > 0
											? `${clickPulse} 260ms ease-in-out`
											: "none"
									}
									onClick={copySubscribeLink}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											copySubscribeLink();
										}
									}}
								>
									<QRCode
										mx="auto"
										maxW="100%"
										size={qrSize}
										p="2"
										level={"L"}
										includeMargin={false}
										value={subscribeQrLink}
										bg="white"
									/>
								</Box>
								<Text fontSize="xs" color="gray.500" textAlign="center">
									{t("qrcodeDialog.clickToCopy")}
								</Text>
							</VStack>
						)}
						{configItems.length > 0 && (
							<Box w={{ base: "full", lg: `${qrSize}px` }}>
								<Button
									w="full"
									size="sm"
									variant="outline"
									leftIcon={<QRIcon />}
									onClick={() => setShowConfigQrs((prev) => !prev)}
								>
									{showConfigQrs
										? t("qrcodeDialog.hideConfigs")
										: t("qrcodeDialog.showConfigs")}
								</Button>
								<Collapse in={showConfigQrs} animateOpacity>
									<Box pt={4}>
										<Text
											display="block"
											textAlign="center"
											fontWeight="semibold"
											mb={2}
										>
											{activeConfigLabel}
										</Text>
										{copiedConfigIndex === activeIndex && (
											<Box
												bg="green.500"
												color="white"
												fontSize="xs"
												px={2}
												py={0.5}
												borderRadius="full"
												mx="auto"
												mb={2}
												w="fit-content"
											>
												{t("copied")}
											</Box>
										)}
										<Box
											position="relative"
											onTouchStart={(event) => {
												touchStartX.current = event.touches[0]?.clientX ?? null;
												suppressNextCopy.current = false;
											}}
											onTouchEnd={(event) => {
												const startX = touchStartX.current;
												touchStartX.current = null;
												if (startX === null || configItems.length < 2) return;
												const delta =
													(event.changedTouches[0]?.clientX ?? startX) - startX;
												if (Math.abs(delta) < 40) return;
												suppressNextCopy.current = true;
												setIndex((current) =>
													getSwipeTargetIndex(current, configItems.length, delta),
												);
											}}
											onTouchCancel={() => {
												touchStartX.current = null;
											}}
										>
											<IconButton
												size="sm"
												position="absolute"
												left="-2"
												top="50%"
												transform="translateY(-50%)"
												zIndex={1}
												aria-label={t("a11y.previous")}
												isDisabled={configItems.length < 2}
												onClick={() =>
													setIndex((current) =>
														(current - 1 + configItems.length) % configItems.length,
													)
												}
											>
												<PrevIcon />
											</IconButton>
											{activeConfig && (
												<Box
													key={
														configAnimIndex === activeIndex
															? `qr-${activeIndex}-${configAnimSeed}`
															: `qr-${activeIndex}`
													}
													cursor="pointer"
													role="button"
													tabIndex={0}
													aria-label={t("copy")}
													animation={
														configAnimIndex === activeIndex && configAnimSeed > 0
															? `${clickPulse} 260ms ease-in-out`
															: "none"
													}
													onClick={() => {
														if (suppressNextCopy.current) {
															suppressNextCopy.current = false;
															return;
														}
														copyConfigLink(activeConfig.link, activeIndex);
													}}
													onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															copyConfigLink(activeConfig.link, activeIndex);
														}
													}}
												>
													<QRCode
														mx="auto"
														maxW="100%"
														size={qrSize}
														p="2"
														level="L"
														includeMargin={false}
														value={activeConfig.link}
														bg="white"
													/>
												</Box>
											)}
											<IconButton
												size="sm"
												position="absolute"
												right="-2"
												top="50%"
												transform="translateY(-50%)"
												zIndex={1}
												aria-label={t("a11y.next")}
												isDisabled={configItems.length < 2}
												onClick={() =>
													setIndex((current) => (current + 1) % configItems.length)
												}
											>
												<NextIcon />
											</IconButton>
										</Box>
										<Text display="block" textAlign="center" pb={3} mt={1}>
											{activeIndex + 1} / {configItems.length}
										</Text>
									</Box>
								</Collapse>
							</Box>
						)}
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
};

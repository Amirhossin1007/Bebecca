import type { CSSProperties } from "react";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Modal, ModalBody, ModalCloseButton, ModalContent, ModalHeader, ModalOverlay } from "components/shadcn/dialog";
import { Button, IconButton } from "components/shadcn/button";
import { Collapse } from "components/shadcn/collapse";
import { withClass } from "components/shadcn/icon";
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

const QRCode = withClass(QRCodeCanvas, "");
const NextIcon = withClass(ChevronRightIcon, "w-6 h-6 text-gray-600 dark:text-white");
const PrevIcon = withClass(ChevronLeftIcon, "w-6 h-6 text-gray-600 dark:text-white");
const QRIcon = withClass(QrCodeIcon, "w-5 h-5");

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
			<ModalOverlay className="bg-blackAlpha-300" />
			<ModalContent className="mx-3 md:mx-4 w-full max-w-[48rem] max-h-[92vh] overflow-hidden">
				<ModalHeader className="pt-6">
					<div className="flex flex-row gap-3 items-center">
						<Icon color="primary">
							<QRIcon className="text-white" />
						</Icon>
						{qrCodeUsername && (
							<div className="min-w-0!">
								<p className="text-[0.75rem] text-gray-500">
									{t("username")}
								</p>
								<p dir="ltr" className="text-[1rem] font-semibold truncate">
									{qrCodeUsername}
								</p>
							</div>
						)}
					</div>
				</ModalHeader>
				<ModalCloseButton className="mt-3" />
				{QRcodeLinks && (
					<ModalBody className="gap-4 lg:gap-10 px-4 sm:px-6 lg:px-10 pb-5 md:pb-6 flex justify-center flex-col lg:flex-row overflow-y-auto">
						{subscribeUrl && (
							<div className="flex flex-col items-center gap-2">
								<p className="block text-center font-semibold">
									{t("qrcodeDialog.sublink")}
								</p>
								{copiedSub && (
									<div className="bg-green-500 text-white text-[0.75rem] px-2 py-0.5 rounded-full">
										{t("copied")}
									</div>
								)}
								{/* biome-ignore lint/a11y/useSemanticElements: the QR card is a block-level click target; keyboard activation is handled */}
								<div key={`sub-qr-${subAnimSeed}`} role="button" tabIndex={0} aria-label={t("copy")} style={{ animation: copiedSub && subAnimSeed > 0 ? "rb-click-pulse 260ms ease-in-out" : "none" }} onClick={copySubscribeLink} onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											copySubscribeLink();
										}
									}} className="cursor-pointer">
									<QRCode size={qrSize} level={"L"} includeMargin={false} value={subscribeQrLink} className="mx-auto max-w-[100%] p-2 bg-white" />
								</div>
								<p className="text-[0.75rem] text-gray-500 text-center">
									{t("qrcodeDialog.clickToCopy")}
								</p>
							</div>
						)}
						{configItems.length > 0 && (
							<div className="w-full lg:w-(--qr-size)" style={{ "--qr-size": `${qrSize}px` } as CSSProperties}>
								<Button size="sm" variant="outline" leftIcon={<QRIcon />} onClick={() => setShowConfigQrs((prev) => !prev)} className="w-full">
									{showConfigQrs
										? t("qrcodeDialog.hideConfigs")
										: t("qrcodeDialog.showConfigs")}
								</Button>
								<Collapse in={showConfigQrs} animateOpacity>
									<div className="pt-4">
										<p className="block text-center font-semibold mb-2">
											{activeConfigLabel}
										</p>
										{copiedConfigIndex === activeIndex && (
											<div className="bg-green-500 text-white text-[0.75rem] px-2 py-0.5 rounded-full mx-auto mb-2 w-fit">
												{t("copied")}
											</div>
										)}
										<div onTouchStart={(event) => {
												touchStartX.current = event.touches[0]?.clientX ?? null;
												suppressNextCopy.current = false;
											}} onTouchEnd={(event) => {
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
											}} onTouchCancel={() => {
												touchStartX.current = null;
											}} className="relative">
											<IconButton variant="solid" size="sm" aria-label={t("a11y.previous")} isDisabled={configItems.length < 2} onClick={() =>
													setIndex((current) =>
														(current - 1 + configItems.length) % configItems.length,
													)
												} className="absolute left-0 top-[calc(100%_+_4px)] z-[1]">
												<PrevIcon />
											</IconButton>
											{activeConfig && (
												// biome-ignore lint/a11y/useSemanticElements: the QR card is a block-level click target; keyboard activation is handled
												<div key={
														configAnimIndex === activeIndex
															? `qr-${activeIndex}-${configAnimSeed}`
															: `qr-${activeIndex}`
													} role="button" tabIndex={0} aria-label={t("copy")} style={{ animation: configAnimIndex === activeIndex && configAnimSeed > 0 ? "rb-click-pulse 260ms ease-in-out" : "none" }} onClick={() => {
														if (suppressNextCopy.current) {
															suppressNextCopy.current = false;
															return;
														}
														copyConfigLink(activeConfig.link, activeIndex);
													}} onKeyDown={(event) => {
														if (event.key === "Enter" || event.key === " ") {
															event.preventDefault();
															copyConfigLink(activeConfig.link, activeIndex);
														}
													}} className="cursor-pointer">
													<QRCode size={qrSize} level="L" includeMargin={false} value={activeConfig.link} className="mx-auto max-w-[100%] p-2 bg-white" />
												</div>
											)}
											<IconButton variant="solid" size="sm" aria-label={t("a11y.next")} isDisabled={configItems.length < 2} onClick={() =>
													setIndex((current) => (current + 1) % configItems.length)
												} className="absolute right-0 top-[calc(100%_+_4px)] z-[1]">
												<NextIcon />
											</IconButton>
										</div>
										<p className="block text-center pb-3 mt-1">
											{activeIndex + 1} / {configItems.length}
										</p>
									</div>
								</Collapse>
							</div>
						)}
					</ModalBody>
				)}
			</ModalContent>
		</Modal>
	);
};

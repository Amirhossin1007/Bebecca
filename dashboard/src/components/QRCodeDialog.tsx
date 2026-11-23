import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { useDashboard } from "contexts/DashboardContext";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { cn } from "lib/cn";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Copy,
	QrCode,
	X,
} from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSwipeTargetIndex } from "utils/carousel";
import { copyTextToClipboard } from "utils/clipboard";
import { getConfigLabelFromLink } from "utils/configLabel";

type QRCopyPanelProps = {
	value: string;
	size: number;
	label: string;
	onSwipe?: (delta: number) => void;
};

const QRCopyPanel = ({ value, size, label, onSwipe }: QRCopyPanelProps) => {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);
	const qrRef = useRef<HTMLButtonElement>(null);
	const touchStartX = useRef<number | null>(null);
	const swiped = useRef(false);

	useEffect(() => {
		if (!copied) return undefined;
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const copyText = () =>
		copyTextToClipboard(value)
			.then(() => setCopied(true))
			.catch(() => undefined);

	const copyQrImage = async () => {
		const canvas = qrRef.current?.querySelector("canvas");
		if (!canvas || !navigator.clipboard?.write) return copyText();
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/png"),
		);
		if (!blob) return copyText();
		await navigator.clipboard
			.write([new ClipboardItem({ "image/png": blob })])
			.then(() => setCopied(true))
			.catch(() => undefined);
	};

	return (
		<div className="flex w-full flex-col items-center gap-4">
			<button
				ref={qrRef}
				type="button"
				aria-label={label}
				onClick={() => {
					if (swiped.current) {
						swiped.current = false;
						return;
					}
					void copyQrImage();
				}}
				onTouchStart={(event) => {
					touchStartX.current = event.touches[0]?.clientX ?? null;
					swiped.current = false;
				}}
				onTouchEnd={(event) => {
					const startX = touchStartX.current;
					touchStartX.current = null;
					if (startX === null || !onSwipe) return;
					const delta = (event.changedTouches[0]?.clientX ?? startX) - startX;
					if (Math.abs(delta) < 40) return;
					swiped.current = true;
					onSwipe(delta);
				}}
				className="rounded-2xl bg-white p-3.5 shadow-md ring-1 ring-black/5 transition-transform active:scale-95 cursor-pointer"
			>
				<QRCodeCanvas
					value={value}
					size={size}
					level="M"
					includeMargin={false}
				/>
			</button>

			<div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3 py-2">
				<p
					dir="ltr"
					title={value}
					className="min-w-0 flex-1 truncate font-mono text-xs text-panel-text-secondary select-all"
				>
					{value}
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => void copyText()}
					className="h-8 shrink-0 gap-1.5 rounded-xl border-panel-border bg-panel-card text-xs font-medium"
				>
					{copied ? (
						<Check className="size-3.5 text-emerald-500" />
					) : (
						<Copy className="size-3.5" />
					)}
					<span>{copied ? t("copied") : t("copy")}</span>
				</Button>
			</div>
		</div>
	);
};

export const QRCodeDialog: FC = () => {
	const { t } = useTranslation();
	const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
	const qrCodeUsername = useDashboard((state) => state.qrCodeUsername);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const subscribeUrl = useDashboard((state) => state.subscribeUrl);
	const [configIndex, setConfigIndex] = useState(0);
	const [activeTab, setActiveTab] = useState<"subscription" | "configs">(
		"subscription",
	);
	const qrSize = useBreakpointValue({ base: 200, sm: 220 }) ?? 200;

	const configItems = useMemo(
		() =>
			(QRcodeLinks ?? []).map((link, itemIndex) => ({
				link,
				label:
					getConfigLabelFromLink(link) ||
					t("userDialog.links.configFallback", { index: itemIndex + 1 }),
			})),
		[QRcodeLinks, t],
	);

	const activeIndex = Math.min(
		configIndex,
		Math.max(configItems.length - 1, 0),
	);
	const activeConfig = configItems[activeIndex];
	const hasSubscription = Boolean(subscribeUrl);
	const subscribeQrLink = String(subscribeUrl).startsWith("/")
		? window.location.origin + subscribeUrl
		: String(subscribeUrl);

	const onClose = () => {
		setQRCode(null);
		setSubLink(null);
	};

	const stepConfig = (step: number) =>
		setConfigIndex(
			(current) => (current + step + configItems.length) % configItems.length,
		);

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-md overflow-hidden rounded-[20px] border border-panel-border bg-panel-card p-0 shadow-2xl z-[1500]">
				<DialogHeader className="flex flex-row items-center justify-between border-b border-panel-border px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
							<QrCode className="size-4" />
						</div>
						<div>
							<DialogTitle className="text-sm font-bold text-panel-text">
								{t("usersTable.qrCode")}
							</DialogTitle>
							{qrCodeUsername && (
								<p
									dir="ltr"
									className="text-[11px] font-mono text-panel-text-secondary text-start"
								>
									{qrCodeUsername}
								</p>
							)}
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex size-8 items-center justify-center rounded-xl border border-panel-border/70 text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text cursor-pointer active:scale-95"
					>
						<X className="size-4" />
					</button>
				</DialogHeader>

				{hasSubscription && configItems.length > 0 && (
					<div className="border-b border-panel-border px-6 py-2 bg-panel-surface/40">
						<div className="flex items-center rounded-xl border border-panel-border bg-panel-surface p-1">
							<button
								type="button"
								onClick={() => setActiveTab("subscription")}
								className={cn(
									"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer",
									activeTab === "subscription"
										? "bg-panel-accent text-white shadow-xs"
										: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
								)}
							>
								{t("userDialog.links.subscription")}
							</button>
							<button
								type="button"
								onClick={() => setActiveTab("configs")}
								className={cn(
									"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all cursor-pointer",
									activeTab === "configs"
										? "bg-panel-accent text-white shadow-xs"
										: "text-panel-text-secondary min-[769px]:hover:text-panel-text",
								)}
							>
								{t("userDialog.links.configs")}
							</button>
						</div>
					</div>
				)}

				<div className="px-6 py-5">
					{(!hasSubscription || activeTab === "configs") && activeConfig ? (
						<div className="flex w-full flex-col gap-4">
							<div className="flex items-center justify-between gap-3">
								<button
									type="button"
									disabled={configItems.length < 2}
									onClick={() => stepConfig(-1)}
									className="flex size-8 items-center justify-center rounded-xl border border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
								>
									<ChevronLeft className="rtl:rotate-180 size-4" />
								</button>
								<div className="min-w-0 text-center">
									<p className="truncate text-xs font-semibold text-panel-text">
										{activeConfig.label}
									</p>
									<p className="text-[11px] tabular-nums text-panel-text-muted">
										{activeIndex + 1} / {configItems.length}
									</p>
								</div>
								<button
									type="button"
									disabled={configItems.length < 2}
									onClick={() => stepConfig(1)}
									className="flex size-8 items-center justify-center rounded-xl border border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
								>
									<ChevronRight className="rtl:rotate-180 size-4" />
								</button>
							</div>
							<QRCopyPanel
								key={activeIndex}
								value={activeConfig.link}
								size={qrSize}
								label={t("a11y.copyConfig")}
								onSwipe={
									configItems.length > 1
										? (delta) =>
												setConfigIndex((current) =>
													getSwipeTargetIndex(
														current,
														configItems.length,
														delta,
													),
												)
										: undefined
								}
							/>
						</div>
					) : (
						<QRCopyPanel
							value={subscribeQrLink}
							size={qrSize}
							label={t("a11y.copySubscriptionLink")}
						/>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};

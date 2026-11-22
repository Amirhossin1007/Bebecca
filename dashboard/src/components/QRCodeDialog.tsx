import { buttonVariants } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { toast } from "components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "components/ui/tabs";
import { useDashboard } from "contexts/DashboardContext";
import { useBreakpointValue } from "hooks/useBreakpointValue";
import { cn } from "lib/cn";
import { Check, ChevronLeft, ChevronRight, Copy } from "lucide-react";
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
		const timer = window.setTimeout(() => setCopied(false), 2000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	const copyText = () =>
		copyTextToClipboard(value)
			.then(() => {
				setCopied(true);
				toast.success(t("copied"), { duration: 2000 });
			})
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
			.then(() => {
				setCopied(true);
				toast.success(t("copied"), { duration: 2000 });
			})
			.catch(() => copyText());
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
				className="rounded-[18px] bg-white p-3.5 shadow-md ring-1 ring-black/10 transition-transform active:scale-[0.98] touch-manipulation cursor-pointer"
			>
				<QRCodeCanvas
					value={value}
					size={size}
					level="M"
					fgColor="#0a0a0a"
					bgColor="#ffffff"
					includeMargin={false}
				/>
			</button>
			<div className="flex w-full min-w-0 items-center gap-2 rounded-xl border border-panel-border bg-panel-surface px-3 py-2">
				<p
					dir="ltr"
					title={value}
					className="min-w-0 flex-1 truncate font-mono text-xs text-panel-text-muted [unicode-bidi:isolate]"
				>
					{value}
				</p>
				<button
					type="button"
					onClick={() => void copyText()}
					className={cn(
						buttonVariants({ variant: "outline", size: "sm" }),
						"h-8 shrink-0 gap-1.5 rounded-lg border-panel-border text-xs min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation",
					)}
				>
					{copied ? (
						<Check className="size-3.5 text-emerald-500" />
					) : (
						<Copy className="size-3.5" />
					)}
					<span>{copied ? t("copied") : t("copy")}</span>
				</button>
			</div>
		</div>
	);
};

export const QRCodeDialog: FC = () => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir() === "rtl";
	const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
	const qrCodeUsername = useDashboard((state) => state.qrCodeUsername);
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const subscribeUrl = useDashboard((state) => state.subscribeUrl);
	const [configIndex, setConfigIndex] = useState(0);
	const qrSize = useBreakpointValue({ base: 190, sm: 220 }) ?? 190;

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

	const subscriptionView = (
		<QRCopyPanel
			value={subscribeQrLink}
			size={qrSize}
			label={t("a11y.copySubscriptionLink")}
		/>
	);

	const configsView = activeConfig && (
		<div className="flex w-full flex-col gap-4">
			<div className="flex items-center justify-between gap-3">
				<button
					type="button"
					aria-label={t("a11y.previous")}
					disabled={configItems.length < 2}
					onClick={() => stepConfig(-1)}
					className={cn(
						buttonVariants({ variant: "outline", size: "icon" }),
						"size-8 rounded-lg border-panel-border",
					)}
				>
					<ChevronLeft className="size-4 rtl:rotate-180" />
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
					aria-label={t("a11y.next")}
					disabled={configItems.length < 2}
					onClick={() => stepConfig(1)}
					className={cn(
						buttonVariants({ variant: "outline", size: "icon" }),
						"size-8 rounded-lg border-panel-border",
					)}
				>
					<ChevronRight className="size-4 rtl:rotate-180" />
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
									getSwipeTargetIndex(current, configItems.length, delta),
								)
						: undefined
				}
			/>
		</div>
	);

	const renderBody = () => {
		if (hasSubscription && configItems.length > 0) {
			return (
				<Tabs
					defaultValue="subscription"
					dir={isRTL ? "rtl" : "ltr"}
					className="w-full"
				>
					<TabsList className="w-full rounded-xl bg-panel-surface p-1">
						<TabsTrigger
							value="subscription"
							className="flex-1 rounded-lg text-xs data-[state=active]:bg-panel-elevated"
						>
							{t("userDialog.links.subscription")}
						</TabsTrigger>
						<TabsTrigger
							value="configs"
							className="flex-1 rounded-lg text-xs data-[state=active]:bg-panel-elevated"
						>
							{t("userDialog.links.configs")}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="subscription" className="pt-4">
						{subscriptionView}
					</TabsContent>
					<TabsContent value="configs" className="pt-4">
						{configsView}
					</TabsContent>
				</Tabs>
			);
		}
		if (hasSubscription) return subscriptionView;
		if (configsView) return configsView;
		return (
			<p className="py-6 text-center text-xs text-panel-text-muted">
				{t("userDialog.links.noConfigs")}
			</p>
		);
	};

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<DialogContent
				dir={isRTL ? "rtl" : "ltr"}
				className="max-h-[min(560px,calc(100dvh-6rem))] max-w-[420px] gap-0 overflow-hidden rounded-[20px] border-panel-border bg-panel-elevated p-0 shadow-2xl"
			>
				<DialogHeader className="border-b border-panel-border px-5 py-3.5 text-start">
					<DialogTitle className="text-base font-semibold text-panel-text">
						{t("usersTable.qrCode")}
					</DialogTitle>
					{qrCodeUsername && (
						<DialogDescription
							dir="ltr"
							className="truncate text-xs font-mono text-panel-text-muted"
						>
							@{qrCodeUsername}
						</DialogDescription>
					)}
				</DialogHeader>
				<div className="overflow-y-auto px-5 py-4">{renderBody()}</div>
			</DialogContent>
		</Dialog>
	);
};

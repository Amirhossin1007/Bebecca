import { Badge } from "components/ui/badge";
import { Check, Copy, QrCode } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "utils/clipboard";

type LinkItem = {
	key: string;
	label: string;
	url: string;
	isSub?: boolean;
};

type UserLinksTabProps = {
	links: LinkItem[];
	onOpenQr: (url: string) => void;
};

export const UserLinksTab: FC<UserLinksTabProps> = ({ links, onOpenQr }) => {
	const { t } = useTranslation();
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const handleCopy = async (key: string, text: string) => {
		try {
			await copyTextToClipboard(text);
			setCopiedKey(key);
			window.setTimeout(() => setCopiedKey(null), 1500);
		} catch {
		}
	};

	const handleCopyAll = async () => {
		const allText = links.map((l) => l.url).join("\n");
		await handleCopy("all", allText);
	};

	const subLinks = links.filter((l) => l.isSub);
	const configLinks = links.filter((l) => !l.isSub);

	return (
		<div className="flex flex-col gap-4">
			{subLinks.length > 0 && (
				<div className="flex flex-col gap-2.5 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-xs">
					<div className="flex items-center justify-between pb-2 border-b border-panel-border/60">
						<span className="text-xs font-semibold text-panel-text uppercase tracking-wider">
							{t("userDialog.links.subscription")}
						</span>
						<Badge
							variant="outline"
							className="border-panel-accent/40 bg-panel-accent/10 text-panel-accent text-[10px]"
						>
							{t("userDialog.links.recommended")}
						</Badge>
					</div>

					<div className="flex flex-col gap-2">
						{subLinks.map((item) => (
							<div
								key={item.key}
								className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-card p-2.5"
							>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium text-panel-text truncate">
										{item.label}
									</p>
									<p
										dir="ltr"
										className="text-[11px] font-mono text-panel-text-muted truncate select-all"
									>
										{item.url}
									</p>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										type="button"
										onClick={() => handleCopy(item.key, item.url)}
										className="flex size-7 items-center justify-center rounded-lg border border-panel-border/70 bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
									>
										{copiedKey === item.key ? (
											<Check className="size-3.5 text-emerald-500" />
										) : (
											<Copy className="size-3.5" />
										)}
									</button>
									<button
										type="button"
										onClick={() => onOpenQr(item.url)}
										className="flex size-7 items-center justify-center rounded-lg border border-panel-border/70 bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
									>
										<QrCode className="size-3.5" />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="flex flex-col gap-2.5 rounded-2xl border border-panel-border bg-panel-surface p-4 shadow-xs">
				<div className="flex items-center justify-between pb-2 border-b border-panel-border/60">
					<span className="text-xs font-semibold text-panel-text uppercase tracking-wider">
						{t("userDialog.links.configs")}
					</span>
					{configLinks.length > 1 && (
						<button
							type="button"
							onClick={handleCopyAll}
							className="text-[11px] font-semibold text-panel-accent transition-colors min-[769px]:hover:underline cursor-pointer"
						>
							{copiedKey === "all"
								? t("copied")
								: t("userDialog.links.copyAllConfigs")}
						</button>
					)}
				</div>

				{configLinks.length === 0 ? (
					<p className="text-xs text-panel-text-muted py-4 text-center">
						{t("userDialog.links.noConfigs")}
					</p>
				) : (
					<div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pe-1">
						{configLinks.map((item) => (
							<div
								key={item.key}
								className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-card p-2.5"
							>
								<div className="min-w-0 flex-1">
									<p className="text-xs font-medium text-panel-text truncate">
										{item.label}
									</p>
									<p
										dir="ltr"
										className="text-[11px] font-mono text-panel-text-muted truncate select-all"
									>
										{item.url}
									</p>
								</div>
								<div className="flex items-center gap-1 shrink-0">
									<button
										type="button"
										onClick={() => handleCopy(item.key, item.url)}
										className="flex size-7 items-center justify-center rounded-lg border border-panel-border/70 bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
									>
										{copiedKey === item.key ? (
											<Check className="size-3.5 text-emerald-500" />
										) : (
											<Copy className="size-3.5" />
										)}
									</button>
									<button
										type="button"
										onClick={() => onOpenQr(item.url)}
										className="flex size-7 items-center justify-center rounded-lg border border-panel-border/70 bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-accent cursor-pointer active:scale-95"
									>
										<QrCode className="size-3.5" />
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

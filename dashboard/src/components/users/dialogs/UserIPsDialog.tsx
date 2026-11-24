import { Button } from "components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "components/ui/dialog";
import { Check, Copy, Globe, X } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import { copyTextToClipboard } from "utils/clipboard";

export type UserIPRecord = {
	ip: string;
	operator_short_name?: string;
	operator_owner?: string;
};

type UserIPsDialogProps = {
	isOpen: boolean;
	username: string;
	records: UserIPRecord[];
	error?: string | null;
	onClose: () => void;
};

export const UserIPsDialog: FC<UserIPsDialogProps> = ({
	isOpen,
	username,
	records,
	error,
	onClose,
}) => {
	const { t } = useTranslation();
	const [copied, setCopied] = useState(false);

	const handleCopyAll = async () => {
		const text = records.map((r) => r.ip).join("\n");
		try {
			await copyTextToClipboard(text);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-md overflow-hidden rounded-[20px] border border-panel-border bg-panel-card p-0 shadow-2xl z-[1500]">
				<DialogHeader className="flex flex-row items-center justify-between border-b border-panel-border px-6 py-4">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-xl bg-panel-accent/10 text-panel-accent">
							<Globe className="size-4" />
						</div>
						<div>
							<DialogTitle className="text-sm font-bold text-panel-text">
								{t("usersTable.ipsDialogTitle")}
							</DialogTitle>
							<p
								dir="ltr"
								className="text-[11px] font-mono text-panel-text-secondary text-start"
							>
								{username}
							</p>
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

				<div className="max-h-[340px] overflow-y-auto px-6 py-4">
					{error ? (
						<div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
							{error}
						</div>
					) : records.length === 0 ? (
						<p className="py-6 text-center text-xs text-panel-text-muted">
							{t("usersTable.noIpsFound")}
						</p>
					) : (
						<div className="flex flex-col gap-2">
							{records.map((r, i) => (
								<div
									key={`${r.ip}-${i}`}
									className="flex items-center justify-between rounded-[12px] border border-panel-border bg-panel-surface p-2.5 text-xs font-mono"
								>
									<span className="font-semibold text-panel-text select-all">
										{r.ip}
									</span>
									<span className="text-[11px] text-panel-text-muted">
										{r.operator_short_name || r.operator_owner || ""}
									</span>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="flex items-center justify-between border-t border-panel-border px-6 py-3 bg-panel-surface/60">
					{records.length > 0 && (
						<Button
							type="button"
							variant="outline"
							onClick={handleCopyAll}
							className="h-8 gap-1.5 rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium"
						>
							{copied ? (
								<Check className="size-3.5 text-emerald-500" />
							) : (
								<Copy className="size-3.5" />
							)}
							<span>{copied ? t("copied") : t("copy")}</span>
						</Button>
					)}
					<Button
						type="button"
						variant="outline"
						onClick={onClose}
						className="h-8 ms-auto rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium"
					>
						{t("close")}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};

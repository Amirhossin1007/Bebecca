import { Button } from "components/ui/button";
import { useDashboard } from "contexts/DashboardContext";
import { Globe, Pencil, QrCode, Copy, Check } from "lucide-react";
import { type FC, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "types/User";
import { formatDateTime } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";
import { toast } from "components/ui/sonner";

export type UserExpandedDetailProps = {
	user: UserListItem;
	onEdit?: () => void;
	onGetIps?: () => void;
	actionButtons?: ReactNode;
};

export const UserExpandedDetail: FC<UserExpandedDetailProps> = ({
	user,
	onEdit,
	onGetIps,
	actionButtons,
}) => {
	const { t, i18n } = useTranslation();
	const locale = i18n.language || "en";
	const setQRCode = useDashboard((s) => s.setQRCode);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const copyToClipboard = (text: string, key: string, label: string) => {
		navigator.clipboard.writeText(text);
		setCopiedKey(key);
		toast.success(label);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	const getResetStrategyLabel = (strategy: string | null | undefined) => {
		switch (strategy) {
			case "day":
				return t("userDialog.resetStrategyDaily");
			case "week":
				return t("userDialog.resetStrategyWeekly");
			case "month":
				return t("userDialog.resetStrategyMonthly");
			case "year":
				return t("userDialog.resetStrategyAnnually");
			default:
				return t("userDialog.resetStrategyNo");
		}
	};

	return (
		<div className="flex flex-col gap-4 rounded-[16px] border border-panel-border/70 bg-panel-elevated/25 p-4 sm:p-5">
			<div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-5 text-xs">
				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium text-panel-text-muted">
						{t("usersTable.createdAt")}
					</span>
					<span className="font-medium text-panel-text tabular-nums [unicode-bidi:isolate]">
						{formatDateTime(user.created_at, locale)}
					</span>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium text-panel-text-muted">
						{t("usersTable.admin")}
					</span>
					<span className="font-medium text-panel-text">
						{user.admin_username || "—"}
					</span>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium text-panel-text-muted">
						{t("usersTable.lifetimeUsage")}
					</span>
					<span dir="ltr" className="font-mono font-medium text-panel-text tabular-nums [unicode-bidi:isolate] text-start">
						{formatBytes(user.lifetime_used_traffic ?? user.used_traffic, 1)}
					</span>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium text-panel-text-muted">
						{t("bulkActions.delete.lastOnline")}
					</span>
					<span className="font-medium text-panel-text tabular-nums [unicode-bidi:isolate]">
						{user.online_at ? formatDateTime(user.online_at, locale) : "—"}
					</span>
				</div>

				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium text-panel-text-muted">
						{t("USERDIALOG.RESET_TRAFFIC_PERIODIC", "Reset Strategy")}
					</span>
					<span className="font-medium text-panel-text">
						{getResetStrategyLabel(user.data_limit_reset_strategy)}
					</span>
				</div>

				{user.group?.name && (
					<div className="flex flex-col gap-1">
						<span className="text-[11px] font-medium text-panel-text-muted">
							{t("labels.group")}
						</span>
						<span className="font-medium text-panel-text">
							{user.group.name}
						</span>
					</div>
				)}

				{user.tags && user.tags.length > 0 && (
					<div className="flex flex-col gap-1 col-span-2">
						<span className="text-[11px] font-medium text-panel-text-muted">
							{t("labels.tags")}
						</span>
						<div className="flex flex-wrap gap-1">
							{user.tags.map((tag) => (
								<span
									key={tag}
									className="inline-flex items-center rounded-md bg-panel-elevated px-1.5 py-0.5 text-[10px] font-medium text-panel-text-secondary border border-panel-border/50"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-panel-border/60">
				{actionButtons}

				{user.subscription_url && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() =>
							copyToClipboard(
								user.subscription_url || "",
								"sub",
								t("userRowActions.copySub"),
							)
						}
						className="h-8 gap-1.5 rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
					>
						{copiedKey === "sub" ? (
							<Check className="size-3.5 text-emerald-500" />
						) : (
							<Copy className="size-3.5 text-panel-text-muted" />
						)}
						<span>{t("userRowActions.copySub")}</span>
					</Button>
				)}

				{onGetIps && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onGetIps}
						className="h-8 gap-1.5 rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
					>
						<Globe className="size-3.5 text-blue-500" />
						<span>{t("usersTable.ipsDialogTitle")}</span>
					</Button>
				)}

				{user.subscription_url && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setQRCode([user.subscription_url || ""], user.username)}
						className="h-8 gap-1.5 rounded-[12px] border-panel-border bg-panel-surface text-xs font-medium text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated active:scale-[0.98] touch-manipulation"
					>
						<QrCode className="size-3.5 text-purple-500" />
						<span>{t("usersTable.qrCode")}</span>
					</Button>
				)}

				{onEdit && (
					<Button
						type="button"
						size="sm"
						onClick={onEdit}
						className="h-8 gap-1.5 rounded-[12px] bg-panel-accent text-xs font-semibold text-white shadow-xs transition-colors min-[769px]:hover:bg-panel-accent/90 active:scale-[0.98] touch-manipulation"
					>
						<Pencil className="size-3.5" />
						<span>{t("edit")}</span>
					</Button>
				)}
			</div>
		</div>
	);
};

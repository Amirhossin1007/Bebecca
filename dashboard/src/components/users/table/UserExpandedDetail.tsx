import { Badge } from "components/ui/badge";
import { Button } from "components/ui/button";
import { useDashboard } from "contexts/DashboardContext";
import { Globe, Pencil, QrCode } from "lucide-react";
import type { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";

export type SpecCard = {
	id: string;
	label: string;
	value: ReactNode;
};

export type UserExpandedDetailProps = {
	user: UserListItem;
	onEdit?: () => void;
	onGetIps?: () => void;
	specCards?: SpecCard[];
	actionButtons?: ReactNode;
};

export const UserExpandedDetail: FC<UserExpandedDetailProps> = ({
	user,
	onEdit,
	onGetIps,
	specCards,
	actionButtons,
}) => {
	const { t } = useTranslation();
	const setQRCode = useDashboard((s) => s.setQRCode);

	const cards: SpecCard[] = specCards ?? [
		{
			id: "username",
			label: t("username"),
			value: (
				<span dir="ltr" className="font-mono">
					{user.username}
				</span>
			),
		},
		{
			id: "status",
			label: t("usersTable.status"),
			value: (
				<Badge variant="outline" className="text-[10px]">
					{t(`status.${user.status}`)}
				</Badge>
			),
		},
		{
			id: "used_traffic",
			label: t("usersTable.traffic"),
			value: (
				<span>
					{formatBytes(user.used_traffic, 2)}
					{user.data_limit ? ` / ${formatBytes(user.data_limit, 2)}` : ""}
				</span>
			),
		},
		{
			id: "lifetime_usage",
			label: t("usersTable.lifetimeUsage"),
			value: (
				<span>
					{formatBytes(user.lifetime_used_traffic ?? user.used_traffic, 2)}
				</span>
			),
		},
		{
			id: "expire",
			label: t("usersTable.expire"),
			value: (
				<span>
					{user.expire
						? relativeExpiryDate(user.expire)?.time || "-"
						: t("userDialog.unlimited")}
				</span>
			),
		},
		{
			id: "service",
			label: t("usersTable.service"),
			value: <span>{user.service_name || "-"}</span>,
		},
		{
			id: "admin",
			label: t("usersTable.admin"),
			value: <span>{user.admin_username || "-"}</span>,
		},
		{
			id: "created_at",
			label: t("usersTable.createdAt", "Created at"),
			value: (
				<span dir="ltr" className="font-mono text-[11px]">
					{user.created_at || "-"}
				</span>
			),
		},
	];

	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-elevated/40 p-4 shadow-sm sm:p-5">
			<div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
				{cards.map((card) => (
					<div
						key={card.id}
						className="flex min-w-0 flex-col gap-1 rounded-xl border border-panel-border/60 bg-panel-surface p-3 transition-colors"
					>
						<span className="truncate text-[11px] font-medium text-panel-text-muted">
							{card.label}
						</span>
						<div className="min-w-0 truncate text-xs font-semibold tabular-nums text-panel-text">
							{card.value}
						</div>
					</div>
				))}
			</div>

			<div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-panel-border/60">
				{actionButtons}
				{onGetIps && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onGetIps}
						className="h-8 gap-1.5 rounded-xl border-panel-border bg-panel-surface text-xs font-medium text-panel-text"
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
						onClick={() => setQRCode([user.subscription_url], user.username)}
						className="h-8 gap-1.5 rounded-xl border-panel-border bg-panel-surface text-xs font-medium text-panel-text"
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
						className="h-8 gap-1.5 rounded-xl bg-panel-accent text-xs font-semibold text-white shadow-xs"
					>
						<Pencil className="size-3.5" />
						<span>{t("edit")}</span>
					</Button>
				)}
			</div>
		</div>
	);
};

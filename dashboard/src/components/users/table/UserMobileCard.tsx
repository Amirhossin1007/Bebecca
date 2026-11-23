import { Badge } from "components/ui/badge";
import { Checkbox } from "components/ui/checkbox";
import { cn } from "lib/cn";
import { ChevronDown, ChevronUp, User as UserIcon } from "lucide-react";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { formatBytes } from "utils/formatByte";
import { UserExpandedDetail } from "./UserExpandedDetail";
import { UserRowActions } from "./UserRowActions";

type UserMobileCardProps = {
	user: UserListItem;
	isSelected: boolean;
	isOnline?: boolean;
	onToggleSelect: () => void;
	onEdit: () => void;
	onGetIps: () => void;
};

export const UserMobileCard: FC<UserMobileCardProps> = ({
	user,
	isSelected,
	isOnline,
	onToggleSelect,
	onEdit,
	onGetIps,
}) => {
	const { t } = useTranslation();
	const [isExpanded, setIsExpanded] = useState(false);

	const used = user.used_traffic ?? 0;
	const limit = user.data_limit ?? 0;
	const percent =
		limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
	const expiryInfo = user.expire ? relativeExpiryDate(user.expire) : null;
	const expiryText = expiryInfo?.time || t("userDialog.unlimited");

	const getStatusColor = (status: string) => {
		switch (status) {
			case "active":
				return "border-emerald-500/30 bg-emerald-500/10 text-emerald-500";
			case "disabled":
				return "border-red-500/30 bg-red-500/10 text-red-500";
			case "on_hold":
				return "border-amber-500/30 bg-amber-500/10 text-amber-500";
			case "expired":
			case "limited":
				return "border-orange-500/30 bg-orange-500/10 text-orange-500";
			default:
				return "border-panel-border bg-panel-elevated text-panel-text-muted";
		}
	};

	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-2xl border border-panel-border bg-panel-card p-3.5 shadow-xs transition-colors",
				isSelected &&
					"border-panel-accent/50 bg-panel-accent/5 ring-1 ring-panel-accent/20",
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2.5 min-w-0">
					<Checkbox
						checked={isSelected}
						onCheckedChange={onToggleSelect}
						aria-label={user.username}
					/>
					<div className="relative shrink-0">
						<div className="flex size-8 items-center justify-center rounded-xl bg-panel-surface border border-panel-border/70 text-panel-text-secondary">
							<UserIcon className="size-4" />
						</div>
						{isOnline && (
							<span className="absolute -bottom-0.5 -end-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-panel-card" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<p
							dir="ltr"
							className="text-xs font-bold text-panel-text truncate text-start"
						>
							{user.username}
						</p>
						<p className="text-[11px] text-panel-text-muted truncate">
							{user.service_name || "-"}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1.5 shrink-0">
					<Badge
						variant="outline"
						className={cn(
							"text-[10px] font-semibold px-2 py-0.5 rounded-lg border",
							getStatusColor(user.status),
						)}
					>
						{t(`status.${user.status}`)}
					</Badge>
					<button
						type="button"
						onClick={() => setIsExpanded((prev) => !prev)}
						className="flex size-7 items-center justify-center rounded-lg border border-panel-border/60 text-panel-text-secondary min-[769px]:hover:text-panel-text"
					>
						{isExpanded ? (
							<ChevronUp className="size-4" />
						) : (
							<ChevronDown className="size-4" />
						)}
					</button>
				</div>
			</div>

			<div className="flex flex-col gap-1.5 rounded-xl border border-panel-border/50 bg-panel-surface/60 p-2.5">
				<div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-panel-text-secondary">
					<span>{formatBytes(used, 1)}</span>
					<span>{limit > 0 ? formatBytes(limit, 1) : "∞"}</span>
				</div>
				{limit > 0 && (
					<div className="h-1.5 w-full rounded-full bg-panel-card border border-panel-border/40 overflow-hidden">
						<div
							className={cn(
								"h-full rounded-full transition-all duration-300",
								percent > 90
									? "bg-red-500"
									: percent > 75
										? "bg-amber-500"
										: "bg-panel-accent",
							)}
							style={{ width: `${percent}%` }}
						/>
					</div>
				)}
				<div className="flex items-center justify-between pt-1 text-[11px] text-panel-text-secondary">
					<span>{t("usersTable.expire")}:</span>
					<span
						className={cn(
							"font-medium",
							expiryInfo?.status === "expired"
								? "text-red-500 font-semibold"
								: "text-panel-text",
						)}
					>
						{expiryText}
					</span>
				</div>
			</div>

			<div className="flex items-center justify-end pt-1">
				<UserRowActions user={user} onEdit={onEdit} onGetIps={onGetIps} />
			</div>

			{isExpanded && (
				<div className="pt-2 border-t border-panel-border/60">
					<UserExpandedDetail user={user} onEdit={onEdit} onGetIps={onGetIps} />
				</div>
			)}
		</div>
	);
};

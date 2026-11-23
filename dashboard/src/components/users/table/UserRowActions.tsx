import { type RowActionItem, RowActionsMenu } from "components/ui";
import { RowActionButton } from "components/ui/row-actions";
import { useDashboard } from "contexts/DashboardContext";
import { cn } from "lib/cn";
import {
	Check,
	Copy,
	Globe,
	Link2,
	Pencil,
	QrCode,
	Trash2,
} from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { User, UserListItem } from "types/User";
import { copyTextToClipboard } from "utils/clipboard";
import { generateUserLinks } from "utils/userLinks";

type ActionButtonsUser = User | UserListItem;

type UserRowActionsProps = {
	user: ActionButtonsUser;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	onGetIps?: () => void;
	isRTL?: boolean;
	menuActions?: RowActionItem[];
};

export const UserRowActions: FC<UserRowActionsProps> = ({
	user,
	onDelete,
	onEdit,
	onGetIps,
	isRTL,
	menuActions,
}) => {
	const { t } = useTranslation();
	const setQRCode = useDashboard((state) => state.setQRCode);
	const linkTemplates = useDashboard((state) => state.linkTemplates);

	const userLinks = generateUserLinks(user as User, linkTemplates);
	const formatLink = (link?: string | null) => {
		if (!link) return "";
		return link.startsWith("/") ? window.location.origin + link : link;
	};
	const subscriptionLink = formatLink(user.subscription_url);
	const configLinksText = userLinks.join("\n");
	const hasConfigLinks = userLinks.length > 0;

	const [copied, setCopied] = useState(false);
	const [copiedConfigs, setCopiedConfigs] = useState(false);

	useEffect(() => {
		if (copied) {
			const timer = setTimeout(() => setCopied(false), 1200);
			return () => clearTimeout(timer);
		}
	}, [copied]);

	useEffect(() => {
		if (copiedConfigs) {
			const timer = setTimeout(() => setCopiedConfigs(false), 1200);
			return () => clearTimeout(timer);
		}
	}, [copiedConfigs]);

	const handleCopySub = async () => {
		if (!subscriptionLink) return;
		try {
			await copyTextToClipboard(subscriptionLink);
			setCopied(true);
		} catch {
		}
	};

	const handleCopyConfigs = async () => {
		if (!configLinksText) return;
		try {
			await copyTextToClipboard(configLinksText);
			setCopiedConfigs(true);
		} catch {
		}
	};

	return (
		<div
			className={cn(
				"flex items-center gap-1 shrink-0",
				isRTL ? "flex-row-reverse" : "flex-row",
			)}
		>
			{subscriptionLink && (
				<RowActionButton
					icon={
						copied ? (
							<Check className="size-3.5" />
						) : (
							<Copy className="size-3.5" />
						)
					}
					label={
						copied
							? t("copied")
							: t("userRowActions.copySub", "Copy Subscription")
					}
					onClick={handleCopySub}
					aria-label={t("userRowActions.copySub", "Copy Subscription")}
					className={copied ? "text-emerald-500" : ""}
				/>
			)}

			{hasConfigLinks && (
				<RowActionButton
					icon={
						copiedConfigs ? (
							<Check className="size-3.5" />
						) : (
							<Link2 className="size-3.5" />
						)
					}
					label={
						copiedConfigs
							? t("copied")
							: t("userRowActions.copyConfigs", "Copy Configs")
					}
					onClick={handleCopyConfigs}
					aria-label={t("userRowActions.copyConfigs", "Copy Configs")}
					className={copiedConfigs ? "text-emerald-500" : ""}
				/>
			)}

			{subscriptionLink && (
				<RowActionButton
					icon={<QrCode className="size-3.5" />}
					label={t("userRowActions.showQr", "QR Code")}
					onClick={() => setQRCode([subscriptionLink], user.username)}
					aria-label={t("userRowActions.showQr", "QR Code")}
				/>
			)}

			{onGetIps && (
				<RowActionButton
					icon={<Globe className="size-3.5" />}
					label={t("usersTable.ipsDialogTitle")}
					onClick={onGetIps}
					aria-label={t("usersTable.ipsDialogTitle")}
				/>
			)}

			{onEdit && (
				<RowActionButton
					icon={<Pencil className="size-3.5" />}
					label={t("edit")}
					onClick={onEdit}
					aria-label={t("edit")}
				/>
			)}

			{onDelete && (
				<RowActionButton
					icon={<Trash2 className="size-3.5" />}
					label={t("delete")}
					onClick={onDelete}
					aria-label={t("delete")}
					className="text-red-500 min-[769px]:hover:text-red-600"
				/>
			)}

			{menuActions && menuActions.length > 0 && (
				<RowActionsMenu actions={menuActions} />
			)}
		</div>
	);
};

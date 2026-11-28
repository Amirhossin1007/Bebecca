import { DeleteConfirmDialog } from "components/dialogs/ConfirmDialog";
import {
	type DataTableRowAction,
	type RowActionItem,
	RowActionsMenu,
} from "components/ui";
import { RowActionButton } from "components/ui/row-actions";
import { useDashboard } from "contexts/DashboardContext";
import { cn } from "lib/cn";
import { Check, Copy, Link2, Pencil, QrCode, Trash2 } from "lucide-react";
import { type FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { User, UserListItem } from "types/User";
import { copyTextToClipboard } from "utils/clipboard";
import { generateUserLinks } from "utils/userLinks";

export const toMenuItems = (
	actions: DataTableRowAction<UserListItem>[],
	row: UserListItem,
): RowActionItem[] =>
	actions.map((action) => ({
		id: action.id,
		label: action.label,
		icon: action.icon,
		color: action.color,
		isDanger: action.isDanger,
		disabled:
			typeof action.disabled === "function"
				? action.disabled(row)
				: action.disabled,
		onClick: action.onClick ? () => action.onClick?.(row) : undefined,
	}));

type ActionButtonsUser = User | UserListItem;

type UserRowActionButtonsProps = {
	user: ActionButtonsUser;
	onDelete?: () => void | Promise<void>;
	onEdit?: () => void;
	isRTL?: boolean;
	menuActions?: RowActionItem[];
};

const formatLink = (link?: string | null) => {
	if (!link) return "";
	return link.startsWith("/") ? window.location.origin + link : link;
};

export const UserRowActionButtons: FC<UserRowActionButtonsProps> = ({
	user,
	onDelete,
	onEdit,
	isRTL,
	menuActions,
}) => {
	const { t } = useTranslation();
	const setQRCode = useDashboard((state) => state.setQRCode);
	const setSubLink = useDashboard((state) => state.setSubLink);
	const linkTemplates = useDashboard((state) => state.linkTemplates);

	const userLinks = generateUserLinks(user, linkTemplates);
	const subscriptionLink = formatLink(user.subscription_url);
	const configLinksText = userLinks.join("\n");
	const hasConfigLinks = userLinks.length > 0;

	const [copied, setCopied] = useState(false);
	const [copiedConfigs, setCopiedConfigs] = useState(false);

	useEffect(() => {
		if (!copied) return undefined;
		const timer = window.setTimeout(() => setCopied(false), 1000);
		return () => window.clearTimeout(timer);
	}, [copied]);

	useEffect(() => {
		if (!copiedConfigs) return undefined;
		const timer = window.setTimeout(() => setCopiedConfigs(false), 1000);
		return () => window.clearTimeout(timer);
	}, [copiedConfigs]);

	return (
		<div
			dir={isRTL ? "rtl" : "ltr"}
			onClick={(event) => {
				event.preventDefault();
				event.stopPropagation();
			}}
			className={cn(
				"flex flex-row items-center gap-1 flex-nowrap",
				isRTL ? "justify-start" : "justify-end",
			)}
		>
			<RowActionButton
				label={copied ? t("copied") : t("usersTable.copyLink")}
				icon={copied ? <Check /> : <Link2 />}
				disabled={!subscriptionLink}
				onClick={() => {
					void copyTextToClipboard(subscriptionLink)
						.then(() => setCopied(true))
						.catch(() => undefined);
				}}
			/>
			<RowActionButton
				label={copiedConfigs ? t("copied") : t("usersTable.copyConfigs")}
				icon={copiedConfigs ? <Check /> : <Copy />}
				disabled={!hasConfigLinks}
				onClick={() => {
					void copyTextToClipboard(configLinksText)
						.then(() => setCopiedConfigs(true))
						.catch(() => undefined);
				}}
			/>
			<RowActionButton
				label={t("usersTable.qrCode")}
				icon={<QrCode />}
				onClick={() => {
					const links = generateUserLinks(user, linkTemplates);
					setQRCode(links, user.username);
					setSubLink(subscriptionLink);
				}}
			/>
			{onEdit && (
				<RowActionButton
					label={t("userDialog.editUser")}
					icon={<Pencil />}
					onClick={onEdit}
				/>
			)}
			{onDelete && (
				<DeleteConfirmDialog
					description={t("deleteUser.prompt", { username: user.username })}
					onConfirm={onDelete}
				>
					<RowActionButton
						label={t("deleteUser.title")}
						icon={<Trash2 />}
						danger
					/>
				</DeleteConfirmDialog>
			)}
			{menuActions && menuActions.length > 0 && (
				<RowActionsMenu actions={menuActions} label={t("actions")} />
			)}
		</div>
	);
};

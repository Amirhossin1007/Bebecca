import { cn } from "lib/cn";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type UserAdminChipProps = {
	adminUsername?: string | null;
	show?: boolean;
	className?: string;
};

export const UserAdminChip: FC<UserAdminChipProps> = ({
	adminUsername,
	show = true,
	className,
}) => {
	const { t } = useTranslation();

	if (!show || !adminUsername) return null;

	return (
		<span
			dir="ltr"
			className={cn(
				"inline-flex items-center gap-1 rounded-md bg-panel-elevated/60 px-1.5 py-0.5 text-[11px] font-normal text-panel-text-muted ring-1 ring-inset ring-panel-border/50 [unicode-bidi:isolate]",
				className,
			)}
		>
			<span className="text-panel-text-muted/70">{t("usersTable.by")}</span>
			<span className="font-medium text-panel-text-secondary">
				{adminUsername}
			</span>
		</span>
	);
};

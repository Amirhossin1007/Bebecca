import type { FC } from "react";
import { useTranslation } from "react-i18next";

type UserAdminChipProps = {
	adminUsername?: string | null;
	show?: boolean;
};

export const UserAdminChip: FC<UserAdminChipProps> = ({
	adminUsername,
	show = true,
}) => {
	const { t } = useTranslation();

	if (!show || !adminUsername) return null;

	return (
		<span dir="ltr" className="[unicode-bidi:isolate] rb-user-admin-chip">
			{t("usersTable.by")}{" "}
			<span className="font-semibold">{adminUsername}</span>
		</span>
	);
};

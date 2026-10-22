import { AdminDialog } from "components/AdminDialog";
import { AdminsTable } from "components/AdminsTable";
import { AdminsCreateButton, AdminsFilterBar } from "components/admins/AdminsFilterBar";
import { Pagination } from "components/Pagination";
import { PageHeader } from "components/ui";
import { useAdminsStore } from "contexts/AdminsContext";
import useGetUser from "hooks/useGetUser";
import { type FC, useEffect } from "react";
import { useTranslation } from "react-i18next";

export const AdminsPage: FC = () => {
	const { t } = useTranslation();
	const fetchAdmins = useAdminsStore((s) => s.fetchAdmins);
	const openAdminDialog = useAdminsStore((s) => s.openAdminDialog);
	const { userData, getUserIsSuccess } = useGetUser();
	const canViewAdmins =
		getUserIsSuccess && Boolean(userData.permissions?.sections.admins);
	useEffect(() => {
		if (canViewAdmins) {
			fetchAdmins(undefined, { force: true });
		}
	}, [fetchAdmins, canViewAdmins]);

	useEffect(() => {
		if (!canViewAdmins) return;
		const shouldOpenCreate = sessionStorage.getItem("openCreateAdmin");
		if (shouldOpenCreate === "true") {
			sessionStorage.removeItem("openCreateAdmin");
			openAdminDialog();
		}
	}, [canViewAdmins, openAdminDialog]);

	if (!canViewAdmins) {
		return (
			<div className="flex flex-col gap-4 items-stretch">
				<PageHeader
					title={t("admins")}
					description={t("admins.pageDescription")}
				/>
				<p className="text-panel-text-muted">
					{t("admins.noPermission")}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 items-stretch">
			<AdminsTable
				toolbar={<AdminsFilterBar />}
				headerActions={<AdminsCreateButton />}
			/>
			<Pagination for="admins" />
			<AdminDialog />
		</div>
	);
};

export default AdminsPage;

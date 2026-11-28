import AddFileIcon from "assets/add_file.svg?react";
import { Button } from "components/ui/button";
import { useDashboard } from "contexts/DashboardContext";
import type { FC } from "react";
import { useTranslation } from "react-i18next";

type UsersEmptyStateProps = {
	isFiltered: boolean;
	isCreateDisabled: boolean;
};

export const UsersEmptyState: FC<UsersEmptyStateProps> = ({
	isFiltered,
	isCreateDisabled,
}) => {
	const { t } = useTranslation();
	const onCreateUser = useDashboard((state) => state.onCreateUser);

	const handleCreate = () => {
		if (isCreateDisabled) {
			return;
		}
		onCreateUser(true);
	};

	return (
		<div className="p-5 py-8 flex items-center flex-col gap-4 w-full border border-light-border! rounded-lg bg-surface-light dark:bg-surface-dark dark:border-whiteAlpha-200!">
			<AddFileIcon className="dark:[&_path[fill='#fff']]:[fill:var(--color-gray-800)] dark:[&_path[fill='#f2f2f2']]:[fill:var(--color-gray-700)] dark:[&_path[fill='#e6e6e6']]:[fill:var(--color-gray-700)] dark:[&_path[fill='#ccc']]:[fill:var(--color-gray-700)] dark:[&_circle[fill='#3182CE']]:[fill:var(--color-primary-300)] light:[&_path[fill='#f2f2f2']]:[fill:var(--color-gray-300)] light:[&_path[fill='#e6e6e6']]:[fill:var(--color-gray-300)] light:[&_path[fill='#ccc']]:[fill:var(--color-gray-300)] light:[&_circle[fill='#3182CE']]:[fill:var(--color-primary-500)] max-h-[200px] max-w-[200px]" />
			<p className="font-medium text-gray-600 dark:text-gray-400">
				{isFiltered ? t("usersTable.noUserMatched") : t("usersTable.noUser")}
			</p>
			{!isFiltered && !isCreateDisabled && (
				<Button onClick={handleCreate} size="sm">
					{t("createUser")}
				</Button>
			)}
		</div>
	);
};

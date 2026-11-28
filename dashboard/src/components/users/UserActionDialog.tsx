import { AppDialog } from "components/dialogs/AppDialog";
import { Icon } from "components/Icon";
import { Button } from "components/ui/button";
import { toast } from "components/ui/sonner";
import { useDashboard } from "contexts/DashboardContext";
import { RefreshCw } from "lucide-react";
import { type FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

type UserActionDialogProps = {
	action: "reset" | "revoke";
};

export const UserActionDialog: FC<UserActionDialogProps> = ({ action }) => {
	const { t } = useTranslation();
	const resetUsageUser = useDashboard((state) => state.resetUsageUser);
	const revokeSubscriptionUser = useDashboard(
		(state) => state.revokeSubscriptionUser,
	);
	const resetDataUsage = useDashboard((state) => state.resetDataUsage);
	const revokeSubscription = useDashboard((state) => state.revokeSubscription);

	const [loading, setLoading] = useState(false);
	const isRevoke = action === "revoke";
	const user = isRevoke ? revokeSubscriptionUser : resetUsageUser;

	const onClose = () => {
		useDashboard.setState(
			isRevoke ? { revokeSubscriptionUser: null } : { resetUsageUser: null },
		);
	};

	const onSubmit = () => {
		if (!user) return;
		setLoading(true);
		(isRevoke ? revokeSubscription(user) : resetDataUsage(user))
			.then(() => {
				toast.success(
					t(isRevoke ? "revokeUserSub.success" : "resetUserUsage.success", {
						username: user.username,
					}),
					{ duration: 3000 },
				);
			})
			.catch(() => {
				toast.error(
					t(isRevoke ? "revokeUserSub.error" : "resetUserUsage.error"),
					{ duration: 3000 },
				);
			})
			.finally(() => {
				setLoading(false);
			});
	};

	return (
		<AppDialog
			open={Boolean(user)}
			onClose={onClose}
			size="sm"
			title={
				<Icon color="blue">
					<RefreshCw className="w-5 h-5" />
				</Icon>
			}
			contentProps={{ className: "mx-3" }}
			headerProps={{ className: "pt-6" }}
			footerProps={{ className: "flex" }}
			footer={
				<>
					<Button
						onClick={onClose}
						variant="outline"
						size="sm"
						className="flex-1"
					>
						{t("cancel")}
					</Button>
					<Button
						onClick={onSubmit}
						size="sm"
						loading={loading}
						className="flex-1 bg-blue-600 text-white shadow-xs min-[769px]:hover:bg-blue-700"
					>
						{t(isRevoke ? "revoke" : "reset")}
					</Button>
				</>
			}
		>
			<p className="font-semibold text-[1.125rem]">
				{t(isRevoke ? "revokeUserSub.title" : "resetUserUsage.title")}
			</p>
			{user && (
				<p className="mt-1 text-[0.875rem] dark:text-gray-400 text-gray-600">
					<Trans components={{ b: <b /> }}>
						{t(isRevoke ? "revokeUserSub.prompt" : "resetUserUsage.prompt", {
							username: user.username,
						})}
					</Trans>
				</p>
			)}
		</AppDialog>
	);
};

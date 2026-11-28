import { TagChips } from "components/labels/TagChips";
import { OnlineStatus } from "components/OnlineStatus";
import type { DataTableColumn } from "components/ui";
import {
	UserAdminChip,
	UserExpiryCountdown,
	UserUsageBar,
} from "components/users";
import { cn } from "lib/cn";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { UserListItem } from "types/User";
import { formatBytes } from "utils/formatByte";
import {
	formatUsernamePreview,
	MobileLifetimeDetail,
	MobileUsageDetail,
	MobileUserOnlineDot,
	USER_STATUS_TEXT_COLORS,
	UserPresence,
	UserSpeed,
} from "./UserTableCells";

type UseUserColumnsOptions = {
	canOpenUserDialog: boolean;
	canViewTraffic: boolean;
	hasPrivilegedRole: boolean;
};

export const useUserColumns = ({
	canOpenUserDialog,
	canViewTraffic,
	hasPrivilegedRole,
}: UseUserColumnsOptions): DataTableColumn<UserListItem>[] => {
	const { t } = useTranslation();

	return useMemo<DataTableColumn<UserListItem>[]>(() => {
		const columns: DataTableColumn<UserListItem>[] = [
			{
				id: "online",
				menuLabel: t("usersTable.online"),
				header: t("usersTable.online"),
				priority: "high",
				width: "76px",
				minWidth: "72px",
				maxWidth: "84px",
				headerAlign: "start",
				cellAlign: "start",
				mobileVisible: false,
				mobilePriority: 1,
				mobileMetaLabel: t("usersTable.online"),
				cell: (user) => <UserPresence user={user} />,
			},
			{
				id: "username",
				menuLabel: t("username"),
				header: t("username"),
				accessor: "username",
				sortable: true,
				isPrimary: true,
				priority: "primary",
				width: { lg: "150px", xl: "168px" },
				minWidth: "148px",
				maxWidth: "188px",
				truncate: true,
				tooltip: true,
				multiline: true,
				cellAlign: "start",
				mobilePriority: 0,
				mobileMetaLabel: t("username"),
				cell: (user) => (
					<div className="flex flex-col gap-0.5 min-w-0! items-start">
						<div className="flex flex-row items-center gap-1.5 min-w-0! max-w-full">
							<MobileUserOnlineDot user={user} />
							<p
								dir="ltr"
								className={cn(
									canOpenUserDialog
										? "min-[769px]:hover:text-panel-accent"
										: "",
									"font-semibold truncate max-w-full min-w-0! text-panel-text [unicode-bidi:isolate]",
								)}
							>
								{formatUsernamePreview(user.username)}
							</p>
						</div>
						<UserAdminChip adminUsername={user.admin_username} />
						<p
							style={{
								color:
									USER_STATUS_TEXT_COLORS[user.status] ??
									"var(--rb-panel-text)",
							}}
							className="text-[0.75rem] font-semibold capitalize rb-user-card-status"
						>
							{t(`status.${user.status}`)}
						</p>
					</div>
				),
			},
			{
				id: "id",
				menuLabel: t("usersTable.userId"),
				header: t("usersTable.userId"),
				accessor: (user) => user.id,
				sortable: true,
				width: "96px",
				minWidth: "84px",
				maxWidth: "120px",
				cellAlign: "start",
				mobileVisible: false,
				cell: (user) => (
					<p dir="ltr" className="text-[0.875rem] text-panel-text font-mono">
						{user.id}
					</p>
				),
			},
			{
				id: "status",
				menuLabel: t("status"),
				header: t("usersTable.status"),
				priority: "high",
				width: "112px",
				minWidth: "96px",
				maxWidth: "128px",
				headerAlign: "start",
				cellAlign: "start",
				mobilePriority: 2,
				mobileMetaLabel: t("usersTable.status"),
				cell: (user) => (
					<p
						style={{
							color:
								USER_STATUS_TEXT_COLORS[user.status] ?? "var(--rb-panel-text)",
						}}
						className="text-[0.875rem] font-semibold capitalize"
					>
						{t(`status.${user.status}`)}
					</p>
				),
			},
			{
				id: "service",
				menuLabel: t("usersTable.service"),
				header: t("usersTable.service"),
				accessor: (user) => user.service_name ?? t("usersTable.defaultService"),
				priority: "high",
				width: "118px",
				minWidth: "96px",
				maxWidth: "138px",
				truncate: true,
				tooltip: true,
				mobilePriority: 3,
				mobileVisible: true,
				mobileMetaLabel: t("usersTable.service"),
				cell: (user) => (
					<p
						className={cn(
							"text-[0.875rem] truncate max-w-full",
							user.service_name ? "text-panel-text" : "text-panel-text-muted",
						)}
					>
						{user.service_name ?? t("usersTable.defaultService")}
					</p>
				),
			},
			{
				id: "group",
				menuLabel: t("groups.group"),
				header: t("groups.group"),
				accessor: (user) => user.group?.name ?? "",
				priority: "medium",
				width: "110px",
				minWidth: "88px",
				maxWidth: "140px",
				truncate: true,
				tooltip: true,
				mobilePriority: 4,
				mobileVisible: true,
				mobileMetaLabel: t("groups.group"),
				cell: (user) => (
					<p
						className={cn(
							"text-[0.875rem] truncate max-w-full",
							user.group ? "text-panel-text" : "text-panel-text-muted",
						)}
					>
						{user.group?.name ?? "–"}
					</p>
				),
			},
			{
				id: "tags",
				menuLabel: t("tags.title"),
				header: t("tags.title"),
				priority: "low",
				width: "170px",
				minWidth: "120px",
				maxWidth: "220px",
				mobilePriority: 5,
				mobileVisible: true,
				mobileMetaLabel: t("tags.title"),
				cell: (user) => <TagChips tags={user.tags} limit={2} />,
			},
		];

		if (canViewTraffic) {
			columns.push(
				{
					id: "used_traffic",
					menuLabel: t("usersTable.traffic"),
					header: t("usersTable.traffic"),
					sortable: true,
					priority: "high",
					width: "clamp(188px, 15vw, 240px)",
					minWidth: "188px",
					maxWidth: "240px",
					headerAlign: "start",
					cellAlign: "start",
					mobileVisible: true,
					mobileSummary: true,
					mobilePriority: 4,
					mobileMetaLabel: t("usersTable.traffic"),
					mobileDetailCell: (user) => (
						<MobileUsageDetail
							used={user.used_traffic}
							total={user.data_limit}
						/>
					),
					cell: (user) => (
						<UserUsageBar
							variant="compact"
							used={user.used_traffic}
							total={user.data_limit}
						/>
					),
				},
				{
					id: "speed",
					menuLabel: t("usersTable.speed"),
					header: t("usersTable.speed"),
					priority: "high",
					width: "120px",
					minWidth: "112px",
					maxWidth: "136px",
					headerAlign: "start",
					cellAlign: "start",
					mobileVisible: true,
					mobilePriority: 5,
					mobileMetaLabel: t("usersTable.speed"),
					cell: (user) => <UserSpeed user={user} />,
				},
				{
					id: "remaining_traffic",
					menuLabel: t("usersTable.remainingTraffic"),
					header: t("usersTable.remainingTraffic"),
					priority: "high",
					width: "132px",
					minWidth: "114px",
					maxWidth: "148px",
					headerAlign: "start",
					cellAlign: "start",
					mobileVisible: true,
					mobilePriority: 6,
					mobileMetaLabel: t("usersTable.remainingTraffic"),
					cell: (user) => (
						<p
							dir="ltr"
							className={cn(
								"leading-[1] font-mono tabular-nums [unicode-bidi:isolate] text-start",
								!user.data_limit
									? "text-[1.25rem] font-semibold text-panel-text-muted"
									: "text-[0.875rem] text-panel-text",
							)}
						>
							{!user.data_limit ? (
								<>
									<span aria-hidden="true">∞</span>
									<span className="sr-only">{t("unlimited")}</span>
								</>
							) : (
								formatBytes(Math.max(user.data_limit - user.used_traffic, 0))
							)}
						</p>
					),
				},
				{
					id: "lifetime_used_traffic",
					menuLabel: t("usersTable.lifetimeUsage"),
					header: t("usersTable.lifetimeUsage"),
					priority: "high",
					width: "132px",
					minWidth: "114px",
					maxWidth: "148px",
					headerAlign: "start",
					cellAlign: "start",
					mobileVisible: true,
					mobilePriority: 7,
					mobileMetaLabel: t("usersTable.lifetimeUsage"),
					cell: (user) => (
						<MobileLifetimeDetail
							totalUsedTraffic={user.lifetime_used_traffic}
						/>
					),
				},
			);
		}

		columns.push({
			id: "expire",
			menuLabel: t("usersTable.expire"),
			header: t("usersTable.expire"),
			sortable: true,
			priority: "high",
			width: "152px",
			minWidth: "132px",
			maxWidth: "148px",
			headerAlign: "start",
			cellAlign: "start",
			mobileVisible: true,
			mobilePriority: 8,
			mobileMetaLabel: t("usersTable.expire"),
			cell: (user) => (
				<UserExpiryCountdown expire={user.expire} status={user.status} />
			),
		});

		if (hasPrivilegedRole) {
			columns.push({
				id: "admin",
				menuLabel: t("usersTable.admin"),
				header: t("usersTable.admin"),
				desktopVisible: false,
				mobileVisible: true,
				mobilePriority: 9,
				mobileMetaLabel: t("usersTable.admin"),
				cell: (user) => <UserAdminChip adminUsername={user.admin_username} />,
			});
		}

		columns.push({
			id: "last_connection",
			header: t("bulkActions.delete.lastOnline"),
			desktopVisible: false,
			mobileVisible: true,
			mobilePriority: 10,
			mobileMetaLabel: t("bulkActions.delete.lastOnline"),
			cell: (user) => (
				<OnlineStatus
					lastOnline={user.online_at ?? null}
					isOnline={user.is_online}
					withMargin={false}
					compact
				/>
			),
		});

		return columns;
	}, [canOpenUserDialog, canViewTraffic, hasPrivilegedRole, t]);
};

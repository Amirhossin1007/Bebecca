import { Checkbox } from "components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "components/ui/table";
import { Badge } from "components/ui/badge";
import { ChevronDown, ChevronRight, User as UserIcon } from "lucide-react";
import { type FC, type ReactNode, Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { cn } from "lib/cn";
import { formatBytes } from "utils/formatByte";
import { relativeExpiryDate } from "utils/dateFormatter";
import { fetch as apiFetch } from "service/http";
import { toast } from "components/ui/sonner";
import type { UserListItem } from "types/User";
import { AddTrafficDialog } from "components/AddTrafficDialog";
import { UserExpandedDetail } from "./users/table/UserExpandedDetail";
import { UserRowActions } from "./users/table/UserRowActions";
import { UsersBulkActionsBar } from "./users/table/UsersBulkActionsBar";
import { UserIPsDialog, type UserIPRecord } from "./users/dialogs/UserIPsDialog";
import { UserMobileCard } from "./users/table/UserMobileCard";

type UsersTableProps = {
	toolbar?: ReactNode;
	headerActions?: ReactNode;
	className?: string;
};

export const UsersTable: FC<UsersTableProps> = ({ toolbar, headerActions, className }) => {
	const { t } = useTranslation();

	const usersResponse = useDashboard((s) => s.users);
	const loading = useDashboard((s) => s.loading);
	const onEditingUser = useDashboard((s) => s.onEditingUser);
	const liveUserStats = useDashboard((s) => s.liveUserStats);
	const refetchUsers = useDashboard((s) => s.refetchUsers);

	const [selectedUsernames, setSelectedUsernames] = useState<string[]>([]);
	const [expandedUsername, setExpandedUsername] = useState<string | null>(null);
	const [trafficUser, setTrafficUser] = useState<UserListItem | null>(null);

	const [ipDialogState, setIpDialogState] = useState<{
		isOpen: boolean;
		username: string;
		records: UserIPRecord[];
		error?: string | null;
	}>({ isOpen: false, username: "", records: [] });

	const users = useMemo(() => usersResponse.users ?? [], [usersResponse.users]);

	const selectedUsers = useMemo(
		() => users.filter((u) => selectedUsernames.includes(u.username)),
		[users, selectedUsernames],
	);

	const toggleSelectAll = () => {
		if (selectedUsernames.length === users.length) {
			setSelectedUsernames([]);
		} else {
			setSelectedUsernames(users.map((u) => u.username));
		}
	};

	const toggleSelectUser = (username: string) => {
		setSelectedUsernames((prev) =>
			prev.includes(username) ? prev.filter((id) => id !== username) : [...prev, username],
		);
	};

	const handleOpenIps = async (user: UserListItem) => {
		setIpDialogState({ isOpen: true, username: user.username, records: [] });
		try {
			const res = await apiFetch<{ ips: UserIPRecord[] }>(`/user/${encodeURIComponent(user.username)}/ips`);
			setIpDialogState({ isOpen: true, username: user.username, records: res.ips || [] });
		} catch (err: any) {
			setIpDialogState({
				isOpen: true,
				username: user.username,
				records: [],
				error: err?.message || t("usersTable.getIpsFailed"),
			});
		}
	};

	const handleAddTraffic = async (user: UserListItem, deltaBytes: number) => {
		const newLimit = (user.data_limit ?? 0) + deltaBytes;
		try {
			await apiFetch(`/v2/users/${encodeURIComponent(user.username)}`, {
				method: "PUT",
				body: { data_limit: newLimit },
			});
			toast.success(t("usersTable.setDataLimitSuccess"));
			refetchUsers(true);
		} catch (err: any) {
			toast.error(err?.message || t("error"));
		}
	};

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
		<div className={cn("flex flex-col gap-3 w-full", className)}>
			{(toolbar || headerActions) && (
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-panel-border bg-panel-surface p-3 shadow-xs">
					<div className="flex-1 min-w-[260px]">{toolbar}</div>
					{headerActions && <div className="flex items-center gap-2 shrink-0">{headerActions}</div>}
				</div>
			)}

			<div className="flex flex-col gap-3 md:hidden">
				{loading && users.length === 0 ? (
					<div className="flex h-32 items-center justify-center rounded-[18px] border border-panel-border bg-panel-card text-xs text-panel-text-muted">
						{t("loading")}
					</div>
				) : users.length === 0 ? (
					<div className="flex h-32 items-center justify-center rounded-[18px] border border-panel-border bg-panel-card text-xs text-panel-text-muted">
						{t("noData")}
					</div>
				) : (
					users.map((user) => (
						<UserMobileCard
							key={user.username}
							user={user}
							isSelected={selectedUsernames.includes(user.username)}
							isOnline={liveUserStats[user.username]?.is_online}
							onToggleSelect={() => toggleSelectUser(user.username)}
							onEdit={() => onEditingUser(user)}
							onGetIps={() => handleOpenIps(user)}
						/>
					))
				)}
			</div>

			<div className="hidden md:block rounded-[18px] border border-panel-border bg-panel-card shadow-xs overflow-hidden">
				<div className="overflow-x-auto">
					<Table className="w-full">
						<TableHeader className="bg-panel-surface/60 border-b border-panel-border">
							<TableRow className="hover:bg-transparent">
								<TableHead className="w-[44px] min-w-[44px] max-w-[44px] px-2 text-center">
									<Checkbox
										checked={users.length > 0 && selectedUsernames.length === users.length}
										onCheckedChange={toggleSelectAll}
										aria-label={t("selectAll")}
									/>
								</TableHead>
								<TableHead className="w-[36px] min-w-[36px] max-w-[36px] px-1 text-center" />
								<TableHead className="min-w-[150px] text-start text-xs font-semibold text-panel-text">
									{t("username")}
								</TableHead>
								<TableHead className="w-[110px] min-w-[110px] text-start text-xs font-semibold text-panel-text">
									{t("usersTable.status")}
								</TableHead>
								<TableHead className="min-w-[120px] text-start text-xs font-semibold text-panel-text">
									{t("usersTable.service")}
								</TableHead>
								<TableHead className="w-[190px] min-w-[190px] text-start text-xs font-semibold text-panel-text">
									{t("usersTable.traffic")}
								</TableHead>
								<TableHead className="w-[140px] min-w-[140px] text-start text-xs font-semibold text-panel-text">
									{t("usersTable.expire")}
								</TableHead>
								<TableHead className="w-[150px] min-w-[150px] text-end text-xs font-semibold text-panel-text pe-4">
									{t("actions")}
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{loading && users.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="h-40 text-center text-xs text-panel-text-muted">
										{t("loading")}
									</TableCell>
								</TableRow>
							) : users.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="h-40 text-center text-xs text-panel-text-muted">
										{t("noData")}
									</TableCell>
								</TableRow>
							) : (
								users.map((user) => {
									const isExpanded = expandedUsername === user.username;
									const isSelected = selectedUsernames.includes(user.username);
									const isOnline = liveUserStats[user.username]?.is_online;
									const used = user.used_traffic ?? 0;
									const limit = user.data_limit ?? 0;
									const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
									const expiryInfo = user.expire ? relativeExpiryDate(user.expire) : null;
									const expiryText = expiryInfo?.time || t("userDialog.unlimited");

									return (
										<Fragment key={user.username}>
											<TableRow
												onClick={() =>
													setExpandedUsername(isExpanded ? null : user.username)
												}
												className={cn(
													"cursor-pointer transition-colors border-b border-panel-border/60 min-[769px]:hover:bg-panel-surface/60",
													isSelected && "bg-panel-accent/5",
													isExpanded && "bg-panel-surface/40",
												)}
											>
												<TableCell
													onClick={(e) => e.stopPropagation()}
													className="w-[44px] min-w-[44px] max-w-[44px] px-2 text-center"
												>
													<Checkbox
														checked={isSelected}
														onCheckedChange={() => toggleSelectUser(user.username)}
														aria-label={user.username}
													/>
												</TableCell>

												<TableCell className="w-[36px] min-w-[36px] max-w-[36px] px-1 text-center">
													<div className="flex size-6 items-center justify-center text-panel-text-muted mx-auto">
														{isExpanded ? (
															<ChevronDown className="size-4 text-panel-accent" />
														) : (
															<ChevronRight className="size-4 rtl:rotate-180" />
														)}
													</div>
												</TableCell>

												<TableCell className="min-w-[150px] text-start py-3">
													<div className="flex items-center gap-2">
														<div className="relative">
															<div className="flex size-7 items-center justify-center rounded-[9px] bg-panel-surface border border-panel-border/70 text-panel-text-secondary">
																<UserIcon className="size-3.5" />
															</div>
															{isOnline && (
																<span className="absolute -bottom-0.5 -end-0.5 size-2 rounded-full bg-emerald-500 ring-2 ring-panel-card" />
															)}
														</div>
														<div className="min-w-0">
															<p dir="ltr" className="text-xs font-semibold text-panel-text truncate text-start">
																{user.username}
															</p>
														</div>
													</div>
												</TableCell>

												<TableCell className="w-[110px] min-w-[110px] text-start py-3">
													<Badge
														variant="outline"
														className={cn(
															"text-[10px] font-semibold px-2 py-0.5 rounded-lg border",
															getStatusColor(user.status),
														)}
													>
														{t(`status.${user.status}`)}
													</Badge>
												</TableCell>

												<TableCell className="min-w-[120px] text-start py-3">
													<span className="text-xs font-medium text-panel-text-secondary">
														{user.service_name || "—"}
													</span>
												</TableCell>

												<TableCell className="w-[190px] min-w-[190px] text-start py-3">
													<div className="flex flex-col gap-1 w-full max-w-[180px]">
														<div
															dir="ltr"
															className="flex items-center justify-between text-[11px] font-mono tabular-nums [unicode-bidi:isolate] text-panel-text-secondary"
														>
															<span>{formatBytes(used, 1)}</span>
															<span>{limit > 0 ? `/ ${formatBytes(limit, 1)}` : "—"}</span>
														</div>
														{limit > 0 && (
															<div className="h-1.5 w-full rounded-full bg-panel-elevated overflow-hidden">
																<div
																	className={cn(
																		"h-full rounded-full transition-all duration-300",
																		percent > 90 ? "bg-red-500" : percent > 75 ? "bg-amber-500" : "bg-panel-accent",
																	)}
																	style={{ width: `${percent}%` }}
																/>
															</div>
														)}
													</div>
												</TableCell>

												<TableCell className="w-[140px] min-w-[140px] text-start py-3">
													<span
														className={cn(
															"text-xs font-medium whitespace-nowrap [unicode-bidi:isolate]",
															expiryInfo?.status === "expired"
																? "text-red-500 font-semibold"
																: "text-panel-text-secondary",
														)}
													>
														{expiryText}
													</span>
												</TableCell>

												<TableCell
													onClick={(e) => e.stopPropagation()}
													className="w-[150px] min-w-[150px] text-end py-3 pe-4"
												>
													<UserRowActions
														user={user}
														onEdit={() => onEditingUser(user)}
														onGetIps={() => handleOpenIps(user)}
													/>
												</TableCell>
											</TableRow>

											{isExpanded && (
												<TableRow className="bg-panel-elevated/20 hover:bg-panel-elevated/20 border-b border-panel-border/60">
													<TableCell colSpan={8} className="p-4 sm:p-5">
														<UserExpandedDetail
															user={user}
															onEdit={() => onEditingUser(user)}
															onGetIps={() => handleOpenIps(user)}
														/>
													</TableCell>
												</TableRow>
											)}
										</Fragment>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			<UsersBulkActionsBar
				selectedUsers={selectedUsers}
				onClearSelection={() => setSelectedUsernames([])}
			/>

			<UserIPsDialog
				isOpen={ipDialogState.isOpen}
				username={ipDialogState.username}
				records={ipDialogState.records}
				error={ipDialogState.error}
				onClose={() => setIpDialogState((prev) => ({ ...prev, isOpen: false }))}
			/>

			<AddTrafficDialog
				target={trafficUser ? { kind: "user", name: trafficUser.username } : null}
				onClose={() => setTrafficUser(null)}
				onApply={(delta) => (trafficUser ? handleAddTraffic(trafficUser, delta) : Promise.resolve())}
			/>
		</div>
	);
};

import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Tooltip } from "components/shadcn/tooltip";
import { Popover, PopoverArrow, PopoverBody, PopoverCloseButton, PopoverContent, PopoverHeader, PopoverTrigger } from "components/shadcn/popover";
import { Button } from "components/shadcn/button";
import { Checkbox } from "components/shadcn/selection";
import { Tag, TagCloseButton, TagLabel } from "components/shadcn/badge";
import { withClass } from "components/shadcn/icon";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import {
	ArrowPathIcon,
	FunnelIcon,
	PlusIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import type { SortingState } from "@tanstack/react-table";
import classNames from "classnames";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { DataTableSortMenu, type SortOption } from "components/ui/DataTableSortMenu";
import { useAdminsStore } from "contexts/AdminsContext";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import debounce from "lodash.debounce";
import type React from "react";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	AdminManagementPermission,
	AdminRole,
	AdminStatus,
	UserPermissionToggle,
} from "types/Admin";
import { canViewUserTraffic, isUserManagementLocked } from "utils/adminTraffic";

const FilterIcon = withClass(FunnelIcon, "w-4 h-4");
export const ReloadIcon = withClass(ArrowPathIcon, "w-4 h-4");
const PlusIconStyled = withClass(PlusIcon, "w-4 h-4");
const HelpIcon = withClass(QuestionMarkCircleIcon, "w-4 h-4");

export type AdvancedFilterOption = {
	key: string;
	labelKey: string;
	fallback: string;
};

export const ADVANCED_FILTER_OPTIONS: AdvancedFilterOption[] = [
	{
		key: "top_speed",
		labelKey: "filters.advanced.topSpeed",
		fallback: "Highest live speed",
	},
	{
		key: "online",
		labelKey: "filters.advanced.online",
		fallback: "Online right now",
	},
	{
		key: "offline",
		labelKey: "filters.advanced.offline",
		fallback: "Offline for 24h",
	},
	{
		key: "sub_not_updated",
		labelKey: "filters.advanced.subNotUpdated",
		fallback: "Sub link stale for 24h",
	},
	{
		key: "sub_never_updated",
		labelKey: "filters.advanced.subNeverUpdated",
		fallback: "Sub link never updated",
	},
	{
		key: "limit",
		labelKey: "filters.advanced.limit",
		fallback: "Has data limit",
	},
	{
		key: "unlimited",
		labelKey: "filters.advanced.unlimited",
		fallback: "Unlimited users",
	},
	{
		key: "finished",
		labelKey: "filters.advanced.finished",
		fallback: "Finished (limited or expired)",
	},
	{
		key: "expired",
		labelKey: "filters.advanced.statusExpired",
		fallback: "Expired users",
	},
	{
		key: "limited",
		labelKey: "filters.advanced.statusLimited",
		fallback: "Limited users",
	},
	{
		key: "disabled",
		labelKey: "filters.advanced.statusDisabled",
		fallback: "Disabled users",
	},
	{
		key: "on_hold",
		labelKey: "filters.advanced.statusOnHold",
		fallback: "On-hold users",
	},
];

export type FilterProps = {
	for?: "users" | "admins";
	actionsSlot?: React.ReactNode;
	showRefresh?: boolean;
} & ComponentPropsWithoutRef<"div">;

export const Filters: FC<FilterProps> = ({
	for: target = "users",
	actionsSlot,
	showRefresh = true,
	...props
}) => {
	const usersLoading = useDashboard((state) => state.loading);
	const userFilters = useDashboard((state) => state.filters);
	const onUserFilterChange = useDashboard((state) => state.onFilterChange);
	const refetchUsers = useDashboard((state) => state.refetchUsers);
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const adminsLoading = useAdminsStore((state) => state.loading);
	const adminFilters = useAdminsStore((state) => state.filters);
	const onAdminFilterChange = useAdminsStore(
		(state) => state.onFilterChange,
	);
	const fetchAdmins = useAdminsStore((state) => state.fetchAdmins);
	const fetchAdminOptions = useAdminsStore(
		(state) => state.fetchAdminOptions,
	);
	const openAdminDialog = useAdminsStore((state) => state.openAdminDialog);
	const adminOptions = useAdminsStore((state) => state.adminOptions);
	const { t } = useTranslation();
	const [search, setSearch] = useState("");
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const hasFullAccess = userData.role === AdminRole.FullAccess;
	const userManagementLocked = isUserManagementLocked(userData);
	const canViewTraffic = canViewUserTraffic(userData);
	const isCurrentAdminDisabled =
		!hasPrivilegedRole && userData.status === AdminStatus.Disabled;
	const canManageAdmins = Boolean(
		userData.permissions?.admin_management?.[AdminManagementPermission.Edit] ||
			userData.role === AdminRole.FullAccess,
	);
	const canCreateUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Create]);
	const showCreateButton =
		target === "users"
			? canCreateUsers && !isCurrentAdminDisabled && !userManagementLocked
			: canManageAdmins;

	const loading = target === "users" ? usersLoading : adminsLoading;
	const isUserFilters = target === "users";
	const filters = isUserFilters ? userFilters : adminFilters;
	const matchOptions = {
		matchCase: Boolean(filters.matchCase),
		matchWholeWord: Boolean(filters.matchWholeWord),
	};
	const userFiltersOnly = isUserFilters ? userFilters : undefined;
	const showAdvancedFilters = Boolean(userFiltersOnly);
	const activeFilters: string[] = userFiltersOnly?.advancedFilters ?? [];
	const serviceId = userFiltersOnly?.serviceId;
	const ownerFilter = userFiltersOnly?.owner;
	const adminActiveFilterCount =
		(adminFilters.roleFilter ? 1 : 0) + (adminFilters.statusFilter ? 1 : 0);
	const adminSortOptions = useMemo<SortOption[]>(
		() => [
			{ id: "username", label: t("username"), type: "text" },
			{ id: "status", label: t("status"), type: "text" },
			{ id: "role", label: t("core.role"), type: "text" },
			{ id: "users_count", label: t("admins.details.activeLabel"), type: "number" },
			{ id: "online", label: t("admins.details.onlineLabel"), type: "number" },
			{ id: "services", label: t("services.title"), type: "number" },
			{ id: "data_usage", label: t("usersTable.traffic"), type: "number" },
			{ id: "remaining_traffic", label: t("usersTable.remainingTraffic"), type: "number" },
			{ id: "expire", label: t("expire"), type: "date" },
		],
		[t],
	);
	const adminSorting: SortingState = adminFilters.sort
		? [
				{
					id: adminFilters.sort.replace(/^-/, ""),
					desc: adminFilters.sort.startsWith("-"),
				},
			]
		: [];
	const handleAdminSortChange = (next: SortingState) => {
		const item = next[0];
		onAdminFilterChange({
			sort: item ? `${item.desc ? "-" : ""}${item.id}` : "username",
			offset: 0,
		});
	};
	const rawServiceOptions = useServicesStore((state) => state.serviceOptions);
	const fetchServiceOptions = useServicesStore(
		(state) => state.fetchServiceOptions,
	);
	const serviceOptions = Array.isArray(rawServiceOptions)
		? rawServiceOptions
		: [];
	const safeAdminOptions = Array.isArray(adminOptions) ? adminOptions : [];
	const debouncedSearchChange = useMemo(
		() =>
			debounce((nextSearch: string) => {
				if (isUserFilters) {
					onUserFilterChange({
						search: nextSearch,
						offset: 0,
					});
				} else {
					onAdminFilterChange({
						search: nextSearch,
						offset: 0,
					});
				}
			}, 300),
		[isUserFilters, onAdminFilterChange, onUserFilterChange],
	);

	useEffect(() => {
		return () => {
			debouncedSearchChange.cancel();
		};
	}, [debouncedSearchChange]);

	useEffect(() => {
		fetchServiceOptions({ limit: 1000 });
	}, [fetchServiceOptions]);

	useEffect(() => {
		if (isUserFilters && hasPrivilegedRole) {
			fetchAdminOptions({ limit: 1000, offset: 0, sort: "username" });
		}
	}, [fetchAdminOptions, hasPrivilegedRole, isUserFilters]);

	useEffect(() => {
		const nextSearch = isUserFilters
			? (userFilters.search ?? "")
			: (adminFilters.search ?? "");
		setSearch(nextSearch);
	}, [isUserFilters, userFilters.search, adminFilters.search]);

	const getFilterLabel = (filterKey: string) => {
		const option = ADVANCED_FILTER_OPTIONS.find(
			(item) => item.key === filterKey,
		);
		return option ? t(option.labelKey, option.fallback) : filterKey;
	};

	const toggleAdvancedFilter = (filterKey: string) => {
		if (!showAdvancedFilters) {
			return;
		}
		const nextFilters = activeFilters.includes(filterKey)
			? activeFilters.filter((item) => item !== filterKey)
			: [...activeFilters, filterKey];
		onUserFilterChange({
			advancedFilters: nextFilters,
			offset: 0,
		});
	};

	const clearAdvancedFilters = () => {
		if (!showAdvancedFilters || activeFilters.length === 0) {
			return;
		}
		onUserFilterChange({
			advancedFilters: [],
			offset: 0,
		});
	};

	const handleServiceChange = (value: string) => {
		onUserFilterChange({
			serviceId: value ? Number(value) : undefined,
			offset: 0,
		});
	};

	const handleAdminChange = (value: string) => {
		onUserFilterChange({
			owner: value || undefined,
			offset: 0,
		});
	};

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(e.target.value);
		debouncedSearchChange(e.target.value);
	};
	const clear = () => {
		debouncedSearchChange.cancel();
		setSearch("");
		if (isUserFilters) {
			onUserFilterChange({
				...userFilters,
				offset: 0,
				search: "",
			});
		} else {
			onAdminFilterChange({
				search: "",
				offset: 0,
			});
		}
	};

	const handleRefresh = () => {
		if (target === "users") {
			refetchUsers(true);
		} else {
			fetchAdmins(undefined, { force: true });
		}
	};

	const handleCreate = () => {
		if (target === "users") {
			if (isCurrentAdminDisabled || !canCreateUsers) {
				return;
			}
			if (userManagementLocked) {
				return;
			}
			onCreateUser(true);
		} else {
			if (canManageAdmins) {
				openAdminDialog();
			}
		}
	};

	const isMobile = useBreakpointValue({ base: true, sm: false }) ?? false;

	return (
		<div id="filters" {...props} className="grid lg:grid-cols-[repeat(3,_1fr)] md:grid-cols-[repeat(2,_1fr)] grid-cols-[1fr] mx-0 lg:gap-4 md:gap-4 gap-4 py-4">
			<div className="col-span-1 md:col-span-1 lg:col-span-1 order-2 md:order-1">
				<div className="flex flex-col gap-2 items-stretch w-full">
					{isUserFilters && (
						<div className="flex flex-row gap-1 items-center">
							<p className="text-[0.75rem] text-gray-500">
								{t("users.searchHelpLabel")}
							</p>
							<Tooltip label={t("users.searchHelp")} placement="top" hasArrow>
								<div className="inline-flex items-center">
									<HelpIcon />
								</div>
							</Tooltip>
						</div>
					)}
					<div className="flex flex-row gap-2 items-center w-full flex-wrap">
						<SearchInput containerProps={{ className: "flex-[1_1_100%] sm:flex-[1_1_auto] min-w-[100%]! sm:min-w-[240px]! max-w-[100%] sm:max-w-none" }} placeholder={
								target === "users" ? t("search") : t("admins.searchPlaceholder")
								} value={search} onChange={onChange} matchOptions={matchOptions} onMatchOptionsChange={(options) => {
								if (isUserFilters) {
									onUserFilterChange({ ...options, offset: 0 });
								} else {
									onAdminFilterChange({ ...options, offset: 0 });
								}
							}} isLoading={loading} onClear={clear} className="border-light-border!" />
						{!isUserFilters && (
							<Popover placement="bottom-start">
								<PopoverTrigger>
									<Button leftIcon={<FilterIcon />} size={isMobile ? "sm" : "md"} variant="outline" className={cn("flex-[1_1_auto] sm:flex-[0_1_auto]", isMobile ? "min-w-[auto]!" : "min-w-[8rem]!", isMobile ? "h-[36px]" : "", isMobile ? "text-[0.75rem]" : "text-[0.875rem]")}>
										{t("admins.filters.title")}
										{adminActiveFilterCount > 0 ? ` (${adminActiveFilterCount})` : ""}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="border-light-border! min-w-[250px]!">
									<PopoverArrow />
									<PopoverCloseButton />
									<PopoverHeader className="font-semibold">
										{t("admins.filters.title")}
									</PopoverHeader>
									<PopoverBody>
										<div className="flex flex-col gap-3">
											<div>
												<p className="text-[0.875rem] font-semibold mb-1">
													{t("admins.filters.role")}
												</p>
												<Select
													value={adminFilters.roleFilter}
													onChange={(event) =>
														onAdminFilterChange({ roleFilter: event.target.value, offset: 0 })
													}
													portalled={false}
													size="sm"
												>
													<option value="">{t("admins.filters.all")}</option>
													<option value="full_access">{t("admins.filters.roleFullAccess")}</option>
													<option value="sudo">{t("admins.filters.roleSudo")}</option>
													<option value="reseller">{t("admins.filters.roleReseller")}</option>
													<option value="standard">{t("admins.filters.roleStandard")}</option>
												</Select>
											</div>
											<div>
												<p className="text-[0.875rem] font-semibold mb-1">
													{t("admins.filters.status")}
												</p>
												<Select
													value={adminFilters.statusFilter}
													onChange={(event) =>
														onAdminFilterChange({ statusFilter: event.target.value, offset: 0 })
													}
													portalled={false}
													size="sm"
												>
													<option value="">{t("admins.filters.all")}</option>
													<option value="active">{t("admins.filters.statusActive")}</option>
													<option value="disabled">{t("admins.filters.statusDisabled")}</option>
													<option value="expired">{t("admins.filters.statusExpired")}</option>
													<option value="limited">{t("admins.filters.statusLimited")}</option>
												</Select>
											</div>
										</div>
										<Button variant="ghost" size="sm" onClick={() =>
												onAdminFilterChange({ roleFilter: "", statusFilter: "", offset: 0 })
											} isDisabled={adminActiveFilterCount === 0} className="mt-3 w-full">
											{t("admins.filters.clear")}
										</Button>
									</PopoverBody>
								</PopoverContent>
							</Popover>
						)}
						{!isUserFilters && (
							<DataTableSortMenu
								options={adminSortOptions}
								sorting={adminSorting}
								onSortingChange={handleAdminSortChange}
							/>
						)}
						{showAdvancedFilters && (
							<Popover placement="bottom-start">
								<PopoverTrigger>
									<Button leftIcon={<FilterIcon />} size={isMobile ? "sm" : "md"} variant="outline" className={cn("flex-[1_1_auto] sm:flex-[0_1_auto]", isMobile ? "min-w-[auto]!" : "min-w-[8rem]!", isMobile ? "h-[36px]" : "", isMobile ? "text-[0.75rem]" : "text-[0.875rem]")}>
										{t("filters.advancedButton")}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="border-light-border! min-w-[250px]!">
									<PopoverArrow />
									<PopoverCloseButton />
									<PopoverHeader className="font-semibold">
										{t("filters.advancedTitle")}
									</PopoverHeader>
									<PopoverBody>
										<div className="flex flex-col gap-2">
											{ADVANCED_FILTER_OPTIONS.filter(
												(option) => option.key !== "top_speed" || canViewTraffic,
											).map((option) => (
												<Checkbox key={option.key} isChecked={activeFilters.includes(option.key)} onChange={() => toggleAdvancedFilter(option.key)}>
													{getFilterLabel(option.key)}
												</Checkbox>
											))}
										</div>
										<div className="flex flex-col gap-3 mt-3">
											<div>
												<p className="text-[0.875rem] font-semibold mb-1">
													{t("filters.advanced.serviceLabel")}
												</p>
												<Select
													value={serviceId ? String(serviceId) : ""}
													onChange={(event) =>
														handleServiceChange(event.target.value)
													}
													size="sm"
												>
													<option value="">
														{t("filters.advanced.serviceAll")}
													</option>
													{serviceOptions.map((service) => (
														<option key={service.id} value={String(service.id)}>
															{service.name}
														</option>
													))}
												</Select>
											</div>
											{hasPrivilegedRole && (
												<div>
													<p className="text-[0.875rem] font-semibold mb-1">
														{t("filters.advanced.adminLabel")}
													</p>
													<Select
														value={ownerFilter ?? ""}
														onChange={(event) =>
															handleAdminChange(event.target.value)
														}
														size="sm"
													>
														<option value="">
															{t("filters.advanced.adminAll")}
														</option>
														<option value={userData.username}>
															{t("filters.advanced.adminMyUsers")}
														</option>
														{safeAdminOptions.map((record) => (
															<option
																key={record.username}
																value={record.username}
															>
																{record.username}
															</option>
														))}
													</Select>
												</div>
											)}
										</div>
										<Button variant="ghost" size="sm" onClick={clearAdvancedFilters} isDisabled={activeFilters.length === 0} className="mt-3 w-full">
											{t("filters.advancedClear")}
										</Button>
									</PopoverBody>
								</PopoverContent>
							</Popover>
						)}
						{showRefresh && (
							<Button aria-label={t("refresh")} isDisabled={loading} onClick={handleRefresh} size={isMobile ? "sm" : "md"} variant="outline" leftIcon={
									<ReloadIcon className={cn(classNames({
											"animate-spin": loading,
										}))} />
								} className={cn("flex-[1_1_auto] sm:flex-[0_1_auto]", isMobile ? "min-w-[auto]!" : "min-w-[8rem]!", isMobile ? "h-[36px]" : "", isMobile ? "text-[0.75rem]" : "text-[0.875rem]")}>
								{t("refresh")}
							</Button>
						)}
					</div>
					{showAdvancedFilters &&
						(activeFilters.length > 0 ||
							Boolean(serviceId) ||
							Boolean(ownerFilter)) && (
							<div className="flex flex-wrap mt-2 gap-2">
								{activeFilters.map((filterKey) => (
									<Tag key={filterKey} size="sm" variant="solid" colorScheme="primary" className="rounded-full">
										<TagLabel>{getFilterLabel(filterKey)}</TagLabel>
										<TagCloseButton onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												toggleAdvancedFilter(filterKey);
											}} />
									</Tag>
								))}
								{serviceId && (
									<Tag key="service" size="sm" variant="solid" colorScheme="primary" className="rounded-full">
										<TagLabel>
											{t("filters.advanced.serviceTag", {
												name:
													serviceOptions.find(
														(service) => service.id === serviceId,
													)?.name ?? serviceId,
											})}
										</TagLabel>
										<TagCloseButton onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												handleServiceChange("");
											}} />
									</Tag>
								)}
								{ownerFilter && (
									<Tag key="owner" size="sm" variant="solid" colorScheme="primary" className="rounded-full">
										<TagLabel>
											{ownerFilter === userData.username
												? t("filters.advanced.adminTagMine")
												: ownerFilter}
										</TagLabel>
										<TagCloseButton onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												handleAdminChange("");
											}} />
									</Tag>
								)}
							</div>
						)}
				</div>
			</div>
			<div className="col-span-1 md:col-span-1 lg:col-span-2 order-1 md:order-2">
				<div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-start md:justify-end items-stretch sm:items-center w-full flex-wrap">
					{actionsSlot}
					{showCreateButton && (
						<Button colorScheme="primary" size="sm" onClick={handleCreate} isDisabled={target === "admins" && !canManageAdmins} leftIcon={isMobile ? undefined : <PlusIconStyled />} className={cn("h-[36px] px-3 rounded-[4px] font-semibold whitespace-nowrap w-full sm:w-auto", isMobile ? "min-w-[auto]!" : "min-w-[8rem]!", isMobile ? "text-[0.75rem]" : "text-[0.875rem]")}>
							{target === "users" ? t("createUser") : t("admins.addAdmin")}
						</Button>
					)}
				</div>
			</div>
		</div>
	);
};

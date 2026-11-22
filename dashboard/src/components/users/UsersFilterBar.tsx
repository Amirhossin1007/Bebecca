import type { SortingState } from "@tanstack/react-table";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import {
	LabelFilter,
	type LabelFilterValue,
	labelFilterCount,
} from "components/labels/LabelFilter";
import { Badge } from "components/ui/badge";
import { Button, buttonVariants } from "components/ui/button";
import { Checkbox } from "components/ui/checkbox";
import {
	DataTableSortMenu,
	type SortOption,
} from "components/ui/DataTableSortMenu";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "components/ui/tooltip";
import { ADVANCED_FILTER_OPTIONS } from "constants/advancedFilters";
import { useAdminsStore } from "contexts/AdminsContext";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import { cn } from "lib/cn";
import debounce from "lodash.debounce";
import { Filter, HelpCircle, Plus } from "lucide-react";
import type React from "react";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminRole, AdminStatus, UserPermissionToggle } from "types/Admin";
import { canViewUserTraffic, isUserManagementLocked } from "utils/adminTraffic";

const formatChipCount = (value: number, locale: string) =>
	new Intl.NumberFormat(locale || "en").format(value);

export const UsersFilterBar: FC = () => {
	const loading = useDashboard((state) => state.loading);
	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir() === "rtl";
	const locale = i18n.language || "en";
	const [search, setSearch] = useState("");
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const canViewTraffic = canViewUserTraffic(userData);

	const userSortOptions = useMemo<SortOption[]>(
		() => [
			{ id: "username", label: t("username"), type: "text" },
			{ id: "id", label: t("usersTable.userId"), type: "number" },
			{ id: "status", label: t("usersTable.status"), type: "text" },
			{ id: "service", label: t("usersTable.service"), type: "text" },
			{ id: "admin", label: t("usersTable.admin"), type: "text" },
			{ id: "used_traffic", label: t("usersTable.traffic"), type: "number" },
			{
				id: "remaining_traffic",
				label: t("usersTable.remainingTraffic"),
				type: "number",
			},
			{
				id: "lifetime_used_traffic",
				label: t("usersTable.lifetimeUsage"),
				type: "number",
			},
			{ id: "expire", label: t("usersTable.expire"), type: "date" },
			{ id: "online", label: t("usersTable.online"), type: "date" },
			{
				id: "last_connection",
				label: t("bulkActions.delete.lastOnline"),
				type: "date",
			},
		],
		[t],
	);

	const userSortKey = (filters.sort ?? "").replace(/^-/, "");
	const userSorting: SortingState = userSortOptions.some(
		(option) => option.id === userSortKey,
	)
		? [{ id: userSortKey, desc: (filters.sort ?? "").startsWith("-") }]
		: [];

	const handleUserSortChange = (next: SortingState) => {
		const item = next[0];
		onFilterChange({
			sort: item ? `${item.desc ? "-" : ""}${item.id}` : "-created_at",
			offset: 0,
		});
	};

	const activeFilters = filters.advancedFilters ?? [];
	const serviceId = filters.serviceId;
	const ownerFilter = filters.owner;
	const labelFilter: LabelFilterValue = {
		groups: filters.groups ?? [],
		tags: filters.tags ?? [],
		tagMatchAll: Boolean(filters.tagMatchAll),
	};
	const matchOptions = {
		matchCase: Boolean(filters.matchCase),
		matchWholeWord: Boolean(filters.matchWholeWord),
	};
	const rawServiceOptions = useServicesStore((state) => state.serviceOptions);
	const fetchServiceOptions = useServicesStore(
		(state) => state.fetchServiceOptions,
	);
	const serviceOptions = Array.isArray(rawServiceOptions)
		? rawServiceOptions
		: [];
	const adminOptions = useAdminsStore((state) => state.adminOptions);
	const fetchAdminOptions = useAdminsStore((state) => state.fetchAdminOptions);
	const safeAdminOptions = Array.isArray(adminOptions) ? adminOptions : [];

	const debouncedSearchChange = useMemo(
		() =>
			debounce((nextSearch: string) => {
				onFilterChange({
					search: nextSearch,
					offset: 0,
				});
			}, 300),
		[onFilterChange],
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
		if (hasPrivilegedRole) {
			fetchAdminOptions({ limit: 1000, offset: 0, sort: "username" });
		}
	}, [fetchAdminOptions, hasPrivilegedRole]);

	useEffect(() => {
		setSearch(filters.search ?? "");
	}, [filters.search]);

	const getFilterLabel = (filterKey: string) => {
		const option = ADVANCED_FILTER_OPTIONS.find(
			(item) => item.key === filterKey,
		);
		return option ? t(option.labelKey, option.fallback) : filterKey;
	};

	const toggleAdvancedFilter = (filterKey: string) => {
		const nextFilters = activeFilters.includes(filterKey)
			? activeFilters.filter((item) => item !== filterKey)
			: [...activeFilters, filterKey];
		onFilterChange({
			advancedFilters: nextFilters,
			offset: 0,
		});
	};

	const clearAdvancedFilters = () => {
		if (
			activeFilters.length === 0 &&
			!serviceId &&
			!ownerFilter &&
			labelFilterCount(labelFilter) === 0
		) {
			return;
		}
		onFilterChange({
			advancedFilters: [],
			serviceId: undefined,
			owner: undefined,
			groups: [],
			tags: [],
			tagMatchAll: false,
			offset: 0,
		});
	};

	const handleServiceChange = (value: string) => {
		onFilterChange({
			serviceId: value ? Number(value) : undefined,
			offset: 0,
		});
	};

	const handleAdminChange = (value: string) => {
		onFilterChange({
			owner: value || undefined,
			offset: 0,
		});
	};

	const onSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setSearch(event.target.value);
		debouncedSearchChange(event.target.value);
	};

	const clearSearch = () => {
		debouncedSearchChange.cancel();
		setSearch("");
		onFilterChange({
			...filters,
			offset: 0,
			search: "",
		});
	};

	const activeFilterTotal =
		activeFilters.length +
		(serviceId ? 1 : 0) +
		(ownerFilter ? 1 : 0) +
		labelFilterCount(labelFilter);
	const hasClearableFilters = activeFilterTotal > 0;

	return (
		<div className="flex w-full min-w-0 flex-wrap items-center gap-2">
			<div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[460px]">
				<SearchInput
					containerProps={{ className: "min-w-0 flex-1" }}
					placeholder={t("search")}
					value={search}
					onChange={onSearchChange}
					matchOptions={matchOptions}
					onMatchOptionsChange={(options) =>
						onFilterChange({
							matchCase: options.matchCase,
							matchWholeWord: options.matchWholeWord,
							offset: 0,
						})
					}
					loading={loading}
					onClear={clearSearch}
					rightElement={
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-flex cursor-pointer items-center px-1 text-panel-text-muted transition-colors min-[769px]:hover:text-panel-text">
									<HelpCircle className="size-3.5" />
								</div>
							</TooltipTrigger>
							<TooltipContent className="rounded-xl border-panel-border bg-panel-elevated text-xs">
								{t("users.searchHelp")}
							</TooltipContent>
						</Tooltip>
					}
					className="h-9 rounded-xl border-panel-border bg-panel-surface text-xs focus-visible:border-panel-accent focus-visible:bg-panel-elevated"
				/>

				<DataTableSortMenu
					options={userSortOptions}
					sorting={userSorting}
					onSortingChange={handleUserSortChange}
				/>
			</div>

			<Popover>
				<PopoverTrigger asChild>
					<div className="relative shrink-0">
						<Button
							aria-label={t("filters.advancedButton")}
							variant="outline"
							size="icon"
							className={cn(
								"size-9 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation",
								hasClearableFilters &&
									"border-panel-accent/50 text-panel-accent",
							)}
						>
							<Filter className="size-3.5" />
						</Button>
						{hasClearableFilters && (
							<Badge className="pointer-events-none absolute -top-1.5 -end-1.5 size-4 rounded-full bg-panel-accent p-0 text-[10px] font-bold text-white shadow-xs">
								{formatChipCount(activeFilterTotal, locale)}
							</Badge>
						)}
					</div>
				</PopoverTrigger>
				<PopoverContent
					align="start"
					dir={isRTL ? "rtl" : "ltr"}
					collisionPadding={12}
					className="w-84 max-w-[calc(100vw-24px)] rounded-2xl border-panel-border! bg-panel-elevated p-4 shadow-xl"
				>
					<div className="mb-3 flex items-center justify-between border-b border-panel-border pb-2.5">
						<span className="text-sm font-semibold text-panel-text">
							{t("filters.advancedTitle")}
						</span>
						{hasClearableFilters && (
							<Button
								onClick={clearAdvancedFilters}
								variant="ghost"
								size="sm"
								className="h-7 px-2 text-xs text-panel-text-muted min-[769px]:hover:text-panel-accent"
							>
								{t("filters.advancedClear")}
							</Button>
						)}
					</div>
					<div className="flex flex-col gap-2 max-h-[min(380px,60vh)] overflow-y-auto pe-1">
						<div className="flex flex-col gap-1.5">
							{ADVANCED_FILTER_OPTIONS.filter(
								(option) => option.key !== "top_speed" || canViewTraffic,
							).map((option) => (
								<label
									key={option.key}
									className="flex cursor-pointer items-center gap-2 rounded-xl p-1.5 text-xs text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-surface min-[769px]:hover:text-panel-text"
								>
									<Checkbox
										checked={activeFilters.includes(option.key)}
										onCheckedChange={() => toggleAdvancedFilter(option.key)}
									/>
									<span>{getFilterLabel(option.key)}</span>
								</label>
							))}
						</div>
						<div className="mt-3 flex flex-col gap-3 border-t border-panel-border pt-3">
							<div>
								<p className="mb-1 text-xs font-semibold text-panel-text-secondary">
									{t("filters.advanced.serviceLabel")}
								</p>
								<Select
									value={serviceId ? String(serviceId) : ""}
									onChange={(event) => handleServiceChange(event.target.value)}
									portalled={false}
									size="sm"
								>
									<option value="">{t("filters.advanced.serviceAll")}</option>
									{serviceOptions.map((service) => (
										<option key={service.id} value={String(service.id)}>
											{service.name}
										</option>
									))}
								</Select>
							</div>
							{hasPrivilegedRole && (
								<div>
									<p className="mb-1 text-xs font-semibold text-panel-text-secondary">
										{t("filters.advanced.adminLabel")}
									</p>
									<Select
										value={ownerFilter ?? ""}
										onChange={(event) => handleAdminChange(event.target.value)}
										portalled={false}
										size="sm"
									>
										<option value="">{t("filters.advanced.adminAll")}</option>
										<option value={userData.username}>
											{t("filters.advanced.adminMyUsers")}
										</option>
										{safeAdminOptions.map((record) => (
											<option key={record.username} value={record.username}>
												{record.username}
											</option>
										))}
									</Select>
								</div>
							)}
							<LabelFilter
								type="user"
								value={labelFilter}
								onChange={(next) =>
									onFilterChange({
										groups: next.groups,
										tags: next.tags,
										tagMatchAll: next.tagMatchAll,
										offset: 0,
									})
								}
							/>
						</div>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};

export const UsersCreateButton: FC = () => {
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const { t } = useTranslation();
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const canCreateUsers =
		userData.role === AdminRole.FullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Create]);
	const isCurrentAdminDisabled =
		!hasPrivilegedRole && userData.status === AdminStatus.Disabled;
	const showCreateButton =
		canCreateUsers &&
		!isCurrentAdminDisabled &&
		!isUserManagementLocked(userData);

	if (!showCreateButton) return null;

	return (
		<button
			type="button"
			aria-label={t("createUser")}
			onClick={() => onCreateUser(true)}
			className={cn(
				buttonVariants({ size: "default" }),
				"h-9 shrink-0 gap-1.5 rounded-xl bg-panel-accent px-3.5 text-xs font-semibold text-white shadow-xs transition-colors min-[769px]:hover:bg-panel-accent/90 active:scale-[0.98] touch-manipulation whitespace-nowrap",
			)}
		>
			<Plus className="size-3.5" />
			<span>{t("createUser")}</span>
		</button>
	);
};

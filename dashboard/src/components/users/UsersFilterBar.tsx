import { useBreakpointValue } from "hooks/useBreakpointValue";
import { Tooltip } from "components/shadcn/tooltip";
import { Popover, PopoverArrow, PopoverBody, PopoverCloseButton, PopoverContent, PopoverHeader, PopoverTrigger } from "components/shadcn/popover";
import { Button, IconButton } from "components/shadcn/button";
import { Badge } from "components/shadcn/badge";
import { Checkbox } from "components/shadcn/selection";
import { buttonVariants } from "components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "lib/cn";
import { withClass } from "components/shadcn/icon";
import {
	FunnelIcon,
	QuestionMarkCircleIcon,
} from "@heroicons/react/24/outline";
import { PanelSelect as Select } from "components/common/PanelSelect";
import { SearchInput } from "components/common/SearchInput";
import { DataTableSortMenu, type SortOption } from "components/ui/DataTableSortMenu";
import { ADVANCED_FILTER_OPTIONS } from "components/Filters";
import { useAdminsStore } from "contexts/AdminsContext";
import { useDashboard } from "contexts/DashboardContext";
import { useServicesStore } from "contexts/ServicesContext";
import useGetUser from "hooks/useGetUser";
import type { SortingState } from "@tanstack/react-table";
import debounce from "lodash.debounce";
import type React from "react";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminRole, AdminStatus, UserPermissionToggle } from "types/Admin";
import { canViewUserTraffic, isUserManagementLocked } from "utils/adminTraffic";

const FilterIcon = withClass(FunnelIcon, "w-4 h-4");
const HelpIcon = withClass(QuestionMarkCircleIcon, "w-4 h-4");

const formatChipCount = (value: number, locale: string) =>
	new Intl.NumberFormat(locale || "en").format(value);

/**
 * Users-only search & filter bar: mobile-first search + advanced filters
 * popover. Intentionally separate from the shared <Filters /> so the
 * Admins page keeps its own untouched toolbar.
 */
export const UsersFilterBar: FC = () => {
	const loading = useDashboard((state) => state.loading);
	const filters = useDashboard((state) => state.filters);
	const onFilterChange = useDashboard((state) => state.onFilterChange);
	const onCreateUser = useDashboard((state) => state.onCreateUser);
	const { t, i18n } = useTranslation();
	const locale = i18n.language || "en";
	const [search, setSearch] = useState("");
	const { userData } = useGetUser();
	const hasPrivilegedRole =
		userData.role === AdminRole.Sudo || userData.role === AdminRole.FullAccess;
	const hasFullAccess = userData.role === AdminRole.FullAccess;
	const userManagementLocked = isUserManagementLocked(userData);
	const isCurrentAdminDisabled =
		!hasPrivilegedRole && userData.status === AdminStatus.Disabled;
	const canCreateUsers =
		hasFullAccess ||
		Boolean(userData.permissions?.users?.[UserPermissionToggle.Create]);
	const showCreateButton =
		canCreateUsers && !isCurrentAdminDisabled && !userManagementLocked;
	const canViewTraffic = canViewUserTraffic(userData);

	const userSortOptions = useMemo<SortOption[]>(
		() => [
			{ id: "username", label: t("username"), type: "text" },
			{ id: "id", label: t("usersTable.userId"), type: "number" },
			{ id: "status", label: t("usersTable.status"), type: "text" },
			{ id: "service", label: t("usersTable.service"), type: "text" },
			{ id: "admin", label: t("usersTable.admin"), type: "text" },
			{ id: "used_traffic", label: t("usersTable.traffic"), type: "number" },
			{ id: "remaining_traffic", label: t("usersTable.remainingTraffic"), type: "number" },
			{ id: "lifetime_used_traffic", label: t("usersTable.lifetimeUsage"), type: "number" },
			{ id: "expire", label: t("usersTable.expire"), type: "date" },
			{ id: "online", label: t("usersTable.online"), type: "date" },
			{ id: "last_connection", label: t("bulkActions.delete.lastOnline"), type: "date" },
		],
		[t],
	);
	const userSortKey = (filters.sort ?? "").replace(/^-/, "");
	const userSorting: SortingState = userSortOptions.some((option) => option.id === userSortKey)
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
		if (activeFilters.length === 0 && !serviceId && !ownerFilter) {
			return;
		}
		onFilterChange({
			advancedFilters: [],
			serviceId: undefined,
			owner: undefined,
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

	const handleCreate = () => {
		if (!showCreateButton) return;
		onCreateUser(true);
	};

	const isMobile = useBreakpointValue({ base: true, sm: false }) ?? false;

	const activeFilterTotal =
		activeFilters.length + (serviceId ? 1 : 0) + (ownerFilter ? 1 : 0);
	const hasClearableFilters = activeFilterTotal > 0;

	return (
		<div className="max-sm:contents sm:flex items-center gap-2 w-full min-w-0!">
			<SearchInput containerProps={{ className: "max-sm:basis-full sm:flex-[1_1_auto] min-w-0! max-w-[100%] sm:max-w-[380px]" }} placeholder={t("search")} value={search} onChange={onSearchChange} matchOptions={matchOptions} onMatchOptionsChange={(options) =>
					onFilterChange({
						matchCase: options.matchCase,
						matchWholeWord: options.matchWholeWord,
						offset: 0,
					})
				} loading={loading} onClear={clearSearch} rightElement={
					<Tooltip label={t("users.searchHelp")} placement="top" hasArrow>
						<div className="inline-flex items-center text-panel-text-muted px-1">
							<HelpIcon />
						</div>
					</Tooltip>
				} className="rounded-full border-panel-border! bg-panel-elevated focus-visible:border-primary-400! focus-visible:bg-panel-surface rb-users-search-input" />

			<DataTableSortMenu
				options={userSortOptions}
				sorting={userSorting}
				onSortingChange={handleUserSortChange}
			/>

			<Popover placement="bottom-end">
				<PopoverTrigger>
					<div className="relative shrink-0">
						<IconButton size="md" aria-label={t("filters.advancedButton")} variant="outline" className="rounded-full w-9 h-9" >{<FilterIcon />}</IconButton>
						{hasClearableFilters && (
							<Badge colorScheme="primary" variant="solid" className="top-[-4px] rounded-full absolute end-[-4px] text-[0.6rem] px-1.5 pointer-events-none rb-users-filter-badge">
								{formatChipCount(activeFilterTotal, locale)}
							</Badge>
						)}
					</div>
				</PopoverTrigger>
				<PopoverContent className="border-light-border! min-w-[260px]!">
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
								<Checkbox key={option.key} checked={activeFilters.includes(option.key)} onChange={() => toggleAdvancedFilter(option.key)}>
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
									<p className="text-[0.875rem] font-semibold mb-1">
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
						</div>
						<Button variant="ghost" size="sm" onClick={clearAdvancedFilters} disabled={!hasClearableFilters} className="mt-3 w-full">
							{t("filters.advancedClear")}
						</Button>
					</PopoverBody>
				</PopoverContent>
			</Popover>

			{/* On desktop the bulk/create actions sit at the end of the row;
				on mobile they stay compact next to the search field. */}
			{!isMobile && <div className="flex-[1_1_auto] min-w-0!" />}
			{showCreateButton && (
				<button
					type="button"
					aria-label={t("createUser")}
					onClick={handleCreate}
					className={cn(
						buttonVariants({ size: isMobile ? "icon" : "default" }),
						"shrink-0 bg-panel-accent text-white shadow-xs hover:bg-panel-accent-hover rb-users-create-btn",
						!isMobile && "gap-2 px-4 font-semibold",
					)}
				>
					<Plus className="size-4" />
					{!isMobile && t("createUser")}
				</button>
			)}
		</div>
	);
};

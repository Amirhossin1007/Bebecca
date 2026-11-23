import { PanelSelect as Select } from "components/common/PanelSelect";
import { Button } from "components/ui/button";
import { useAdminsStore } from "contexts/AdminsContext";
import { useDashboard } from "contexts/DashboardContext";
import { cn } from "lib/cn";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { type FC, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	setAdminsPerPageLimitSize,
	setUsersPerPageLimitSize,
} from "utils/userPreferenceStorage";

export type PaginationProps = {
	for?: "users" | "admins" | "services";
	total?: number;
	limit?: number;
	offset?: number;
	onPageChange?: (page: number) => void;
	onPageSizeChange?: (pageSize: number) => void;
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

export const Pagination: FC<PaginationProps> = ({
	for: target = "users",
	total: propTotal,
	limit: propLimit,
	offset: propOffset,
	onPageChange: propOnPageChange,
	onPageSizeChange: propOnPageSizeChange,
}) => {
	const { t, i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	const dashboardFilters = useDashboard((state) => state.filters);
	const onDashboardFilterChange = useDashboard((state) => state.onFilterChange);
	const dashboardTotal = useDashboard((state) => state.users.total);

	const adminFilters = useAdminsStore((state) => state.filters);
	const onAdminFilterChange = useAdminsStore((state) => state.onFilterChange);
	const adminTotal = useAdminsStore((state) => state.total);

	const isUsers = target === "users";
	const isAdmins = target === "admins";

	const total =
		propTotal ?? (isUsers ? dashboardTotal : isAdmins ? adminTotal : 0) ?? 0;
	const limit =
		propLimit ??
		(isUsers
			? (dashboardFilters.limit ?? 20)
			: isAdmins
				? (adminFilters.limit ?? 20)
				: 20);
	const offset =
		propOffset ??
		(isUsers
			? (dashboardFilters.offset ?? 0)
			: isAdmins
				? (adminFilters.offset ?? 0)
				: 0);

	const currentPage = Math.floor(offset / limit) + 1;
	const totalPages = Math.max(1, Math.ceil(total / limit));

	const handlePageChange = (page: number) => {
		const newOffset = (page - 1) * limit;
		if (propOnPageChange) {
			propOnPageChange(page);
		} else if (isUsers) {
			onDashboardFilterChange({ offset: newOffset });
		} else if (isAdmins) {
			onAdminFilterChange({ offset: newOffset });
		}
	};

	const handlePageSizeChange = (newLimit: number) => {
		if (isUsers) {
			setUsersPerPageLimitSize(String(newLimit));
			onDashboardFilterChange({ limit: newLimit, offset: 0 });
		} else if (isAdmins) {
			setAdminsPerPageLimitSize(String(newLimit));
			onAdminFilterChange({ limit: newLimit, offset: 0 });
		} else if (propOnPageSizeChange) {
			propOnPageSizeChange(newLimit);
		}
	};

	const pages = useMemo(() => {
		const maxVisible = 5;
		const start = Math.max(
			1,
			Math.min(currentPage - 2, totalPages - maxVisible + 1),
		);
		const end = Math.min(totalPages, start + maxVisible - 1);
		const list: number[] = [];
		for (let p = start; p <= end; p++) {
			list.push(p);
		}
		return list;
	}, [currentPage, totalPages]);

	if (total <= 0) return null;

	const startItem = offset + 1;
	const endItem = Math.min(total, offset + limit);

	return (
		<div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-panel-border bg-panel-card p-3 shadow-xs rb-data-table-pagination">
			<div className="flex items-center gap-3 text-xs text-panel-text-secondary">
				<span>
					{t("pagination.showing", {
						start: startItem,
						end: endItem,
						total,
						defaultValue: `${startItem}-${endItem} of ${total}`,
					})}
				</span>

				<div className="flex items-center gap-1.5">
					<span className="text-[11px] text-panel-text-muted">
						{t("pagination.perPage", "Per page")}:
					</span>
					<Select
						value={String(limit)}
						onChange={(e) => handlePageSizeChange(Number(e.target.value))}
						size="sm"
						className="w-16 h-7 text-xs rounded-lg border-panel-border bg-panel-surface"
					>
						{PAGE_SIZE_OPTIONS.map((size) => (
							<option key={size} value={size}>
								{size}
							</option>
						))}
					</Select>
				</div>
			</div>

			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onClick={() => handlePageChange(1)}
					className="size-8 p-0 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
					aria-label={t("pagination.first", "First page")}
				>
					<ChevronsLeft className={cn("size-4", isRTL && "rotate-180")} />
				</Button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onClick={() => handlePageChange(currentPage - 1)}
					className="size-8 p-0 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
					aria-label={t("pagination.previous", "Previous page")}
				>
					<ChevronLeft className={cn("size-4", isRTL && "rotate-180")} />
				</Button>

				<div className="flex items-center gap-1">
					{pages.map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => handlePageChange(p)}
							className={cn(
								"flex size-8 items-center justify-center rounded-xl text-xs font-semibold transition-all cursor-pointer",
								p === currentPage
									? "bg-panel-accent text-white shadow-xs"
									: "border border-panel-border/70 bg-panel-surface text-panel-text-secondary min-[769px]:hover:border-panel-accent min-[769px]:hover:text-panel-text",
							)}
						>
							{p}
						</button>
					))}
				</div>

				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onClick={() => handlePageChange(currentPage + 1)}
					className="size-8 p-0 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
					aria-label={t("pagination.next", "Next page")}
				>
					<ChevronRight className={cn("size-4", isRTL && "rotate-180")} />
				</Button>

				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onClick={() => handlePageChange(totalPages)}
					className="size-8 p-0 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary disabled:opacity-40"
					aria-label={t("pagination.last", "Last page")}
				>
					<ChevronsRight className={cn("size-4", isRTL && "rotate-180")} />
				</Button>
			</div>
		</div>
	);
};

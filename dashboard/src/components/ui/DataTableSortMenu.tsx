import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { cn } from "lib/cn";
import type { SortingState } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { DataTableColumn, DataTableSortType } from "./DataTable.types";

export type SortOption = {
	id: string;
	label: string;
	type: DataTableSortType;
};

type DataTableSortMenuProps = {
	options: SortOption[];
	sorting: SortingState;
	onSortingChange: (next: SortingState) => void;
};

export const isSortableColumn = <TData,>(column: DataTableColumn<TData>) =>
	column.sortable ?? Boolean(column.accessor || column.sortValue);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const readSortValue = <TData,>(column: DataTableColumn<TData>, row: TData): unknown => {
	if (column.sortValue) return column.sortValue(row);
	if (typeof column.accessor === "function") return column.accessor(row);
	return column.accessor ? row[column.accessor] : undefined;
};

const detectSortType = <TData,>(
	column: DataTableColumn<TData>,
	rows: TData[],
): DataTableSortType => {
	for (const row of rows.slice(0, 25)) {
		const value = readSortValue(column, row);
		if (value === null || value === undefined || value === "") continue;
		if (typeof value === "boolean") return "boolean";
		if (typeof value === "string") return ISO_DATE_PATTERN.test(value) ? "date" : "text";
		return "number";
	}
	return "number";
};

export const buildSortOptions = <TData,>(
	columns: DataTableColumn<TData>[],
	rows: TData[] = [],
): SortOption[] =>
	columns.filter(isSortableColumn).map((column) => {
		const label = [column.header, column.mobileLabel, column.mobileMetaLabel].find(
			(candidate): candidate is string =>
				typeof candidate === "string" && candidate.trim() !== "",
		);
		return {
			id: column.id,
			label: label ?? column.id,
			type: column.sortType ?? detectSortType(column, rows),
		};
	});

export const DataTableSortMenu = ({
	options,
	sorting,
	onSortingChange,
}: DataTableSortMenuProps) => {
	const { t } = useTranslation();
	const activeSort = sorting[0];

	const directionLabels = (type: DataTableSortType): [string, string] => {
		switch (type) {
			case "text":
				return [t("sort.textAsc", "A → Z"), t("sort.textDesc", "Z → A")];
			case "date":
				return [t("sort.dateAsc", "Oldest"), t("sort.dateDesc", "Newest")];
			case "boolean":
				return [t("sort.boolAsc", "Off first"), t("sort.boolDesc", "On first")];
			default:
				return [t("sort.numberAsc", "Low → High"), t("sort.numberDesc", "High → Low")];
		}
	};

	const applySort = (id: string, desc: boolean) => {
		const isSame = activeSort?.id === id && activeSort.desc === desc;
		onSortingChange(isSame ? [] : [{ id, desc }]);
	};

	return (
		<Popover>
			<PopoverTrigger asChild>
				<div className="relative inline-flex shrink-0">
					<Button
						aria-label={t("dataTable.sortOptions", "Sort options")}
						variant="outline"
						size="sm"
						className="size-9 rounded-xl border border-panel-border bg-panel-surface p-0 text-panel-text transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-accent active:scale-[0.98] touch-manipulation"
					>
						<ArrowUpDown className="size-4" />
					</Button>
					{activeSort ? (
						<span className="pointer-events-none absolute end-1.5 top-1.5 size-2 rounded-full bg-panel-accent ring-2 ring-panel-surface" />
					) : null}
				</div>
			</PopoverTrigger>

			<PopoverContent className="w-[300px] rounded-2xl border border-panel-border bg-panel-elevated p-2 shadow-2xl z-[2000]">
				<div className="p-1.5">
					<div className="flex items-center justify-between pb-2 px-1">
						<span className="text-xs font-semibold text-panel-text-secondary">
							{t("sort.title", "Sort by")}
						</span>
						{activeSort && (
							<button
								type="button"
								onClick={() => onSortingChange([])}
								className="text-[11px] font-medium text-panel-text-muted transition-colors min-[769px]:hover:text-panel-accent cursor-pointer"
							>
								{t("clear", "Clear")}
							</button>
						)}
					</div>
					<div className="flex flex-col gap-1">
						{options.map((option) => {
							const [ascLabel, descLabel] = directionLabels(option.type);
							const isActive = activeSort?.id === option.id;
							return (
								<div
									key={option.id}
									className={cn(
										"flex items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 transition-colors",
										isActive
											? "bg-panel-surface text-panel-text shadow-xs"
											: "text-panel-text-secondary min-[769px]:hover:bg-panel-surface/60",
									)}
								>
									<span className={cn("truncate text-xs min-w-0", isActive ? "font-semibold text-panel-text" : "font-medium")}>
										{option.label}
									</span>
									<div className="flex items-center gap-1 shrink-0">
										{[false, true].map((desc) => {
											const selected = isActive && activeSort?.desc === desc;
											const label = desc ? descLabel : ascLabel;
											const Icon = desc ? ArrowDown : ArrowUp;
											return (
												<button
													key={String(desc)}
													type="button"
													title={label}
													aria-label={`${option.label}: ${label}`}
													onClick={() => applySort(option.id, desc)}
													className={cn(
														"flex size-7 items-center justify-center rounded-lg border text-xs font-medium transition-all cursor-pointer active:scale-[0.96] touch-manipulation",
														selected
															? "border-panel-accent bg-panel-accent text-white shadow-xs"
															: "border-panel-border/70 bg-panel-surface text-panel-text-secondary min-[769px]:hover:border-panel-accent/60 min-[769px]:hover:text-panel-accent",
													)}
												>
													<Icon className="size-3.5" />
												</button>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
};

import type { SortingState } from "@tanstack/react-table";
import { Button } from "components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "components/ui/popover";
import { cn } from "lib/cn";
import { ArrowDown, ArrowUp, ArrowUpDown, X } from "lucide-react";
import { createElement } from "react";
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
	buttonClassName?: string;
};

export const isSortableColumn = <TData,>(column: DataTableColumn<TData>) =>
	column.sortable ?? Boolean(column.accessor || column.sortValue);

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;

const readSortValue = <TData,>(
	column: DataTableColumn<TData>,
	row: TData,
): unknown => {
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
		if (typeof value === "string")
			return ISO_DATE_PATTERN.test(value) ? "date" : "text";
		return "number";
	}
	return "number";
};

export const buildSortOptions = <TData,>(
	columns: DataTableColumn<TData>[],
	rows: TData[] = [],
): SortOption[] =>
	columns.filter(isSortableColumn).map((column) => {
		const label = [
			column.header,
			column.mobileLabel,
			column.mobileMetaLabel,
		].find(
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
	buttonClassName,
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
				return [
					t("sort.numberAsc", "Low → High"),
					t("sort.numberDesc", "High → Low"),
				];
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
						size="icon"
						className={cn(
							"size-9 rounded-xl border-panel-border bg-panel-surface text-panel-text-secondary transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text active:scale-[0.98] touch-manipulation",
							activeSort && "border-panel-accent/50 text-panel-accent",
							buttonClassName,
						)}
					>
						<ArrowUpDown className="size-3.5" />
					</Button>
					{activeSort && (
						<span
							aria-hidden="true"
							className="pointer-events-none absolute end-1.5 top-1.5 size-1.5 rounded-full bg-panel-accent ring-2 ring-panel-surface"
						/>
					)}
				</div>
			</PopoverTrigger>

			<PopoverContent
				align="start"
				collisionPadding={12}
				className="w-[300px] max-w-[calc(100vw-24px)] rounded-2xl border-panel-border! bg-panel-elevated p-3 shadow-xl"
			>
				<div className="p-1">
					<p className="px-1 pb-2 text-xs font-semibold text-panel-text-muted">
						{t("sort.title", "Sort by")}
					</p>
					<div className="flex max-h-[280px] flex-col gap-1 overflow-y-auto pe-1">
						{options.map((option) => {
							const [ascLabel, descLabel] = directionLabels(option.type);
							const isActive = activeSort?.id === option.id;
							return (
								<div
									key={option.id}
									className={cn(
										"flex items-center justify-between gap-2 rounded-xl p-1.5 transition-colors",
										isActive
											? "bg-panel-surface shadow-xs"
											: "min-[769px]:hover:bg-panel-surface/60",
									)}
								>
									<p
										className={cn(
											"truncate text-xs min-w-0!",
											isActive
												? "font-semibold text-panel-text"
												: "font-medium text-panel-text-secondary",
										)}
									>
										{option.label}
									</p>
									<div className="flex shrink-0 items-center gap-1">
										{[false, true].map((desc) => {
											const selected = isActive && activeSort?.desc === desc;
											return (
												<Button
													key={String(desc)}
													aria-pressed={selected}
													onClick={() => applySort(option.id, desc)}
													size="xs"
													className="h-6 rounded-lg px-2 text-[11px] font-medium"
													variant={selected ? "default" : "outline"}
												>
													{createElement(desc ? ArrowDown : ArrowUp, {
														className: "size-2.5 me-1",
													})}
													{desc ? descLabel : ascLabel}
												</Button>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
					{activeSort && (
						<Button
							onClick={() => onSortingChange([])}
							variant="ghost"
							size="xs"
							className="mt-2.5 h-7 w-full rounded-lg text-xs text-panel-text-muted min-[769px]:hover:bg-panel-surface min-[769px]:hover:text-panel-accent"
						>
							<X className="size-3.5 me-1.5" />
							{t("sort.clear", "Clear sort")}
						</Button>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
};

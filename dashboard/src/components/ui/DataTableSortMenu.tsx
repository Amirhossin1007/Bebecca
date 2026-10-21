import { Popover, PopoverBody, PopoverContent, PopoverTrigger } from "components/shadcn/popover";
import { Button, IconButton } from "components/shadcn/button";
import { Icon } from "components/shadcn/icon";
import { Portal } from "components/shadcn/portal";
import { cn } from "lib/cn";
import {
	ArrowDownIcon,
	ArrowUpIcon,
	ArrowsUpDownIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
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
	const mutedColor = "text-gray-500 dark:text-gray-400";
	const hoverBg = "hover:bg-gray-100 dark:hover:bg-whiteAlpha-100";
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
		<Popover placement="bottom-end" isLazy>
			<PopoverTrigger>
				<div className="relative inline-flex shrink-0">
					<IconButton aria-label={t("dataTable.sortOptions", "Sort options")} icon={<Icon as={ArrowsUpDownIcon} className="size-4" />} variant="outline" size="sm" className="rounded-lg" />
					{activeSort ? (
						<div className="top-[-2px] absolute end-[-2px] w-[8px] h-[8px] rounded-full bg-primary-400 pointer-events-none" />
					) : null}
				</div>
			</PopoverTrigger>
			<Portal>
				<PopoverContent className="w-[300px] rounded-xl z-[2000]">
					<PopoverBody className="p-2">
						<p className={cn("px-1 pb-1.5 text-[0.75rem] font-semibold", mutedColor)}>
							{t("sort.title", "Sort by")}
						</p>
						<div className="flex flex-col gap-0.5">
							{options.map((option) => {
								const [ascLabel, descLabel] = directionLabels(option.type);
								const isActive = activeSort?.id === option.id;
								return (
									<div key={option.id} className={cn("flex flex-row items-center justify-between gap-2 px-1.5 py-1 rounded-md", hoverBg)}>
										<p className={cn("text-[0.75rem] truncate min-w-0!", isActive ? "font-semibold" : "font-medium")}>
											{option.label}
										</p>
										<div className="flex flex-row items-center gap-1 shrink-0">
											{[false, true].map((desc) => {
												const selected = isActive && activeSort?.desc === desc;
												return (
													<Button key={String(desc)} size="xs" variant={selected ? "solid" : "outline"} colorScheme={selected ? "primary" : undefined} aria-pressed={selected} leftIcon={
															<Icon as={desc ? ArrowDownIcon : ArrowUpIcon} className="size-3" />
														} onClick={() => applySort(option.id, desc)} className="h-[22px] px-2 text-[0.75rem] font-medium rounded-full">
														{desc ? descLabel : ascLabel}
													</Button>
												);
											})}
										</div>
									</div>
								);
							})}
						</div>
						{activeSort ? (
							<Button size="xs" variant="ghost" leftIcon={<Icon as={XMarkIcon} className="size-3.5" />} onClick={() => onSortingChange([])} className="w-full mt-2">
								{t("sort.clear", "Clear sort")}
							</Button>
						) : null}
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	);
};

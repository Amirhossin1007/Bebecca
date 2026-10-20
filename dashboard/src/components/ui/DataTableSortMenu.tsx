import {
	Box,
	Button,
	HStack,
	Icon,
	IconButton,
	Popover,
	PopoverBody,
	PopoverContent,
	PopoverTrigger,
	Portal,
	Stack,
	Text,
	useColorModeValue,
} from "@chakra-ui/react";
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
	const mutedColor = useColorModeValue("gray.500", "gray.400");
	const hoverBg = useColorModeValue("gray.100", "whiteAlpha.100");
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
				<Box position="relative" display="inline-flex" flexShrink={0}>
					<IconButton
						aria-label={t("dataTable.sortOptions", "Sort options")}
						icon={<Icon as={ArrowsUpDownIcon} boxSize={4} />}
						variant="outline"
						size="sm"
						borderRadius="lg"
					/>
					{activeSort ? (
						<Box
							position="absolute"
							top="-2px"
							insetInlineEnd="-2px"
							w="8px"
							h="8px"
							borderRadius="full"
							bg="primary.400"
							pointerEvents="none"
						/>
					) : null}
				</Box>
			</PopoverTrigger>
			<Portal>
				<PopoverContent w="300px" borderRadius="xl" zIndex={2000}>
					<PopoverBody p={2}>
						<Text px={1} pb={1.5} fontSize="xs" fontWeight="semibold" color={mutedColor}>
							{t("sort.title", "Sort by")}
						</Text>
						<Stack spacing={0.5}>
							{options.map((option) => {
								const [ascLabel, descLabel] = directionLabels(option.type);
								const isActive = activeSort?.id === option.id;
								return (
									<HStack
										key={option.id}
										justify="space-between"
										spacing={2}
										px={1.5}
										py={1}
										borderRadius="md"
										_hover={{ bg: hoverBg }}
									>
										<Text
											fontSize="xs"
											noOfLines={1}
											minW={0}
											fontWeight={isActive ? "semibold" : "medium"}
										>
											{option.label}
										</Text>
										<HStack spacing={1} flexShrink={0}>
											{[false, true].map((desc) => {
												const selected = isActive && activeSort?.desc === desc;
												return (
													<Button
														key={String(desc)}
														size="xs"
														h="22px"
														px={2}
														fontSize="xs"
														fontWeight="medium"
														borderRadius="full"
														variant={selected ? "solid" : "outline"}
														colorScheme={selected ? "primary" : undefined}
														aria-pressed={selected}
														leftIcon={
															<Icon as={desc ? ArrowDownIcon : ArrowUpIcon} boxSize={3} />
														}
														onClick={() => applySort(option.id, desc)}
													>
														{desc ? descLabel : ascLabel}
													</Button>
												);
											})}
										</HStack>
									</HStack>
								);
							})}
						</Stack>
						{activeSort ? (
							<Button
								size="xs"
								variant="ghost"
								w="full"
								mt={2}
								leftIcon={<Icon as={XMarkIcon} boxSize={3.5} />}
								onClick={() => onSortingChange([])}
							>
								{t("sort.clear", "Clear sort")}
							</Button>
						) : null}
					</PopoverBody>
				</PopoverContent>
			</Portal>
		</Popover>
	);
};

import {
	Checkbox,
	IconButton,
	Menu,
	MenuButton,
	MenuList,
	Portal,
	Stack,
	Text,
	Tooltip,
} from "@chakra-ui/react";
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";
import type { DataTableColumn } from "./DataTable.types";

type DataTableColumnMenuProps<TData> = {
	columns: DataTableColumn<TData>[];
	visibility: Record<string, boolean>;
	onChange: (next: Record<string, boolean>) => void;
};

/**
 * Column chooser for the dashboard tables. Mirrors the "Columns" control of the
 * rebuilt dashboard, but keeps the panel's own menu styling so the table still
 * looks like the rest of the panel.
 */
export function DataTableColumnMenu<TData>({
	columns,
	visibility,
	onChange,
}: DataTableColumnMenuProps<TData>) {
	const { t } = useTranslation();
	// Structural columns (selection, actions) are not offered: hiding them would
	// leave the row without its controls.
	const choosable = columns.filter(
		(column) => !column.id.startsWith("__") && column.menuLabel !== undefined,
	);

	if (choosable.length === 0) return null;

	const visibleCount = choosable.filter(
		(column) => visibility[column.id] !== false,
	).length;

	return (
		<Menu placement="bottom-end" isLazy closeOnSelect={false}>
			<Tooltip label={t("next.table.toggleColumns")} placement="top" hasArrow>
				<MenuButton
					as={IconButton}
					aria-label={t("next.table.toggleColumns")}
					icon={<AdjustmentsHorizontalIcon width={16} />}
					size="sm"
					variant="outline"
					borderRadius="full"
				/>
			</Tooltip>
			<Portal>
				<MenuList
					zIndex={1800}
					minW="220px"
					bg="panel.surface"
					borderColor="panel.border"
				>
					<Stack spacing={2} px={3} py={2}>
						<Text fontSize="xs" color="panel.textMuted" textTransform="uppercase" letterSpacing="0.08em">
							{t("next.table.toggleColumns")} · {visibleCount}/{choosable.length}
						</Text>
						{choosable.map((column) => {
							const id = `column-${column.id}`;
							const checked = visibility[column.id] !== false;
							return (
								<Checkbox
									key={column.id}
									id={id}
									size="sm"
									isChecked={checked}
									onChange={(event) =>
										onChange({
											...visibility,
											[column.id]: event.target.checked,
										})
									}
								>
									<Text as="span" fontSize="sm">
										{column.menuLabel}
									</Text>
								</Checkbox>
							);
						})}
					</Stack>
				</MenuList>
			</Portal>
		</Menu>
	);
}

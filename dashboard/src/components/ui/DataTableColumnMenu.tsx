import { Menu, MenuButton, MenuList } from "components/shadcn/menu";
import { Tooltip } from "components/shadcn/tooltip";
import { IconButton } from "components/shadcn/button";
import { Portal } from "components/shadcn/portal";
import { Checkbox } from "components/shadcn/selection";
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
				<MenuButton as={IconButton} aria-label={t("next.table.toggleColumns")} icon={<AdjustmentsHorizontalIcon className="w-16" />} size="sm" variant="outline" className="rounded-full" />
			</Tooltip>
			<Portal>
				<MenuList className="z-[1800] min-w-[220px]! bg-panel-surface border-panel-border!">
					<div className="flex flex-col gap-2 px-3 py-2">
						<p className="text-[0.75rem] text-panel-text-muted uppercase tracking-[0.08em]">
							{t("next.table.toggleColumns")} · {visibleCount}/{choosable.length}
						</p>
						{choosable.map((column) => {
							const id = `column-${column.id}`;
							const checked = visibility[column.id] !== false;
							return (
								<Checkbox key={column.id} id={id} size="sm" isChecked={checked} onChange={(event) =>
										onChange({
											...visibility,
											[column.id]: event.target.checked,
										})
									}>
									<span className="text-[0.875rem]">
										{column.menuLabel}
									</span>
								</Checkbox>
							);
						})}
					</div>
				</MenuList>
			</Portal>
		</Menu>
	);
}

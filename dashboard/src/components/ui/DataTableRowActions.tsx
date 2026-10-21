import type { MouseEvent as ReactMouseEvent } from "react";
import { Menu, MenuButton, MenuItem, MenuList } from "components/shadcn/menu";
import { IconButton } from "components/shadcn/button";
import { Portal } from "components/shadcn/portal";
import { withClass } from "components/shadcn/icon";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { Fragment, type FC, type ReactElement, type ReactNode } from "react";

const EllipsisIcon = withClass(EllipsisHorizontalIcon, "w-5 h-5");

// Chakra colour token ("red.400") to a text class. The palette is safelisted in tailwind.css.
const toneClass = (color?: string) => (color ? `text-${color.replace(".", "-")}` : undefined);

export type RowActionItem = {
	id: string;
	label: ReactNode;
	icon?: ReactElement;
	onClick?: () => void;
	render?: (onClose: () => void) => ReactNode;
	isDisabled?: boolean;
	isDanger?: boolean;
	color?: string;
};

type RowActionsMenuProps = {
	actions: RowActionItem[];
	label?: string;
};

const getActionLabelText = (label: RowActionItem["label"]) =>
	typeof label === "string" || typeof label === "number"
		? String(label)
		: "";

const getActionPriority = (action: RowActionItem) => {
	const id = action.id.toLowerCase();
	const label = getActionLabelText(action.label).toLowerCase();
	if (id.includes("edit") || label.includes("edit")) return 0;
	if (action.isDanger || id.includes("delete") || label.includes("delete")) {
		return 100;
	}
	return 50;
};

export const orderRowActions = <TAction extends RowActionItem>(
	actions: TAction[],
) =>
	[...actions].sort((first, second) => {
		const priorityDelta = getActionPriority(first) - getActionPriority(second);
		if (priorityDelta !== 0) return priorityDelta;
		return 0;
	});

export const RowActionsMenu: FC<RowActionsMenuProps> = ({
	actions,
	label = "Actions",
}) => {
	if (actions.length === 0) return null;
	const orderedActions = orderRowActions(actions);

	return (
		<Menu placement="auto-end" strategy="fixed" autoSelect={false} isLazy>
			{({ onClose }) => (
				<>
					<MenuButton as={IconButton} aria-label={label} icon={<EllipsisIcon />} size="sm" variant="ghost" onClick={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()} className="min-w-[32px]! h-[32px] rb-row-action" />
					<Portal>
						<MenuList className="min-w-[220px]! max-w-[calc(100vw_-_24px)] max-h-[min(70vh,_420px)] overflow-y-auto overflow-x-hidden overscroll-contain z-[2500] rounded-lg shadow-2xl">
							{orderedActions.map((action) =>
								action.render ? (
									<Fragment key={action.id}>
										{action.render(onClose)}
									</Fragment>
								) : (
									<MenuItem key={action.id} icon={action.icon} onClick={(event) => {
											event.stopPropagation();
											action.onClick?.();
										}} isDisabled={action.isDisabled} className={toneClass(action.color ?? (action.isDanger ? "red.400" : undefined))}>
										{action.label}
									</MenuItem>
								),
							)}
						</MenuList>
					</Portal>
				</>
			)}
		</Menu>
	);
};

import { Fragment, useState, type FC, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode } from "react";
import { Ellipsis } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "components/ui/dropdown-menu";
import { RowActionButton } from "./row-actions";

// Chakra colour token ("red.400") to a text class. The palette is safelisted in tailwind.css.
const toneClass = (color?: string) => (color ? `text-${color.replace(".", "-")}` : undefined);

export type RowActionItem = {
	id: string;
	label: ReactNode;
	icon?: ReactElement;
	onClick?: () => void;
	render?: (onClose: () => void) => ReactNode;
	disabled?: boolean;
	disabledReason?: string;
	isDanger?: boolean;
	color?: string;
	pinned?: boolean;
};

type RowActionsMenuProps = {
	actions: RowActionItem[];
	label?: string;
};

const getActionLabelText = (label: RowActionItem["label"]) =>
	typeof label === "string" || typeof label === "number" ? String(label) : "";

const getActionPriority = (action: RowActionItem) => {
	const id = action.id.toLowerCase();
	const label = getActionLabelText(action.label).toLowerCase();
	if (id.includes("edit") || label.includes("edit")) return 0;
	if (action.isDanger || id.includes("delete") || label.includes("delete")) {
		return 100;
	}
	return 50;
};

export const orderRowActions = <TAction extends RowActionItem>(actions: TAction[]) =>
	[...actions].sort((first, second) => {
		const priorityDelta = getActionPriority(first) - getActionPriority(second);
		if (priorityDelta !== 0) return priorityDelta;
		return 0;
	});

export const RowActionsMenu: FC<RowActionsMenuProps> = ({ actions, label = "Actions" }) => {
	const [open, setOpen] = useState(false);
	if (actions.length === 0) return null;
	const orderedActions = orderRowActions(actions);
	const onClose = () => setOpen(false);

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<RowActionButton
					label={label}
					icon={<Ellipsis />}
					onClick={(event: ReactMouseEvent<HTMLButtonElement>) => event.stopPropagation()}
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="min-w-[220px]! max-w-[calc(100vw_-_24px)] max-h-[min(70vh,_420px)] overflow-y-auto overflow-x-hidden overscroll-contain z-[2500] rounded-lg shadow-2xl"
			>
				{orderedActions.map((action) =>
					action.render ? (
						<Fragment key={action.id}>{action.render(onClose)}</Fragment>
					) : (
						<DropdownMenuItem
							key={action.id}
							disabled={action.disabled}
							className={toneClass(action.color ?? (action.isDanger ? "red.400" : undefined))}
							onSelect={(event) => {
								event.stopPropagation();
								action.onClick?.();
							}}
						>
							{action.icon}
							{action.label}
						</DropdownMenuItem>
					),
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

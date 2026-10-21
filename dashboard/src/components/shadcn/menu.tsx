import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import {
	createContext,
	forwardRef,
	useContext,
	useState,
	type ComponentPropsWithoutRef,
	type ElementType,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
} from "react";
import { cn } from "lib/cn";
import { parsePlacement, type Align, type Side } from "components/shadcn/placement";

/**
 * Chakra's Menu on Radix DropdownMenu. The list and item look come from the
 * old Chakra menu theme, kept as classes (surface, border, shadow, px-3 items).
 */
const LIST_CLASS =
	"z-[1800] min-w-56! rounded-md border border-panel-border! bg-panel-surface py-2 text-panel-text shadow-[0_18px_48px_rgba(0,0,0,0.38)] outline-none";
const ITEM_CLASS =
	"flex w-full cursor-pointer select-none items-center px-3 py-1.5 text-start text-panel-text outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-panel-elevated";

type MenuContextValue = {
	side: Side;
	align: Align;
	gutter: number;
	closeOnSelect: boolean;
};

const MenuContext = createContext<MenuContextValue>({
	side: "bottom",
	align: "start",
	gutter: 8,
	closeOnSelect: true,
});

export function Menu({
	isOpen,
	onOpen,
	onClose,
	placement = "bottom-start",
	gutter = 8,
	closeOnSelect = true,
	children,
}: {
	isOpen?: boolean;
	onOpen?: () => void;
	onClose?: () => void;
	placement?: string;
	gutter?: number;
	closeOnSelect?: boolean;
	isLazy?: boolean;
	autoSelect?: boolean;
	matchWidth?: boolean;
	strategy?: string;
	children?: ReactNode | ((props: { onClose: () => void }) => ReactNode);
}) {
	const [inner, setInner] = useState(false);
	const open = isOpen ?? inner;
	const close = () => {
		if (isOpen === undefined) setInner(false);
		onClose?.();
	};
	const { side, align } = parsePlacement(placement);
	return (
		<MenuContext.Provider value={{ side, align, gutter, closeOnSelect }}>
			<DropdownMenuPrimitive.Root
				open={open}
				onOpenChange={(next) => {
					if (isOpen === undefined) setInner(next);
					if (next) onOpen?.();
					else onClose?.();
				}}
			>
				{typeof children === "function" ? children({ onClose: close }) : children}
			</DropdownMenuPrimitive.Root>
		</MenuContext.Provider>
	);
}

/** The trigger is a button, or the element passed as `as` (usually a Button, which must forwardRef). */
export const MenuButton = forwardRef<
	HTMLElement,
	ComponentPropsWithoutRef<"button"> & { as?: ElementType; [key: string]: any }
>(function MenuButton({ as: As = "button", children, ...props }, ref) {
	return (
		<DropdownMenuPrimitive.Trigger asChild>
			<As ref={ref} type={As === "button" ? "button" : undefined} {...props}>
				{children}
			</As>
		</DropdownMenuPrimitive.Trigger>
	);
});

export const MenuList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(
	function MenuList({ className, children, ...props }, ref) {
		const ctx = useContext(MenuContext);
		return (
			<DropdownMenuPrimitive.Portal>
				<DropdownMenuPrimitive.Content
					ref={ref}
					side={ctx.side}
					align={ctx.align}
					sideOffset={ctx.gutter}
					collisionPadding={8}
					className={cn(LIST_CLASS, className)}
					{...props}
				>
					{children}
				</DropdownMenuPrimitive.Content>
			</DropdownMenuPrimitive.Portal>
		);
	},
);

export const MenuItem = forwardRef<
	HTMLDivElement,
	Omit<ComponentPropsWithoutRef<"div">, "color" | "onSelect"> & {
		icon?: ReactNode;
		command?: ReactNode;
		isDisabled?: boolean;
		closeOnSelect?: boolean;
	}
>(function MenuItem({ icon, command, children, isDisabled, closeOnSelect, className, onClick, ...props }, ref) {
	const ctx = useContext(MenuContext);
	const keepOpen = closeOnSelect === false || (closeOnSelect === undefined && !ctx.closeOnSelect);
	return (
		<DropdownMenuPrimitive.Item
			ref={ref}
			disabled={isDisabled}
			onSelect={(event) => {
				if (keepOpen) event.preventDefault();
				onClick?.(event as unknown as ReactMouseEvent<HTMLDivElement>);
			}}
			className={cn(ITEM_CLASS, className)}
			{...props}
		>
			{icon ? <span className="me-2 inline-flex shrink-0">{icon}</span> : null}
			{children}
			{command ? <span className="ms-auto ps-3 text-sm opacity-60">{command}</span> : null}
		</DropdownMenuPrimitive.Item>
	);
});

export const MenuDivider = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function MenuDivider(
	{ className, ...props },
	ref,
) {
	return (
		<DropdownMenuPrimitive.Separator
			ref={ref}
			className={cn("my-2 h-px border-0 bg-panel-border!", className)}
			{...props}
		/>
	);
});

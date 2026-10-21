import { ChevronDownIcon } from "@heroicons/react/24/outline";
import {
	Children,
	cloneElement,
	createContext,
	forwardRef,
	isValidElement,
	useContext,
	useState,
	type ComponentPropsWithoutRef,
	type ReactElement,
	type ReactNode,
} from "react";
import { cn } from "lib/cn";
import { Collapse } from "components/shadcn/collapse";

/**
 * Chakra's Accordion. `index` is a number (single) or number[] (allowMultiple),
 * and `onChange` gets the same shape back, as in Chakra.
 */
type AccordionValue = {
	open: number[];
	toggle: (index: number) => void;
};

const AccordionContext = createContext<AccordionValue>({ open: [], toggle: () => {} });
const ItemContext = createContext<{ index: number; isOpen: boolean }>({ index: 0, isOpen: false });

const toArray = (value: number | number[] | undefined) =>
	value === undefined ? [] : Array.isArray(value) ? value : [value];

export function Accordion({
	allowMultiple = false,
	allowToggle = false,
	index,
	defaultIndex,
	onChange,
	className,
	children,
	...props
}: Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
	allowMultiple?: boolean;
	allowToggle?: boolean;
	index?: number | number[];
	defaultIndex?: number | number[];
	onChange?: (index: number | number[]) => void;
}) {
	const [inner, setInner] = useState<number[]>(toArray(defaultIndex));
	const controlled = index === undefined ? undefined : toArray(index);
	const open = controlled ?? inner;

	const toggle = (position: number) => {
		const isOpen = open.includes(position);
		let next: number[];
		if (allowMultiple) next = isOpen ? open.filter((item) => item !== position) : [...open, position];
		else if (isOpen) next = allowToggle ? [] : open;
		else next = [position];
		if (controlled === undefined) setInner(next);
		onChange?.(allowMultiple ? next : (next[0] ?? -1));
	};

	let position = 0;
	const items = Children.map(children, (child) =>
		isValidElement(child)
			? cloneElement(child as ReactElement<{ index?: number }>, { index: position++ })
			: child,
	);

	return (
		<AccordionContext.Provider value={{ open, toggle }}>
			<div className={className} {...props}>
				{items}
			</div>
		</AccordionContext.Provider>
	);
}

export const AccordionItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div"> & { index?: number }>(
	function AccordionItem({ index = 0, className, children, ...props }, ref) {
		const { open } = useContext(AccordionContext);
		return (
			<ItemContext.Provider value={{ index, isOpen: open.includes(index) }}>
				<div ref={ref} className={cn("border-b border-panel-border!", className)} {...props}>
					{children}
				</div>
			</ItemContext.Provider>
		);
	},
);

export const AccordionButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
	function AccordionButton({ className, children, ...props }, ref) {
		const { toggle } = useContext(AccordionContext);
		const { index, isOpen } = useContext(ItemContext);
		return (
			<button
				ref={ref}
				type="button"
				aria-expanded={isOpen}
				onClick={() => toggle(index)}
				className={cn(
					"flex w-full items-center justify-between px-4 py-2 text-start outline-none hover:bg-panel-elevated focus-visible:ring-2 focus-visible:ring-panel-accent/40",
					isOpen && "bg-panel-elevated",
					className,
				)}
				{...props}
			>
				{children}
			</button>
		);
	},
);

/** The chevron turns over when its item is open. */
export function AccordionIcon({ className }: { className?: string }) {
	const { isOpen } = useContext(ItemContext);
	return (
		<ChevronDownIcon
			aria-hidden
			className={cn("size-5 shrink-0 transition-transform", isOpen && "rotate-180", className)}
		/>
	);
}

export function AccordionPanel({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
	const { isOpen } = useContext(ItemContext);
	return (
		<Collapse in={isOpen} className={className} {...props}>
			<div className="bg-panel-surface px-4 pb-4 pt-2">{children as ReactNode}</div>
		</Collapse>
	);
}

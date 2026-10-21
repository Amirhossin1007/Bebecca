import {
	Children,
	cloneElement,
	createContext,
	forwardRef,
	isValidElement,
	useContext,
	useRef,
	useState,
	type ComponentPropsWithoutRef,
	type ReactElement,
} from "react";
import { cn } from "lib/cn";

/**
 * Chakra's Tabs. The index is assigned by position (TabList and TabPanels
 * clone their children with it), so the call sites keep `index`, `onChange`
 * and `isLazy`. `variant="unstyled"` adds no look, so className owns it.
 */
type TabsValue = {
	index: number;
	select: (index: number) => void;
	variant: string;
	colorScheme: string;
	isLazy: boolean;
};

const TabsContext = createContext<TabsValue>({
	index: 0,
	select: () => {},
	variant: "line",
	colorScheme: "blue",
	isLazy: false,
});

const TAB_BASE =
	"inline-flex items-center justify-center whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-panel-accent/40";
const TAB_LINE =
	"border-b-2 border-transparent px-4 py-2 font-semibold text-panel-text-secondary aria-selected:border-current";

export function Tabs({
	index: controlled,
	defaultIndex = 0,
	onChange,
	variant = "line",
	colorScheme = "blue",
	isLazy = false,
	className,
	children,
	...props
}: Omit<ComponentPropsWithoutRef<"div">, "onChange"> & {
	index?: number;
	defaultIndex?: number;
	onChange?: (index: number) => void;
	variant?: string;
	colorScheme?: string;
	isLazy?: boolean;
	isFitted?: boolean;
	isManual?: boolean;
	size?: string;
	align?: string;
	orientation?: string;
	lazyBehavior?: string;
}) {
	const [inner, setInner] = useState(defaultIndex);
	const index = controlled ?? inner;
	const select = (next: number) => {
		if (controlled === undefined) setInner(next);
		onChange?.(next);
	};
	return (
		<TabsContext.Provider value={{ index, select, variant, colorScheme, isLazy }}>
			<div className={className} {...props}>
				{children}
			</div>
		</TabsContext.Provider>
	);
}

/** Gives each child its position, so Tab and TabPanel know their index. */
function withIndex(children: React.ReactNode) {
	let position = 0;
	return Children.map(children, (child) =>
		isValidElement(child)
			? cloneElement(child as ReactElement<{ index?: number }>, { index: position++ })
			: child,
	);
}

export const TabList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function TabList(
	{ className, children, ...props },
	ref,
) {
	return (
		<div ref={ref} role="tablist" className={cn("flex", className)} {...props}>
			{withIndex(children)}
		</div>
	);
});

type TabProps = Omit<ComponentPropsWithoutRef<"button">, "color"> & {
	index?: number;
	isDisabled?: boolean;
};

export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
	{ index = 0, isDisabled, className, children, ...props },
	ref,
) {
	const ctx = useContext(TabsContext);
	const selected = ctx.index === index;
	return (
		<button
			ref={ref}
			type="button"
			role="tab"
			aria-selected={selected}
			tabIndex={selected ? 0 : -1}
			disabled={isDisabled}
			onClick={() => ctx.select(index)}
			className={cn(
				TAB_BASE,
				ctx.variant === "line" && TAB_LINE,
				ctx.variant === "line" && `aria-selected:text-${ctx.colorScheme}-600 dark:aria-selected:text-${ctx.colorScheme}-200`,
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
});

export const TabPanels = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function TabPanels(
	{ children, ...props },
	ref,
) {
	return (
		<div ref={ref} {...props}>
			{withIndex(children)}
		</div>
	);
});

export const TabPanel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div"> & { index?: number }>(
	function TabPanel({ index = 0, className, children, ...props }, ref) {
		const ctx = useContext(TabsContext);
		const selected = ctx.index === index;
		// With isLazy a panel renders on first selection and then stays mounted, as in Chakra.
		const visited = useRef(false);
		if (selected) visited.current = true;
		if (ctx.isLazy && !visited.current) return null;
		return (
			<div
				ref={ref}
				role="tabpanel"
				hidden={!selected}
				className={cn("p-4", className)}
				{...props}
			>
				{children}
			</div>
		);
	},
);

import {
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
	type ComponentPropsWithoutRef,
	type ReactNode,
} from "react";
import { cn } from "lib/cn";

type Size = "sm" | "md" | "lg";

const CHECKBOX_SIZE: Record<Size, string> = {
	sm: "size-3.5",
	md: "size-4",
	lg: "size-5",
};

const TRACK_SIZE: Record<Size, string> = {
	sm: "h-4 w-7",
	md: "h-5 w-9",
	lg: "h-6 w-11",
};

const THUMB_SIZE: Record<Size, string> = {
	sm: "size-3",
	md: "size-4",
	lg: "size-5",
};

const THUMB_TRAVEL: Record<Size, string> = {
	sm: "peer-checked:translate-x-3 rtl:peer-checked:-translate-x-3",
	md: "peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4",
	lg: "peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5",
};

type CheckboxGroupValue = {
	value: string[];
	toggle: (value: string) => void;
};

const CheckboxGroupContext = createContext<CheckboxGroupValue | null>(null);

/** Chakra's Checkbox: a native checkbox with a label, coloured by `colorScheme` (accent). */
export const Checkbox = forwardRef<
	HTMLInputElement,
	Omit<ComponentPropsWithoutRef<"input">, "size"> & {
		size?: Size;
		colorScheme?: string;
		checked?: boolean;
		isIndeterminate?: boolean;
		disabled?: boolean;
		children?: ReactNode;
	}
>(function Checkbox(
	{
		size = "md",
		colorScheme = "blue",
		checked: isChecked,
		isIndeterminate,
		disabled: isDisabled,
		children,
		className,
		value,
		onChange,
		defaultChecked,
		disabled,
		id,
		...props
	},
	ref,
) {
	const group = useContext(CheckboxGroupContext);
	const inner = useRef<HTMLInputElement | null>(null);
	const fallbackId = useId();
	const inputId = id ?? fallbackId;

	useEffect(() => {
		if (inner.current) inner.current.indeterminate = Boolean(isIndeterminate);
	}, [isIndeterminate]);

	const groupChecked =
		group && value !== undefined ? group.value.includes(String(value)) : undefined;
	const checked = groupChecked ?? isChecked;

	return (
		<label
			htmlFor={inputId}
			className={cn(
				"inline-flex cursor-pointer items-center gap-2 text-sm",
				(disabled ?? isDisabled) && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<input
				ref={(node) => {
					inner.current = node;
					if (typeof ref === "function") ref(node);
					else if (ref) ref.current = node;
				}}
				id={inputId}
				type="checkbox"
				value={value}
				disabled={disabled ?? isDisabled}
				checked={checked}
				defaultChecked={checked === undefined ? defaultChecked : undefined}
				onChange={(event) => {
					if (group && value !== undefined) group.toggle(String(value));
					onChange?.(event);
				}}
				className={cn(
					"cursor-pointer rounded-sm",
					CHECKBOX_SIZE[size],
					`accent-${colorScheme}-500`,
				)}
				{...props}
			/>
			{children ? <span>{children}</span> : null}
		</label>
	);
});

/** Chakra's CheckboxGroup: keeps the checked values of its checkboxes in one array. */
export function CheckboxGroup({
	value: controlled,
	defaultValue = [],
	onChange,
	children,
	className,
}: {
	value?: string[];
	defaultValue?: string[];
	onChange?: (values: string[]) => void;
	children?: ReactNode;
	className?: string;
	colorScheme?: string;
	size?: Size;
}) {
	const [inner, setInner] = useState<string[]>(defaultValue);
	const values = controlled ?? inner;
	const toggle = (item: string) => {
		const next = values.includes(item)
			? values.filter((existing) => existing !== item)
			: [...values, item];
		if (controlled === undefined) setInner(next);
		onChange?.(next);
	};
	return (
		<CheckboxGroupContext.Provider value={{ value: values, toggle }}>
			{/* biome-ignore lint/a11y/useSemanticElements: group wrapper: role=group is the hook the group's styles use */}
			<div role="group" className={className}>
				{children}
			</div>
		</CheckboxGroupContext.Provider>
	);
}

/** Chakra's Switch: a native checkbox styled as a track, so onChange gets a real event. */
export const Switch = forwardRef<
	HTMLInputElement,
	Omit<ComponentPropsWithoutRef<"input">, "size"> & {
		size?: Size;
		colorScheme?: string;
		checked?: boolean;
		disabled?: boolean;
		children?: ReactNode;
	}
>(function Switch(
	{ size = "md", colorScheme = "primary", checked: isChecked, disabled: isDisabled, children, className, disabled, defaultChecked, ...props },
	ref,
) {
	return (
		<label
			className={cn(
				"inline-flex cursor-pointer items-center gap-2 text-sm",
				(disabled ?? isDisabled) && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<input
				ref={ref}
				type="checkbox"
				role="switch" aria-checked={isChecked}
				className="peer sr-only"
				disabled={disabled ?? isDisabled}
				checked={isChecked}
				defaultChecked={isChecked === undefined ? defaultChecked : undefined}
				{...props}
			/>
			<span
				className={cn(
					"relative inline-flex shrink-0 items-center rounded-full bg-gray-300 transition-colors dark:bg-whiteAlpha-300",
					TRACK_SIZE[size],
					`peer-checked:bg-${colorScheme}-500`,
					"peer-focus-visible:ring-2 peer-focus-visible:ring-panel-accent/40",
				)}
			>
				<span
					className={cn(
						"absolute start-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform",
						THUMB_SIZE[size],
						THUMB_TRAVEL[size],
					)}
				/>
			</span>
			{children ? <span>{children}</span> : null}
		</label>
	);
});

type RadioGroupValue = {
	name: string;
	value: string | undefined;
	select: (value: string) => void;
};

const RadioGroupContext = createContext<RadioGroupValue | null>(null);

/** Chakra's RadioGroup: one selected value shared by its Radio children. */
export function RadioGroup({
	value: controlled,
	defaultValue,
	onChange,
	name,
	children,
	className,
}: {
	value?: string;
	defaultValue?: string;
	onChange?: (value: string) => void;
		size?: string;
	name?: string;
	children?: ReactNode;
	className?: string;
}) {
	const [inner, setInner] = useState<string | undefined>(defaultValue);
	const generated = useId();
	const value = controlled ?? inner;
	const select = (next: string) => {
		if (controlled === undefined) setInner(next);
		onChange?.(next);
	};
	return (
		<RadioGroupContext.Provider value={{ name: name ?? generated, value, select }}>
			<div role="radiogroup" className={className}>
				{children}
			</div>
		</RadioGroupContext.Provider>
	);
}

/** Chakra's Radio: a native radio inside a label, bound to the nearest RadioGroup. */
export function Radio({
	value,
	size = "md",
	colorScheme = "blue",
	disabled: isDisabled,
	children,
	className,
}: {
	value: string;
	size?: Size;
	colorScheme?: string;
	disabled?: boolean;
	children?: ReactNode;
	className?: string;
}) {
	const group = useContext(RadioGroupContext);
	return (
		<label
			className={cn(
				"inline-flex cursor-pointer items-center gap-2 text-sm",
				isDisabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<input
				type="radio"
				name={group?.name}
				value={value}
				disabled={isDisabled}
				checked={group?.value === value}
				onChange={() => group?.select(value)}
				className={cn("cursor-pointer", CHECKBOX_SIZE[size], `accent-${colorScheme}-500`)}
			/>
			{children ? <span>{children}</span> : null}
		</label>
	);
}

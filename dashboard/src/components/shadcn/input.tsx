import {
	ChevronDownIcon,
	ChevronUpIcon,
} from "@heroicons/react/24/outline";
import {
	Children,
	createContext,
	forwardRef,
	isValidElement,
	useContext,
	useState,
	type ComponentPropsWithoutRef,
	type ReactNode,
	useEffect,
	useRef,
} from "react";
import { cn } from "lib/cn";
import { useFormControl } from "components/shadcn/field";

type FieldSize = "xs" | "sm" | "md" | "lg";

const FIELD_BASE =
	"w-full min-w-0 rounded-md border border-panel-border! bg-panel-surface text-panel-text outline-none transition-colors placeholder:text-panel-text-muted focus-visible:border-primary-500! focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-40 dark:border-panel-border-strong!";

const FIELD_SIZE: Record<FieldSize, string> = {
	xs: "h-6 px-2 text-xs",
	sm: "h-8 px-3 text-sm",
	md: "h-10 px-4 text-base",
	lg: "h-12 px-4 text-lg",
};

const INVALID = "border-red-500! ring-1 ring-red-500";
const UNSTYLED = "h-auto border-0 bg-transparent px-0";

type InputGroupValue = { hasLeft: boolean; hasRight: boolean };
const InputGroupContext = createContext<InputGroupValue>({ hasLeft: false, hasRight: false });

type InputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
	size?: FieldSize;
	variant?: "outline" | "unstyled";
	isInvalid?: boolean;
	isDisabled?: boolean;
	isReadOnly?: boolean;
};

/** Chakra's Input, on the panel tokens. It takes id, required and invalid state from FormControl. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
	{
		size = "md",
		variant = "outline",
		isInvalid,
		isDisabled,
		isReadOnly,
		className,
		id,
		required,
		disabled,
		readOnly,
		...props
	},
	ref,
) {
	const field = useFormControl();
	const group = useContext(InputGroupContext);
	const invalid = isInvalid ?? field?.isInvalid;
	return (
		<input
			ref={ref}
			id={id ?? field?.id}
			required={required ?? field?.isRequired}
			disabled={disabled ?? isDisabled ?? field?.isDisabled}
			readOnly={readOnly ?? isReadOnly ?? field?.isReadOnly}
			aria-invalid={invalid || undefined}
			className={cn(
				FIELD_BASE,
				FIELD_SIZE[size],
				variant === "unstyled" && UNSTYLED,
				invalid && INVALID,
				group.hasLeft && "ps-10",
				group.hasRight && "pe-10",
				className,
			)}
			{...props}
		/>
	);
});

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & {
	size?: FieldSize;
	isInvalid?: boolean;
	isDisabled?: boolean;
	isReadOnly?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
	{ size = "md", isInvalid, isDisabled, isReadOnly, className, id, required, disabled, readOnly, ...props },
	ref,
) {
	const field = useFormControl();
	const invalid = isInvalid ?? field?.isInvalid;
	return (
		<textarea
			ref={ref}
			id={id ?? field?.id}
			required={required ?? field?.isRequired}
			disabled={disabled ?? isDisabled ?? field?.isDisabled}
			readOnly={readOnly ?? isReadOnly ?? field?.isReadOnly}
			aria-invalid={invalid || undefined}
			className={cn(
				FIELD_BASE,
				FIELD_SIZE[size],
				"h-auto min-h-20 py-2 resize-y",
				invalid && INVALID,
				className,
			)}
			{...props}
		/>
	);
});

/** Chakra's Select: a native select with a chevron on the inline end. `placeholder` becomes an empty first option. */
export const Select = forwardRef<
	HTMLSelectElement,
	Omit<ComponentPropsWithoutRef<"select">, "size"> & {
		size?: FieldSize;
		isInvalid?: boolean;
		isDisabled?: boolean;
		placeholder?: string;
	}
>(function Select(
	{ size = "md", isInvalid, isDisabled, placeholder, className, children, id, required, disabled, ...props },
	ref,
) {
	const field = useFormControl();
	const invalid = isInvalid ?? field?.isInvalid;
	return (
		<div className="relative w-full">
			<select
				ref={ref}
				id={id ?? field?.id}
				required={required ?? field?.isRequired}
				disabled={disabled ?? isDisabled ?? field?.isDisabled}
				aria-invalid={invalid || undefined}
				className={cn(FIELD_BASE, FIELD_SIZE[size], "appearance-none pe-9", invalid && INVALID, className)}
				{...props}
			>
				{placeholder !== undefined ? <option value="">{placeholder}</option> : null}
				{children}
			</select>
			<ChevronDownIcon
				aria-hidden
				className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-panel-text-secondary"
			/>
		</div>
	);
});

/** Chakra's InputGroup: a relative wrapper. Adornments sit on top of the input and push its text in. */
export function InputGroup({
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"div"> & { size?: FieldSize }) {
	const items = Children.toArray(children).filter(isValidElement) as Array<{
		type: unknown;
	}>;
	const hasLeft = items.some(
		(item) => item.type === InputLeftElement || item.type === InputLeftAddon,
	);
	const hasRight = items.some(
		(item) => item.type === InputRightElement || item.type === InputRightAddon,
	);
	return (
		<InputGroupContext.Provider value={{ hasLeft, hasRight }}>
			{/* biome-ignore lint/a11y/useSemanticElements: field group: role=group is the hook the group's styles use for the focus and hover styles */}
			<div role="group" className={cn("relative flex w-full items-stretch", className)} {...props}>
				{children}
			</div>
		</InputGroupContext.Provider>
	);
}

export function InputLeftElement({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute inset-y-0 start-0 z-[1] flex w-10 items-center justify-center text-panel-text-muted",
				className,
			)}
		{...props}
		>
			{children}
		</div>
	);
}

export function InputRightElement({ className, children, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"absolute inset-y-0 end-0 z-[1] flex w-10 items-center justify-center text-panel-text-muted",
				className,
			)}
		{...props}
		>
			{children}
		</div>
	);
}

export function InputLeftAddon({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"flex items-center whitespace-nowrap rounded-s-md border border-panel-border! bg-panel-elevated px-3 text-sm dark:border-panel-border-strong!",
				className,
			)}
			{...props}
		/>
	);
}

export function InputRightAddon({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"flex items-center whitespace-nowrap rounded-e-md border border-panel-border! bg-panel-elevated px-3 text-sm dark:border-panel-border-strong!",
				className,
			)}
			{...props}
		/>
	);
}

// NumberInput: a text field with stepper buttons. onChange gets Chakra's (string, number) pair.
type NumberInputContextValue = {
	value: string;
	emit: (text: string) => void;
	bump: (direction: 1 | -1) => void;
	commit: () => void;
	isDisabled: boolean;
	size: FieldSize;
	isInvalid?: boolean;
};

const NumberInputContext = createContext<NumberInputContextValue | null>(null);

function useNumberInput() {
	const ctx = useContext(NumberInputContext);
	if (!ctx) throw new Error("NumberInput parts must be used inside NumberInput");
	return ctx;
}

export function NumberInput({
	value: controlled,
	defaultValue,
	onChange,
	min,
	max,
	step = 1,
	precision,
	isDisabled = false,
	clampValueOnBlur = true,
	allowMouseWheel = false,
	isInvalid,
	size = "md",
	className,
	children,
}: {
	value?: string | number;
	defaultValue?: string | number;
	onChange?: (valueAsString: string, valueAsNumber: number) => void;
	min?: number;
	max?: number;
	step?: number;
	precision?: number;
	isDisabled?: boolean;
	clampValueOnBlur?: boolean;
	allowMouseWheel?: boolean;
	isInvalid?: boolean;
	size?: FieldSize;
	className?: string;
	children?: ReactNode;
}) {
	const [inner, setInner] = useState(String(defaultValue ?? ""));
	const value = controlled !== undefined ? String(controlled) : inner;

	const clamp = (n: number) => {
		let result = n;
		if (min !== undefined) result = Math.max(min, result);
		if (max !== undefined) result = Math.min(max, result);
		return precision !== undefined ? Number(result.toFixed(precision)) : result;
	};

	const emit = (text: string) => {
		if (controlled === undefined) setInner(text);
		onChange?.(text, Number.parseFloat(text));
	};

	const bump = (direction: 1 | -1) => {
		const current = Number.parseFloat(value);
		emit(String(clamp((Number.isNaN(current) ? 0 : current) + direction * step)));
	};

	const rootRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const root = rootRef.current;
		if (!allowMouseWheel || !root) return;
		const onWheel = (event: WheelEvent) => {
			if (document.activeElement !== root.querySelector("input") || !event.deltaY) return;
			event.preventDefault();
			bump(event.deltaY < 0 ? 1 : -1);
		};
		root.addEventListener("wheel", onWheel, { passive: false });
		return () => root.removeEventListener("wheel", onWheel);
	});

	const commit = () => {
		if (!clampValueOnBlur) return;
		const current = Number.parseFloat(value);
		if (!Number.isNaN(current)) emit(String(clamp(current)));
	};

	return (
		<NumberInputContext.Provider value={{ value, emit, bump, commit, isDisabled, size, isInvalid }}>
			{/* biome-ignore lint/a11y/useSemanticElements: field group: role=group is the hook the group's styles use for the stepper hover reveal */}
			<div ref={rootRef} role="group" className={cn("relative w-full", className)}>
				{children}
			</div>
		</NumberInputContext.Provider>
	);
}

export const NumberInputField = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
	function NumberInputField({ className, onBlur, ...props }, ref) {
		const ctx = useNumberInput();
		const field = useFormControl();
		const invalid = ctx.isInvalid ?? field?.isInvalid;
		return (
			<input
				ref={ref}
				type="text"
				inputMode="decimal"
				value={ctx.value}
				disabled={ctx.isDisabled}
				onChange={(event) => ctx.emit(event.target.value)}
				onBlur={(event) => {
					ctx.commit();
					onBlur?.(event);
				}}
				aria-invalid={invalid || undefined}
					className={cn(FIELD_BASE, FIELD_SIZE[ctx.size], "pe-8", invalid && INVALID, className)}
				{...props}
			/>
		);
	},
);

export function NumberInputStepper({ className, children }: { className?: string; children?: ReactNode }) {
	return (
		<div className={cn("absolute inset-y-px end-px flex w-6 flex-col", className)}>{children}</div>
	);
}

export function NumberIncrementStepper({ className, ...props }: ComponentPropsWithoutRef<"button">) {
	const ctx = useNumberInput();
	return (
		<button
			type="button"
			aria-label="Increase"
			disabled={ctx.isDisabled}
			onClick={() => ctx.bump(1)}
			className={cn("flex flex-1 items-center justify-center text-panel-text-secondary hover:bg-panel-elevated", className)}
			{...props}
		>
			<ChevronUpIcon className="size-3" />
		</button>
	);
}

export function NumberDecrementStepper({ className, ...props }: ComponentPropsWithoutRef<"button">) {
	const ctx = useNumberInput();
	return (
		<button
			type="button"
			aria-label="Decrease"
			disabled={ctx.isDisabled}
			onClick={() => ctx.bump(-1)}
			className={cn("flex flex-1 items-center justify-center text-panel-text-secondary hover:bg-panel-elevated", className)}
			{...props}
		>
			<ChevronDownIcon className="size-3" />
		</button>
	);
}

import { cn } from "lib/cn";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { type FC, type ReactNode, useEffect, useRef, useState } from "react";

type NumberFieldProps = {
	id?: string;
	value: string;
	onChange: (raw: string) => void;
	step?: number;
	min?: number;
	max?: number;
	unit?: string;
	unitSlot?: ReactNode;
	placeholder?: string;
	disabled?: boolean;
	invalid?: boolean;
	inputMode?: "numeric" | "decimal";
	doneLabel?: string;
	hideSteppers?: boolean;
};

const WHEEL_THRESHOLD = 40;

export const NumberField: FC<NumberFieldProps> = ({
	id,
	value,
	onChange,
	step = 1,
	min = 0,
	max,
	unit,
	unitSlot,
	placeholder,
	disabled = false,
	invalid = false,
	inputMode = "decimal",
	doneLabel,
	hideSteppers = false,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);
	const [focused, setFocused] = useState(false);
	const wheelDelta = useRef(0);
	const latest = useRef({ value, onChange, step, min, max, disabled });
	latest.current = { value, onChange, step, min, max, disabled };

	const stepBy = (direction: 1 | -1) => {
		const current = latest.current;
		if (current.disabled) return;
		const parsed = Number.parseFloat(current.value);
		if (!current.value.trim() || Number.isNaN(parsed)) {
			if (direction > 0)
				current.onChange(String(Math.max(current.min, current.step)));
			return;
		}
		let next = Math.round((parsed + direction * current.step) * 100) / 100;
		if (next < current.min) next = current.min;
		if (current.max !== undefined && next > current.max) next = current.max;
		current.onChange(String(next));
	};

	useEffect(() => {
		const element = inputRef.current;
		if (!element) return undefined;
		const onWheel = (event: WheelEvent) => {
			if (latest.current.disabled) return;
			event.preventDefault();
			element.focus({ preventScroll: true });
			wheelDelta.current += event.deltaY;
			if (Math.abs(wheelDelta.current) < WHEEL_THRESHOLD) return;
			stepBy(wheelDelta.current < 0 ? 1 : -1);
			wheelDelta.current = 0;
		};
		element.addEventListener("wheel", onWheel, { passive: false });
		return () => element.removeEventListener("wheel", onWheel);
	}, []);

	return (
		<div
			className={cn(
				"flex h-10 w-full min-w-0 items-stretch overflow-hidden rounded-xl border border-panel-border bg-panel-surface text-panel-text shadow-xs transition-[border-color,box-shadow] focus-within:border-panel-accent focus-within:ring-2 focus-within:ring-panel-accent/20",
				invalid && "border-destructive",
				disabled && "opacity-50",
			)}
		>
			<input
				ref={inputRef}
				id={id}
				dir="ltr"
				inputMode={inputMode}
				value={value}
				placeholder={placeholder}
				disabled={disabled}
				aria-invalid={invalid || undefined}
				onChange={(event) => onChange(event.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				onKeyDown={(event) => {
					if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
					event.preventDefault();
					stepBy(event.key === "ArrowUp" ? 1 : -1);
				}}
				className="min-w-0 flex-1 bg-transparent px-3 text-xs outline-none placeholder:text-panel-text-muted disabled:cursor-not-allowed tabular-nums [unicode-bidi:isolate]"
			/>
			{doneLabel && focused && !disabled ? (
				<button
					type="button"
					tabIndex={-1}
					aria-label={doneLabel}
					title={doneLabel}
					onPointerDown={(event) => event.preventDefault()}
					onClick={() => inputRef.current?.blur()}
					className="flex w-8 shrink-0 items-center justify-center text-panel-accent transition-colors min-[769px]:hover:bg-panel-elevated"
				>
					<Check className="size-4" />
				</button>
			) : null}
			{unitSlot ??
				(unit ? (
					<span className="inline-flex shrink-0 items-center border-s border-panel-border bg-panel-elevated/60 px-3 text-xs font-semibold text-panel-text-secondary select-none">
						{unit}
					</span>
				) : null)}
			{!hideSteppers && (
				<div className="flex w-6 shrink-0 flex-col border-s border-panel-border">
					<button
						type="button"
						tabIndex={-1}
						aria-hidden="true"
						disabled={disabled}
						onClick={() => stepBy(1)}
						className="flex flex-1 items-center justify-center text-panel-text-muted transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text disabled:pointer-events-none"
					>
						<ChevronUp className="size-3" />
					</button>
					<button
						type="button"
						tabIndex={-1}
						aria-hidden="true"
						disabled={disabled}
						onClick={() => stepBy(-1)}
						className="flex flex-1 items-center justify-center border-t border-panel-border text-panel-text-muted transition-colors min-[769px]:hover:bg-panel-elevated min-[769px]:hover:text-panel-text disabled:pointer-events-none"
					>
						<ChevronDown className="size-3" />
					</button>
				</div>
			)}
		</div>
	);
};

import type * as React from "react";
import { cn } from "lib/cn";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Chakra's spinner sizes: 12 / 16 / 24 / 32 / 40 px. */
const SPINNER_SIZE: Record<SpinnerSize, string> = {
	xs: "size-3",
	sm: "size-4",
	md: "size-6",
	lg: "size-8",
	xl: "size-10",
};

/** Chakra's Spinner: a ring in the current text colour, so `color` sets it through className. */
export function Spinner({
	size = "md",
	thickness = "2px",
	label = "Loading...",
	className,
	style,
	...props
}: React.ComponentPropsWithoutRef<"span"> & {
	size?: SpinnerSize;
	thickness?: string;
	label?: string;
}) {
	return (
		// biome-ignore lint/a11y/useSemanticElements: status announcement; kept as the spinner's inline box
		<span
			role="status"
			className={cn(
				"inline-block animate-spin rounded-full border-solid border-current border-r-transparent",
				SPINNER_SIZE[size],
				className,
			)}
			style={{ borderWidth: thickness, ...style }}
			{...props}
		>
			<span className="sr-only">{label}</span>
		</span>
	);
}

/** Chakra's Skeleton: while loading, the children stay in layout but are hidden under a pulse. */
export function Skeleton({
	isLoaded = false,
	children,
	className,
	...props
}: React.ComponentPropsWithoutRef<"div"> & { isLoaded?: boolean }) {
	if (isLoaded) return <>{children}</>;
	return (
		<div
			className={cn(
				"relative animate-pulse overflow-hidden rounded-md bg-panel-elevated",
				className,
			)}
			{...props}
		>
			{children ? <div className="invisible">{children}</div> : null}
		</div>
	);
}

export function SkeletonText({
	noOfLines = 3,
	spacing = 2,
	isLoaded = false,
	children,
	className,
}: {
	noOfLines?: number;
	spacing?: number;
	isLoaded?: boolean;
	children?: React.ReactNode;
	className?: string;
}) {
	if (isLoaded) return <>{children}</>;
	return (
		<div
			className={cn("flex w-full flex-col", className)}
			style={{ gap: `${spacing * 0.25}rem` }}
		>
			{Array.from({ length: noOfLines }, (_, index) => (
				<div
					/* biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows never reorder */
					key={index}
					className={cn(
						"h-3 animate-pulse rounded-md bg-panel-elevated",
						noOfLines > 1 && index === noOfLines - 1 && "w-3/5",
					)}
				/>
			))}
		</div>
	);
}

const PROGRESS_TRACK: Record<"xs" | "sm" | "md" | "lg", string> = {
	xs: "h-1",
	sm: "h-2",
	md: "h-3",
	lg: "h-4",
};

/** Chakra's Progress. `colorScheme` picks the bar colour from the palette. */
export function Progress({
	value = 0,
	max = 100,
	size = "md",
	colorScheme = "blue",
	isAnimated = false,
	isIndeterminate = false,
	className,
	...props
}: React.ComponentPropsWithoutRef<"div"> & {
	isIndeterminate?: boolean;
	value?: number;
	max?: number;
	size?: "xs" | "sm" | "md" | "lg";
	colorScheme?: string;
	isAnimated?: boolean;
}) {
	const percent = Math.max(0, Math.min(100, (value / max) * 100));
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={max}
			aria-valuenow={value}
			className={cn(
				"relative w-full overflow-hidden rounded-full bg-gray-100 dark:bg-whiteAlpha-300",
				PROGRESS_TRACK[size],
				className,
			)}
			{...props}
		>
			<div
				className={cn(
					"h-full rounded-full transition-[width] duration-300",
					`bg-${colorScheme}-500`,
					(isAnimated || isIndeterminate) && "animate-pulse",
				)}
				style={{ width: `${percent}%` }}
			/>
		</div>
	);
}

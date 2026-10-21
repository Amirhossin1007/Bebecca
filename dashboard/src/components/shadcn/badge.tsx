import type { ElementType } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type * as React from "react";
import { cn } from "lib/cn";

type Tone = "subtle" | "solid" | "outline";

/** Chakra's colour-scheme tones. Dynamic palette names are safelisted in tailwind.css. */
function toneClasses(tone: Tone, scheme: string): string {
	switch (tone) {
		case "solid":
			return `bg-${scheme}-500 text-white`;
		case "outline":
			return `border border-${scheme}-500 text-${scheme}-600 dark:text-${scheme}-200`;
		default:
			return `bg-${scheme}-100 text-${scheme}-800 dark:bg-${scheme}-200/16 dark:text-${scheme}-200`;
	}
}

/** Chakra's Badge: small, uppercase and bold. */
export function Badge({
	variant = "subtle",
	colorScheme = "gray",
	className,
	children,
	...props
}: React.ComponentPropsWithoutRef<"span"> & {
	variant?: Tone;
	colorScheme?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center whitespace-nowrap rounded-sm px-1 text-xs font-bold uppercase",
				toneClasses(variant, colorScheme),
				className,
			)}
			{...props}
		>
			{children}
		</span>
	);
}

/** Chakra's Tag: a pill-shaped label, with an optional close button. */
export function Tag({
	variant = "subtle",
	colorScheme = "gray",
	size = "md",
	className,
	children,
	as: Comp = "span",
	...props
}: React.ComponentPropsWithoutRef<"span"> & { as?: ElementType;
	variant?: Tone;
	colorScheme?: string;
	size?: "sm" | "md" | "lg";
}) {
	return (
		<Comp
			className={cn(
				"inline-flex max-w-full items-center whitespace-nowrap rounded-md font-medium",
				size === "sm" ? "h-5 px-1.5 text-xs" : size === "lg" ? "h-8 px-3 text-base" : "h-6 px-2 text-sm",
				toneClasses(variant, colorScheme),
				className,
			)}
			{...props}
		>
			{children}
		</Comp>
	);
}

export function TagLabel({ className, ...props }: React.ComponentPropsWithoutRef<"span">) {
	return <span className={cn("truncate", className)} {...props} />;
}

export function TagCloseButton({
	className,
	onClick,
	...props
}: React.ComponentPropsWithoutRef<"button">) {
	return (
		<button
			type="button"
			aria-label="Remove"
			onClick={onClick}
			className={cn(
				"-me-1 ms-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10",
				className,
			)}
			{...props}
		>
			<XMarkIcon className="size-3" />
		</button>
	);
}

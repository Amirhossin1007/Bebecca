import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "lib/cn";
import { Spinner } from "components/shadcn/feedback";

/**
 * Chakra's Button metrics (height, padding, font size, radius and focus ring).
 * `default` is the panel's own pill used by the ported screens. The Chakra
 * variants (`solid`, `outline`, `ghost`, `subtle`, `link`) and the Chakra sizes
 * (`xs`, `sm`, `md`, `lg`) reproduce the look the migrated call sites had.
 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold leading-[1.2] outline-none transition-colors select-none disabled:pointer-events-none disabled:opacity-40 focus-visible:[box-shadow:0_0_0_2px_var(--primary-200)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"h-10 rounded-full bg-panel-accent px-4 text-sm font-medium text-white shadow-sm hover:bg-panel-accent-hover",
				subtle: "bg-panel-elevated text-panel-text hover:bg-panel-border",
				destructive: "bg-panel-danger text-white hover:bg-panel-danger/90",
				solid:
					"bg-gray-100 text-gray-800 hover:bg-gray-200 active:bg-gray-300 dark:bg-whiteAlpha-200 dark:text-whiteAlpha-900 dark:hover:bg-whiteAlpha-300 dark:active:bg-whiteAlpha-400",
				outline:
					"border border-blackAlpha-300! bg-transparent hover:bg-blackAlpha-50 active:bg-blackAlpha-100 dark:border-whiteAlpha-300! dark:hover:bg-whiteAlpha-100 dark:active:bg-whiteAlpha-200",
				ghost:
					"bg-transparent hover:bg-gray-100 active:bg-gray-200 dark:hover:bg-whiteAlpha-200 dark:active:bg-whiteAlpha-300",
				link: "h-auto p-0 font-normal hover:underline disabled:no-underline",
			},
			size: {
				icon: "size-9 px-0",
				"icon-sm": "size-8 px-0",
				xs: "h-6 min-w-6 px-2 text-xs",
				sm: "h-8 min-w-8 px-3 text-sm",
				md: "h-10 min-w-10 px-4 text-base",
				lg: "h-12 min-w-12 px-6 text-lg",
			},
		},
		defaultVariants: { variant: "default" },
	},
);

/** Chakra's colorScheme classes for each variant. Palette names are safelisted in tailwind.css. */
function schemeClasses(variant: string, scheme: string): string | undefined {
	switch (variant) {
		case "solid":
			// Chakra keeps a solid button solid in dark mode; the old dark:bg-*-200 made
			// solid buttons look like unstyled white chips.
			return `bg-${scheme}-500 text-white! hover:bg-${scheme}-600 active:bg-${scheme}-700`;
		case "outline":
			return `text-${scheme}-600! dark:text-${scheme}-200!`;
		case "ghost":
			return `text-${scheme}-600 hover:bg-${scheme}-50 active:bg-${scheme}-100 dark:text-${scheme}-200 dark:hover:bg-${scheme}-200/12 dark:active:bg-${scheme}-200/24`;
		case "subtle":
			return `bg-${scheme}-100 text-${scheme}-800 hover:bg-${scheme}-200 active:bg-${scheme}-300 dark:bg-${scheme}-200/16 dark:text-${scheme}-200 dark:hover:bg-${scheme}-200/24 dark:active:bg-${scheme}-200/36`;
		case "link":
			return `text-${scheme}-600 hover:underline dark:text-${scheme}-200`;
		default:
			return undefined;
	}
}

/** Square sizes for IconButton, matching Chakra's icon-only sizes. */
const ICON_SIZE = {
	xs: "size-6 px-0",
	sm: "size-8 px-0",
	md: "size-10 px-0",
	lg: "size-12 px-0",
} as const;

type ButtonGroupValue = {
	variant?: string;
	size?: "xs" | "sm" | "md" | "lg";
	colorScheme?: string;
};

const ButtonGroupContext = React.createContext<ButtonGroupValue>({});

export type ButtonProps = Omit<React.ComponentPropsWithoutRef<"button">, "color"> &
	Omit<VariantProps<typeof buttonVariants>, "variant"> & {
		variant?: string;
		asChild?: boolean;
		as?: React.ElementType;
		colorScheme?: string;
		disabled?: boolean;
		loading?: boolean;
		leftIcon?: React.ReactElement;
		rightIcon?: React.ReactElement;
	};

/**
 * `forwardRef` is required, not optional: Radix triggers (DropdownMenu,
 * Dialog, Popover, Tooltip) measure their child through a ref. Without it the
 * popper never positions.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	function Button(
		{
			className,
			variant,
			size,
			asChild = false,
			as: As,
			colorScheme,
			disabled: isDisabled,
			loading: isLoading,
			leftIcon,
			rightIcon,
			children,
			disabled,
			type = "button",
			...props
		},
		ref,
	) {
		const group = React.useContext(ButtonGroupContext);
		const resolvedVariant = variant ?? group.variant ?? (colorScheme ? "solid" : undefined);
		const resolvedScheme = colorScheme ?? group.colorScheme;
		const resolvedSize = size ?? group.size;
		const schemed = resolvedScheme
			? schemeClasses(resolvedVariant ?? "solid", resolvedScheme)
			: undefined;
		const classes = cn(
			buttonVariants({
				variant: resolvedScheme ? undefined : (resolvedVariant as "solid") ?? undefined,
				size: resolvedSize,
			}),
			schemed,
			isLoading && "relative",
			className,
		);

		if (As) {
			return (
				<As className={classes} {...props}>
					{children}
				</As>
			);
		}

		if (asChild) {
			return (
				<Slot data-slot="button" ref={ref} className={classes} {...props}>
					{children}
				</Slot>
			);
		}

		return (
			<button
				data-slot="button"
				ref={ref}
				type={type}
				disabled={disabled ?? isDisabled ?? isLoading}
				className={classes}
				{...props}
			>
				{isLoading ? (
					<Spinner
						size="sm"
						className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
					/>
				) : null}
				<span className={cn("inline-flex items-center gap-2", isLoading && "invisible")}>
					{leftIcon}
					{children}
					{rightIcon}
				</span>
			</button>
		);
	},
);

/** Chakra's IconButton: an icon in a square button that needs an accessible label. */
export const IconButton = React.forwardRef<
	HTMLButtonElement,
	ButtonProps & { icon?: React.ReactElement; "aria-label": string; isRound?: boolean }
>(function IconButton({ icon, children, className, size, isRound, ...props }, ref) {
	const group = React.useContext(ButtonGroupContext);
	const iconSize = ICON_SIZE[(size ?? group.size ?? "md") as keyof typeof ICON_SIZE] ?? ICON_SIZE.md;
	return (
		<Button ref={ref} size={size} className={cn(iconSize, isRound && "rounded-full", className)} {...props}>
			{icon ?? children}
		</Button>
	);
});

/** Chakra's ButtonGroup: passes variant, size and colorScheme to its buttons, and joins them when `isAttached`. */
export function ButtonGroup({
	variant,
	size,
	colorScheme,
	isAttached,
	spacing = 2,
	className,
	children,
	...props
}: React.ComponentPropsWithoutRef<"div"> & {
	variant?: string;
	size?: "xs" | "sm" | "md" | "lg";
	colorScheme?: string;
	isAttached?: boolean;
	spacing?: number | string;
}) {
	const gap = typeof spacing === "number" ? `gap-${spacing}` : `gap-[${spacing}]`;
	return (
		<ButtonGroupContext.Provider value={{ variant, size, colorScheme }}>
			{/* biome-ignore lint/a11y/useSemanticElements: group wrapper: role=group is the hook the group's styles use */}
			<div
				role="group"
				className={cn(
					"inline-flex",
					isAttached
						? "[&>*:not(:first-child)]:-ms-px [&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none"
						: gap,
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</ButtonGroupContext.Provider>
	);
}

/** Chakra's CloseButton: a ghost icon button with an X. */
export const CloseButton = React.forwardRef<
	HTMLButtonElement,
	ButtonProps
>(function CloseButton({ className, ...props }, ref) {
	return (
		<IconButton
			ref={ref}
			variant="ghost"
			aria-label="Close"
			className={cn("text-panel-text-secondary", className)}
			icon={
				<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			}
			{...props}
		/>
	);
});

export { buttonVariants };

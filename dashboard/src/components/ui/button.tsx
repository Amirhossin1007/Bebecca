import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "lib/cn"
import { Slot } from "radix-ui"

/**
 * Stock shadcn/ui Button (new-york). Colours come from the shadcn tokens that
 * tailwind.css aliases onto the panel palette, so a block that uses this button
 * looks native here without edits.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

function StockButton({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  // Slot needs the ref Radix triggers measure (the bug from the earlier port).
  const SlotComp = Slot.Slot as React.ElementType
  const Comp = asChild ? SlotComp : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(unifyPrimary(buttonVariants({ variant, size, className })))}
      {...props}
    />
  )
}

/**
 * Compatibility surface for the 87 screens that still call the Chakra-shaped
 * API (colorScheme, loading, leftIcon…). It renders the SAME stock button
 * classes above, so every button in the panel shares one look; the extra props
 * only translate to classes. New code should use the stock API directly.
 */
import { Spinner } from "components/shadcn/feedback";

const SCHEME = {
	// primary is the accent pill, not the Chakra blue.
	solid: "rounded-full bg-panel-accent text-white! shadow-xs hover:bg-panel-accent-hover active:bg-panel-accent-hover",
	outline: "border-${s}-500! text-${s}-600! hover:bg-${s}-50 dark:text-${s}-200! dark:border-${s}-300! dark:hover:bg-${s}-200/12",
	ghost: "text-${s}-600! hover:bg-${s}-50 dark:text-${s}-200! dark:hover:bg-${s}-200/12",
	subtle: "bg-${s}-100 text-${s}-800 hover:bg-${s}-200 dark:bg-${s}-200/16 dark:text-${s}-200",
	link: "text-${s}-600! hover:underline dark:text-${s}-200!",
} as const;

const CHAKRA_SIZE: Record<string, string> = {
	xs: "h-6 min-w-6 px-2 text-xs",
	sm: "h-8 min-w-8 px-3 text-sm",
	md: "h-10 min-w-10 px-4 text-base",
	lg: "h-12 min-w-12 px-6 text-lg",
};

const ICON_SIZE: Record<string, string> = {
	xs: "size-6 px-0",
	sm: "size-8 px-0",
	md: "size-10 px-0",
	lg: "size-12 px-0",
};

type ButtonGroupValue = { variant?: string; colorScheme?: string; size?: string };
const ButtonGroupContext = React.createContext<ButtonGroupValue>({});

const schemeClass = (variant: string, scheme: string) =>
	(SCHEME[variant as keyof typeof SCHEME] ?? SCHEME.solid).replace(/\$\{s\}/g, scheme);

export type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
	variant?: string;
	size?: string;
	colorScheme?: string;
	loading?: boolean;
	asChild?: boolean;
	as?: React.ElementType;
	leftIcon?: React.ReactElement;
	rightIcon?: React.ReactElement;
	disabled?: boolean;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function CompatButton(
	{
		className,
		variant,
		size,
		asChild = false,
		as: As,
		colorScheme,
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
	const variantName = variant ?? group.variant ?? (colorScheme ? "solid" : "default");
	const scheme = colorScheme ?? group.colorScheme;
	const sizeName = size ?? group.size ?? "default";
	const chakraSized = CHAKRA_SIZE[sizeName];
	const isPrimaryClass = Boolean(scheme) && (variantName === "solid" || !SCHEME[variantName as keyof typeof SCHEME]) && (scheme === "primary") ||
		(variantName === "solid" && !scheme);
	const stockVariant =
		variantName === "solid" || variantName === "subtle"
			? undefined
			: (variantName === "destructive" || variantName === "default"
				? variantName
				: (variantName as "outline" | "ghost" | "link" | "secondary"));
	// One final assembly: every source of classes is flattened into a single
	// string, then normalised, so a call site cannot leave the primary button
	// with its own radius or height.
	// Solid stays solid: the base variant decides the look, and the call site's
	// own scheme/colour classes come after it, so a ghost icon button can never
	// inherit the accent fill.
	const baseVariant =
		variantName === "solid" ? "default"
		: variantName === "destructive" ? "destructive"
		: variantName === "outline" ? "outline"
		: variantName === "ghost" ? "ghost"
		: variantName === "link" ? "link"
		: variantName === "subtle" ? "secondary"
		: "ghost";
	const base = buttonVariants({
		variant: baseVariant as "default",
		size: chakraSized ? undefined : "default",
	});
	const parts = [
		base,

		chakraSized,
		scheme ? schemeClass(variantName, scheme) : "",
		variantName === "solid" && !scheme ? "bg-primary text-primary-foreground" : (scheme === "primary" && variantName === "solid" ? "bg-primary text-primary-foreground" : ""),
		variantName === "outline" && !scheme ? "border bg-background hover:bg-accent" : "",
		variantName === "ghost" && !scheme ? "hover:bg-accent" : "",
		className ?? "",
	].filter(Boolean);
	const flat = parts.join(" ").replace(/\s+/g, " ");
	const hasAccentFill = (flat.match(/(^|\s)(hover:)?bg-(primary|panel-accent)/g) ?? []).some(
		(c) => !c.includes("hover:"),
	);
	const isPrimary =
		hasAccentFill ||
		((variantName === "solid") && (!scheme || scheme === "primary"));
	const classes = cn(unifyPrimary(flat), isLoading && "relative", isPrimary && "rounded-full");
	const content = (
		<span className={cn("inline-flex items-center gap-2", isLoading && "invisible")}>
			{leftIcon}
			{iconSlot(children)}
			{rightIcon}
		</span>
	);

	const Comp = (asChild ? Slot.Slot : "button") as React.ElementType;
	return (
		<Comp
			data-slot="button"
			ref={ref}
			type={asChild ? undefined : type}
			disabled={asChild ? undefined : (disabled ?? isLoading)}
			className={classes}
			{...props}
		>
			{isLoading ? (
				<Spinner size="sm" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
			) : null}
			{asChild ? children : content}
		</Comp>
	);
});

/** A bare icon element is passed as-is, anything else goes inside the label row. */
function iconSlot(children: React.ReactNode) {
	return children;
}

export const IconButton = React.forwardRef<
	HTMLButtonElement,
	ButtonProps & { icon?: React.ReactElement; "aria-label": string; isRound?: boolean }
>(function IconButton({ icon, children, className, size, isRound, ...props }, ref) {
	const group = React.useContext(ButtonGroupContext);
	const iconSize = ICON_SIZE[size ?? group.size ?? "md"] ?? ICON_SIZE.md;
	return (
		<Button ref={ref} size={size} className={cn(iconSize, isRound && "rounded-full", className)} {...props}>
			{icon ?? children}
		</Button>
	);
});

/** Chakra's ButtonGroup: passes variant/size/colorScheme down, joins when attached. */
export function ButtonGroup({
	children,
	variant,
	colorScheme,
	size,
	isAttached = false,
	className,
}: {
	children: React.ReactNode;
	variant?: string;
	colorScheme?: string;
	size?: string;
	isAttached?: boolean;
	className?: string;
}) {
	const value = React.useMemo(() => ({ variant, colorScheme, size }), [variant, colorScheme, size]);
	return (
		<ButtonGroupContext.Provider value={value}>
			<div className={cn("inline-flex", isAttached && "[&>*:not(:first-child)]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none [&>*:not(:first-child)]:-ms-px", className)}>
				{children}
			</div>
		</ButtonGroupContext.Provider>
	);
}

export const CloseButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentPropsWithoutRef<"button"> & { size?: string }
>(function CloseButton({ className, ...props }, ref) {
	return (
		<button
			ref={ref}
			type="button"
			aria-label="Close"
			className={cn("inline-flex size-7 items-center justify-center rounded-md text-panel-text-muted transition-colors hover:bg-panel-elevated hover:text-panel-text", className)}
			{...props}
		/>
	);
});

/**
 * Final pass: every primary/solid call site that still carries its own radius,
 * height or opacity override resolves to the same pill, so the panel has one
 * primary button instead of the per-screen variants the port left behind.
 */
function unifyPrimary(classes: string): string {
	const isPrimary = /(^|\s)bg-(panel-accent|primary-500|red-500|green-500)(\s|$)/.test(classes);
	if (!isPrimary) return classes;
	return classes
		// strip any radius override, then pin the pill (the base classes have none
		// for primary, so tailwind-merge cannot restore it on its own)
		.replace(/\brounded[a-z-]*(?:-\[[^\]]+\])?\b/g, "")
		.replace(/\bh-(\[[^\]]+\]|[0-9.]+)\b/g, "")
		.replace(/\bmin-h-(\[[^\]]+\]|[0-9.]+)\b/g, "")
		.replace(/\bopacity-(65|70|80|90)\b/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.concat(" rounded-full");
}

export { buttonVariants };

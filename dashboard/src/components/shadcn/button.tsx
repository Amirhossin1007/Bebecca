import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "lib/cn";

/**
 * shadcn/ui button, themed with the panel's own tokens instead of the default
 * neutral palette. Sizes and heights follow the dashboard's controls so a
 * migrated screen sits next to a Chakra one without a visible seam.
 */
const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors outline-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-panel-accent/40 [&_svg]:pointer-events-none [&_svg]:shrink-0",
	{
		variants: {
			variant: {
				default:
					"bg-panel-accent text-white hover:bg-panel-accent-hover shadow-sm",
				outline:
					"border border-panel-border-strong bg-transparent text-panel-text hover:bg-panel-elevated",
				ghost:
					"bg-transparent text-panel-text-secondary hover:bg-panel-elevated hover:text-panel-text",
				subtle:
					"bg-panel-elevated text-panel-text hover:bg-panel-border",
				destructive:
					"bg-panel-danger text-white hover:bg-panel-danger/90",
				link: "text-panel-accent underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-4",
				sm: "h-9 px-3.5 text-[0.8125rem]",
				xs: "h-8 px-3 text-[0.75rem]",
				icon: "size-9",
				"icon-sm": "size-8",
			},
		},
		defaultVariants: { variant: "default", size: "default" },
	},
);

export type ButtonProps = React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	};

/**
 * `forwardRef` is required, not optional: Radix triggers (DropdownMenu,
 * Dialog, Tooltip) measure their child through a ref. React 18 does not pass
 * `ref` to plain function components, and without it the popper never
 * positions — which is exactly how this bug showed up.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	function Button({ className, variant, size, asChild = false, ...props }, ref) {
		const classes = cn(buttonVariants({ variant, size }), className);
		// Slot.Element and "button" accept the same DOM props; their ref types are
		// the one thing TypeScript cannot unify, so the component type is widened.
		const Comp = (asChild ? Slot : "button") as React.ElementType;

		return (
			<Comp data-slot="button" ref={ref} className={classes} {...props} />
		);
	},
);

export { buttonVariants };

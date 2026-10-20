import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

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

export function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: ButtonProps) {
	const classes = cn(buttonVariants({ variant, size }), className);

	if (asChild) {
		// Slot forwards to whatever the caller renders; its ref type is the generic
		// element, so the button props are cast once here instead of at every call.
		const SlotComp = Slot.Root as React.ElementType;
		return <SlotComp data-slot="button" className={classes} {...props} />;
	}

	return <button data-slot="button" className={classes} {...props} />;
}

export { buttonVariants };

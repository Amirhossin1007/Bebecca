import { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "lib/cn";

/**
 * shadcn/ui tooltip with Chakra's tooltip look: gray.700 on light, gray.300 on
 * dark, small padding and an arrow. Radix needs a provider above any tooltip.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
	className,
	sideOffset = 6,
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				sideOffset={sideOffset}
				className={cn(
					"z-[1950] max-w-xs rounded-sm bg-[#2d3748] px-2 py-0.5 text-sm font-medium text-[rgba(255,255,255,0.92)] shadow-md dark:bg-[#cbd5e0] dark:text-[#171923]",
					className,
				)}
				{...props}
			>
				{children}
				<TooltipPrimitive.Arrow className="fill-[#2d3748] dark:fill-[#cbd5e0]" />
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

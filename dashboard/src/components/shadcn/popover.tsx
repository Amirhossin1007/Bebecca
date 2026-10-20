import { Popover as PopoverPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "lib/cn";

/**
 * shadcn/ui popover on the panel's tokens. It replaces Chakra's Popover in the
 * mobile dock. `container` keeps the portal inside an element when the popover
 * has to stay inside an open menu (the nested theme picker does).
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export function PopoverContent({
	className,
	align = "start",
	sideOffset = 6,
	collisionPadding = 8,
	container,
	...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
	container?: HTMLElement | null;
}) {
	return (
		<PopoverPrimitive.Portal container={container ?? undefined}>
			<PopoverPrimitive.Content
				align={align}
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				className={cn(
					"z-[1900] rounded-md border border-panel-border bg-panel-surface text-panel-text shadow-lg shadow-black/30 outline-none",
					className,
				)}
				{...props}
			/>
		</PopoverPrimitive.Portal>
	);
}

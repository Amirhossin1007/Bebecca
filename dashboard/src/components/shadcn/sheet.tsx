import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "lib/cn";

/**
 * Edge-anchored dialog for the mobile navigation drawer. It stands in for
 * Chakra's Drawer: same overlay (black at 50%), same stacking (1400), same
 * full-height panel on the start edge. Esc and an overlay tap close it.
 */
export const Sheet = DialogPrimitive.Root;
export const SheetTitle = DialogPrimitive.Title;

export function SheetContent({
	className,
	side = "left",
	children,
	...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
	side?: "left" | "right";
}) {
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-[1400] bg-black/50" />
			<DialogPrimitive.Content
				aria-describedby={undefined}
				className={cn(
					"fixed inset-y-0 z-[1400] flex flex-col outline-none",
					side === "left" ? "left-0" : "right-0",
					className,
				)}
				{...props}
			>
				{children}
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	);
}

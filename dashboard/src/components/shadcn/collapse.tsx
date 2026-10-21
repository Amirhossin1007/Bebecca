import type { ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";

/**
 * Chakra's Collapse: the content animates its height with a grid-row
 * transition. `in` is the open state and `unmountOnExit` removes the children
 * when closed, as in Chakra.
 */
export function Collapse({
	in: isOpen = false,
	unmountOnExit = false,
	animateOpacity = false,
	className,
	children,
	...props
}: ComponentPropsWithoutRef<"div"> & {
	in?: boolean;
	unmountOnExit?: boolean;
	animateOpacity?: boolean;
	startingHeight?: number;
	endingHeight?: string;
}) {
	if (unmountOnExit && !isOpen) return null;
	return (
		<div
			className={cn(
				"grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out",
				isOpen ? "grid-rows-[1fr]" : "invisible grid-rows-[0fr]",
				animateOpacity && (isOpen ? "opacity-100" : "opacity-0"),
				className,
			)}
			{...props}
		>
			<div className="min-h-0 overflow-hidden">{children}</div>
		</div>
	);
}

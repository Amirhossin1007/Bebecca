import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "lib/cn";
import { parsePlacement } from "components/shadcn/placement";

/**
 * shadcn/ui tooltip with Chakra's tooltip look: gray.700 on light, gray.300 on
 * dark, small padding and an arrow. Radix needs a provider above any tooltip.
 */
export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
	className,
	sideOffset = 6,
	hasArrow = true,
	children,
	...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { hasArrow?: boolean }) {
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
				{hasArrow ? (
					<TooltipPrimitive.Arrow className="fill-[#2d3748] dark:fill-[#cbd5e0]" />
				) : null}
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
}

type TooltipRootProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>;

/**
 * Chakra's Tooltip (`label` + child trigger), or the plain Radix root when no
 * `label` is given, which is how the shadcn parts are composed.
 */
export function Tooltip({
	label,
	children,
	placement = "top",
	hasArrow = false,
	isDisabled = false,
	openDelay,
	closeDelay,
	// Chakra closes on click and mousedown; Radix already closes a tooltip on click.
	closeOnClick: _closeOnClick,
	closeOnMouseDown: _closeOnMouseDown,
	className,
	...rest
}: TooltipRootProps & {
	className?: string;
	closeOnClick?: boolean;
	closeOnMouseDown?: boolean;
	label?: ReactNode;
	placement?: string;
	hasArrow?: boolean;
	isDisabled?: boolean;
	openDelay?: number;
	closeDelay?: number;
}) {
	if (label === undefined) {
		return <TooltipPrimitive.Root {...rest}>{children}</TooltipPrimitive.Root>;
	}
	if (isDisabled || label === null || label === "" || label === false) {
		return <>{children}</>;
	}
	const { side, align } = parsePlacement(placement);
	return (
		<TooltipProvider delayDuration={openDelay ?? 0} skipDelayDuration={closeDelay ?? 0}>
			<TooltipPrimitive.Root {...rest}>
				<TooltipPrimitive.Trigger asChild>
					<span className="inline-flex">{children}</span>
				</TooltipPrimitive.Trigger>
				<TooltipContent side={side} align={align} hasArrow={hasArrow} className={className}>
					{label}
				</TooltipContent>
			</TooltipPrimitive.Root>
		</TooltipProvider>
	);
}

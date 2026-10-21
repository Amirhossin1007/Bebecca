import { forwardRef, type ComponentPropsWithoutRef, type ComponentType, type ElementType } from "react";
import { cn } from "lib/cn";

/**
 * Chakra's Icon: 1em square, currentColor fill, and a heroicon through `as`.
 * `as` is a component that accepts className (heroicons do).
 */
export const Icon = forwardRef<
	SVGSVGElement,
	ComponentPropsWithoutRef<"svg"> & { as?: ElementType; viewBox?: string }
>(function Icon({ as: As, viewBox = "0 0 24 24", className, children, ...props }, ref) {
	const classes = cn("inline-block h-[1em] w-[1em] shrink-0 align-middle text-current", className);
	if (As) return <As ref={ref} className={classes} {...props} />;
	return (
		<svg ref={ref} viewBox={viewBox} fill="currentColor" focusable="false" aria-hidden="true" className={classes} {...props}>
			{children}
		</svg>
	);
});

/**
 * Chakra's chakra(Component, styleProps). The style object is turned into
 * classes once, at the call site of the codemod, and passed as `base`.
 */
export function withClass<P extends object = Record<string, never>>(Component: ComponentType<P>, base: string) {
	return function Styled({ className, ...props }: P & { className?: string }) {
		return <Component className={cn(base, className)} {...(props as P)} />;
	};
}

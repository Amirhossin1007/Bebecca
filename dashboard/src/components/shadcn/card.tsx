import { forwardRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";

/** Chakra's Card on the panel surface. The padding is Chakra's card padding (1.25rem). */
export const Card = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function Card(
	{ className, ...props },
	ref,
) {
	return (
		<div
			ref={ref}
			className={cn(
				"relative flex min-w-0! flex-col break-words rounded-md border border-panel-border! bg-panel-surface shadow-none",
				className,
			)}
			{...props}
		/>
	);
});

export const CardHeader = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function CardHeader(
	{ className, ...props },
	ref,
) {
	return <div ref={ref} className={cn("p-5", className)} {...props} />;
});

export const CardBody = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function CardBody(
	{ className, ...props },
	ref,
) {
	return <div ref={ref} className={cn("flex-1 p-5", className)} {...props} />;
});

export const CardFooter = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function CardFooter(
	{ className, ...props },
	ref,
) {
	return <div ref={ref} className={cn("p-5", className)} {...props} />;
});

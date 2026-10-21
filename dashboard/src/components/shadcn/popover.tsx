import { Popover as PopoverPrimitive } from "radix-ui";
import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode, forwardRef } from "react";
import { cn } from "lib/cn";
import { parsePlacement } from "components/shadcn/placement";

type PopoverContextValue = {
	side: ReturnType<typeof parsePlacement>["side"];
	align: ReturnType<typeof parsePlacement>["align"];
	gutter: number;
	closeOnBlur: boolean;
	autoFocus: boolean;
};

const PopoverContext = createContext<PopoverContextValue>({
	side: "bottom",
	align: "center",
	gutter: 8,
	closeOnBlur: true,
	autoFocus: true,
});

/**
 * Popover on Radix. It takes Chakra's `isOpen` / `onOpen` / `onClose` and
 * `placement`, and also the Radix-style `open` / `onOpenChange`, so both
 * kinds of call site work.
 */
export function Popover({
	open,
	onOpenChange,
	open: isOpen,
	onOpen,
	onClose,
	defaultOpen,
	placement,
	gutter = 8,
	closeOnBlur = true,
	autoFocus = true,
	closeOnEsc: _closeOnEsc,
	trigger: _trigger,
	openDelay: _openDelay,
	closeDelay: _closeDelay,
	children,
}: {
	closeOnEsc?: boolean;
	trigger?: string;
	openDelay?: number;
	closeDelay?: number;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	onOpen?: () => void;
	onClose?: () => void;
	defaultOpen?: boolean;
	placement?: string;
	gutter?: number;
	closeOnBlur?: boolean;
	autoFocus?: boolean;
	isLazy?: boolean;
	children?: ReactNode;
	strategy?: string;
	modifiers?: unknown;
}) {
	const controlled = open ?? isOpen;
	const { side, align } = parsePlacement(placement);
	return (
		<PopoverContext.Provider value={{ side, align, gutter, closeOnBlur, autoFocus }}>
			<PopoverPrimitive.Root
				open={controlled}
				defaultOpen={defaultOpen}
				onOpenChange={(next) => {
					onOpenChange?.(next);
					if (next) onOpen?.();
					else onClose?.();
				}}
			>
				{children}
			</PopoverPrimitive.Root>
		</PopoverContext.Provider>
	);
}

/** The trigger is the child element, as in Chakra. */
export function PopoverTrigger({
	children,
	asChild = true,
	...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Trigger>) {
	return (
		<PopoverPrimitive.Trigger asChild={asChild} {...props}>
			{children}
		</PopoverPrimitive.Trigger>
	);
}

/** The panel. `container` keeps it inside an element when it has to stay within an open menu. */
export function PopoverContent({
	className,
	align,
	side,
	sideOffset,
	collisionPadding = 8,
	container,
	children,
	...props
}: ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
	container?: HTMLElement | null;
}) {
	const ctx = useContext(PopoverContext);
	return (
		<PopoverPrimitive.Portal container={container ?? undefined}>
			<PopoverPrimitive.Content
				side={side ?? ctx.side}
				align={align ?? ctx.align}
				sideOffset={sideOffset ?? ctx.gutter}
				collisionPadding={collisionPadding}
				onInteractOutside={(event) => {
					if (!ctx.closeOnBlur) event.preventDefault();
				}}
				onOpenAutoFocus={(event) => {
					if (!ctx.autoFocus) event.preventDefault();
				}}
				className={cn(
					"z-[1900] rounded-md border border-panel-border! bg-panel-surface text-panel-text shadow-[0_18px_48px_rgba(0,0,0,0.38)] outline-none",
					className,
				)}
				{...props}
			>
				{children}
			</PopoverPrimitive.Content>
		</PopoverPrimitive.Portal>
	);
}

export function PopoverArrow({ className }: { className?: string }) {
	return <PopoverPrimitive.Arrow className={cn("fill-panel-surface", className)} />;
}

export const PopoverBody = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<"div">>(function PopoverBody({ className, ...props }, ref) {
	return <div ref={ref} className={cn("px-3 py-2", className)} {...props} />;
});

export function PopoverHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn("border-b border-panel-border! px-3 py-2 font-semibold", className)}
			{...props}
		/>
	);
}

export function PopoverFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div className={cn("border-t border-panel-border! px-3 py-2", className)} {...props} />
	);
}

export function PopoverCloseButton({ className, ...props }: ComponentPropsWithoutRef<"button">) {
	return (
		<PopoverPrimitive.Close asChild>
			<button
				type="button"
				aria-label="Close"
				className={cn(
					"absolute end-2 top-2 inline-flex size-6 items-center justify-center rounded-md text-panel-text-secondary hover:bg-panel-elevated",
					className,
				)}
				{...props}
			>
				<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
					<path d="M6 6l12 12M18 6L6 18" />
				</svg>
			</button>
		</PopoverPrimitive.Close>
	);
}

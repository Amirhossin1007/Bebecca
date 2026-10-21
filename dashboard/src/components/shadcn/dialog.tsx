import { XMarkIcon } from "@heroicons/react/24/outline";
import {
	AlertDialog as AlertDialogPrimitive,
	Dialog as DialogPrimitive,
} from "radix-ui";
import {
	type FormEventHandler,
	createContext,
	useContext,
	type ComponentPropsWithoutRef,
	type ReactNode,
	type RefObject,
} from "react";
import { cn } from "lib/cn";

export type ModalSize =
	| "xs"
	| "sm"
	| "md"
	| "lg"
	| "xl"
	| "2xl"
	| "3xl"
	| "4xl"
	| "5xl"
	| "6xl"
	| "full";

/** Chakra's modal sizes. The widths are the same as Tailwind's max-w scale. */
const SIZE_CLASS: Record<ModalSize, string> = {
	xs: "max-w-xs",
	sm: "max-w-sm",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-xl",
	"2xl": "max-w-2xl",
	"3xl": "max-w-3xl",
	"4xl": "max-w-4xl",
	"5xl": "max-w-5xl",
	"6xl": "max-w-6xl",
	full: "max-w-none h-dvh rounded-none",
};

type ModalContextValue = {
	size: ModalSize;
	isCentered: boolean;
	scrollBehavior: "inside" | "outside";
	closeOnOverlayClick: boolean;
	closeOnEsc: boolean;
	onClose: () => void;
	initialFocusRef?: RefObject<HTMLElement | null>;
	finalFocusRef?: RefObject<HTMLElement | null>;
};

const ModalContext = createContext<ModalContextValue>({
	size: "md",
	isCentered: false,
	scrollBehavior: "outside",
	closeOnOverlayClick: true,
	closeOnEsc: true,
	onClose: () => {},
});

/**
 * Chakra's Modal, on Radix Dialog. `isOpen` and `onClose` keep their Chakra
 * names so the call sites only change their import.
 */
export function Modal({
	open: isOpen,
	onClose,
	size = "md",
	isCentered = false,
	scrollBehavior = "outside",
	closeOnOverlayClick = true,
	closeOnEsc = true,
	initialFocusRef,
	finalFocusRef,
	children,
}: {
	open: boolean;
	onClose: () => void;
	size?: ModalSize;
	isCentered?: boolean;
	scrollBehavior?: "inside" | "outside";
	closeOnOverlayClick?: boolean;
	closeOnEsc?: boolean;
	initialFocusRef?: RefObject<HTMLElement | null>;
	finalFocusRef?: RefObject<HTMLElement | null>;
	children?: ReactNode;
	motionPreset?: string;
	blockScrollOnMount?: boolean;
	returnFocusOnClose?: boolean;
	trapFocus?: boolean;
}) {
	return (
		<ModalContext.Provider
			value={{
				size,
				isCentered,
				scrollBehavior,
				closeOnOverlayClick,
				closeOnEsc,
				onClose,
				initialFocusRef,
				finalFocusRef,
			}}
		>
			<DialogPrimitive.Root
				open={isOpen}
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
			>
				{children}
			</DialogPrimitive.Root>
		</ModalContext.Provider>
	);
}

/** Kept for Chakra's structure. The overlay is drawn by ModalContent. */
export function ModalOverlay(_props: { children?: ReactNode; className?: string }) {
	return null;
}

/**
 * The dialog surface, positioned like Chakra's: a box at the top of the
 * viewport, centered when `isCentered`, and a bottom sheet below the md
 * breakpoint.
 */
export function ModalContent({
	className,
	children,
	as,
	onSubmit,
	...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { as?: "form"; onSubmit?: FormEventHandler<HTMLFormElement> }) {
	const ctx = useContext(ModalContext);
	return (
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay className="fixed inset-0 z-[1400] bg-blackAlpha-500" />
			{/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop: a mouse-down outside the panel dismisses the dialog */}
			<div
				className={cn(
					"fixed inset-0 z-[1401] flex justify-center overflow-y-auto p-4 md:py-16",
					ctx.isCentered ? "items-center md:py-4" : "items-start",
					"max-md:items-end max-md:p-0",
				)}
				onMouseDown={(event) => {
					if (event.target === event.currentTarget && ctx.closeOnOverlayClick) {
						ctx.onClose();
					}
				}}
			>
				<DialogPrimitive.Content
					onOpenAutoFocus={(event) => {
						if (ctx.initialFocusRef?.current) {
							event.preventDefault();
							ctx.initialFocusRef.current.focus();
						}
					}}
					onCloseAutoFocus={(event) => {
						if (ctx.finalFocusRef?.current) {
							event.preventDefault();
							ctx.finalFocusRef.current.focus();
						}
					}}
					onPointerDownOutside={(event) => {
						if (!ctx.closeOnOverlayClick) event.preventDefault();
					}}
					onEscapeKeyDown={(event) => {
						if (!ctx.closeOnEsc) event.preventDefault();
					}}
					aria-describedby={undefined}
					className={cn(
						"relative flex w-full flex-col rounded-[16px] border border-panel-border! bg-panel-surface text-panel-text shadow-[0_24px_72px_rgba(0,0,0,0.46)] outline-none",
						SIZE_CLASS[ctx.size],
						ctx.scrollBehavior === "inside" && "max-h-[calc(100dvh_-_8rem)]",
						"max-md:max-h-[92dvh] max-md:w-full max-md:max-w-full max-md:rounded-b-none max-md:rounded-t-[16px] max-md:border-b-0 max-md:pb-[env(safe-area-inset-bottom)] max-md:animate-[rb-sheet-up_0.28s_cubic-bezier(0.32,0.72,0,1)]",
						"max-md:before:mx-auto max-md:before:mt-2 max-md:before:block max-md:before:h-1 max-md:before:w-9 max-md:before:shrink-0 max-md:before:rounded-full max-md:before:bg-panel-border-strong max-md:before:content-['']",
						className,
					)}
					{...props}
				>
					{as === "form" ? (
						<form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
							{children}
						</form>
					) : (
						children
					)}
				</DialogPrimitive.Content>
			</div>
		</DialogPrimitive.Portal>
	);
}

export function ModalCloseButton({ className, disabled: isDisabled, ...props }: ComponentPropsWithoutRef<"button"> & { disabled?: boolean }) {
	return (
		<DialogPrimitive.Close asChild>
			<button
				type="button"
				aria-label="Close"
				disabled={isDisabled}
				className={cn(
					"absolute end-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-panel-text-secondary hover:bg-panel-elevated",
					className,
				)}
				{...props}
			>
				<XMarkIcon className="size-4" />
			</button>
		</DialogPrimitive.Close>
	);
}

export function ModalHeader({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"border-b border-panel-border! px-6 py-4 text-lg font-semibold",
				className,
			)}
			{...props}
		/>
	);
}

export function ModalBody({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return <div className={cn("min-h-0 flex-1 overflow-y-auto px-6 py-2", className)} {...props} />;
}

export function ModalFooter({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return (
		<div
			className={cn(
				"flex items-center justify-end gap-3 border-t border-panel-border! px-6 py-4",
				className,
			)}
			{...props}
		/>
	);
}

/** Chakra's AlertDialog: a modal that asks for a confirmation and focuses the least destructive action. */
export function AlertDialog({
	open: isOpen,
	onClose,
	leastDestructiveRef,
	children,
}: {
	open: boolean;
	onClose: () => void;
	leastDestructiveRef?: RefObject<HTMLElement | null>;
	children?: ReactNode;
	motionPreset?: string;
	isCentered?: boolean;
	size?: ModalSize;
}) {
	return (
		<ModalContext.Provider
			value={{
				size: "md",
				isCentered: true,
				scrollBehavior: "outside",
				closeOnOverlayClick: false,
				closeOnEsc: true,
				onClose,
				initialFocusRef: leastDestructiveRef,
			}}
		>
			<AlertDialogPrimitive.Root
				open={isOpen}
				onOpenChange={(open) => {
					if (!open) onClose();
				}}
			>
				{children}
			</AlertDialogPrimitive.Root>
		</ModalContext.Provider>
	);
}

export function AlertDialogOverlay(_props: { children?: ReactNode; className?: string }) {
	return null;
}

export function AlertDialogContent({
	className,
	children,
	...props
}: ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>) {
	const ctx = useContext(ModalContext);
	return (
		<AlertDialogPrimitive.Portal>
			<AlertDialogPrimitive.Overlay className="fixed inset-0 z-[1400] bg-blackAlpha-500" />
			<div className="fixed inset-0 z-[1401] flex items-center justify-center overflow-y-auto p-4">
				<AlertDialogPrimitive.Content
					onOpenAutoFocus={(event) => {
						if (ctx.initialFocusRef?.current) {
							event.preventDefault();
							ctx.initialFocusRef.current.focus();
						}
					}}
					aria-describedby={undefined}
					className={cn(
						"relative flex w-full max-w-md flex-col rounded-[16px] border border-panel-border! bg-panel-surface text-panel-text shadow-[0_24px_72px_rgba(0,0,0,0.46)] outline-none",
						className,
					)}
					{...props}
				>
					{children}
				</AlertDialogPrimitive.Content>
			</div>
		</AlertDialogPrimitive.Portal>
	);
}

export function AlertDialogHeader(props: ComponentPropsWithoutRef<"div">) {
	return <ModalHeader {...props} />;
}

export function AlertDialogBody(props: ComponentPropsWithoutRef<"div">) {
	return <ModalBody {...props} />;
}

export function AlertDialogFooter(props: ComponentPropsWithoutRef<"div">) {
	return <ModalFooter {...props} />;
}

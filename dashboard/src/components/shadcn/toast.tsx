import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "lib/cn";

export type ToastStatus = "info" | "warning" | "success" | "error" | "loading";
export type ToastPosition =
	| "top"
	| "top-left"
	| "top-right"
	| "bottom"
	| "bottom-left"
	| "bottom-right";

export type ToastOptions = {
	id?: string | number;
	title?: ReactNode;
	description?: ReactNode;
	status?: ToastStatus;
	/** Milliseconds before the toast closes. `null` keeps it open. */
	duration?: number | null;
	isClosable?: boolean;
	position?: ToastPosition;
	variant?: "solid" | "subtle" | "left-accent" | "top-accent";
	onCloseComplete?: () => void;
};

type StoredToast = ToastOptions & { id: string | number };

/** Same defaults as the Chakra toast this replaces. */
const DEFAULT_DURATION = 5000;
const DEFAULT_POSITION: ToastPosition = "bottom";

let toasts: StoredToast[] = [];
const listeners = new Set<() => void>();
const timers = new Map<string | number, number>();
let nextId = 1;

function emit() {
	for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return toasts;
}

function scheduleClose(id: string | number, duration: number | null | undefined) {
	const wait = duration === undefined ? DEFAULT_DURATION : duration;
	if (wait === null) return;
	window.clearTimeout(timers.get(id));
	timers.set(id, window.setTimeout(() => closeToast(id), wait));
}

function closeToast(id: string | number) {
	const closing = toasts.find((item) => item.id === id);
	window.clearTimeout(timers.get(id));
	timers.delete(id);
	if (!closing) return;
	toasts = toasts.filter((item) => item.id !== id);
	closing.onCloseComplete?.();
	emit();
}

function closeAllToasts() {
	for (const item of toasts) window.clearTimeout(timers.get(item.id));
	timers.clear();
	toasts = [];
	emit();
}

function isToastActive(id: string | number) {
	return toasts.some((item) => item.id === id);
}

function showToast(options: ToastOptions): string | number {
	const id = options.id ?? `toast-${nextId++}`;
	// A toast with the same id replaces the previous one, as in Chakra.
	toasts = [...toasts.filter((item) => item.id !== id), { ...options, id }];
	scheduleClose(id, options.duration);
	emit();
	return id;
}

function updateToast(id: string | number, options: ToastOptions) {
	if (!isToastActive(id)) return;
	toasts = toasts.map((item) => (item.id === id ? { ...item, ...options, id } : item));
	scheduleClose(id, options.duration);
	emit();
}

export type ToastFunction = ((options: ToastOptions) => string | number) & {
	close: (id: string | number) => void;
	closeAll: () => void;
	isActive: (id: string | number) => boolean;
	update: (id: string | number, options: ToastOptions) => void;
};

const toastFunction = Object.assign(showToast, {
	close: closeToast,
	closeAll: closeAllToasts,
	isActive: isToastActive,
	update: updateToast,
}) as ToastFunction;

/** For code that runs outside React, such as utils/toastHandler. */
export const toast: ToastFunction = toastFunction;

/** Replaces Chakra's useToast. The returned function is stable and works outside React too. */
export function useToast(): ToastFunction {
	return toastFunction;
}

const STATUS_BG: Record<ToastStatus, string> = {
	info: "bg-blue-500",
	loading: "bg-blue-500",
	success: "bg-green-500",
	warning: "bg-orange-500",
	error: "bg-red-500",
};

const STATUS_ICON: Record<ToastStatus, typeof InformationCircleIcon> = {
	info: InformationCircleIcon,
	loading: InformationCircleIcon,
	success: CheckCircleIcon,
	warning: ExclamationTriangleIcon,
	error: XCircleIcon,
};

const POSITION_CLASS: Record<ToastPosition, string> = {
	top: "top-4 left-1/2 -translate-x-1/2 items-center",
	"top-left": "top-4 start-4 items-start",
	"top-right": "top-4 end-4 items-end",
	bottom: "bottom-4 left-1/2 -translate-x-1/2 items-center",
	"bottom-left": "bottom-4 start-4 items-start",
	"bottom-right": "bottom-4 end-4 items-end",
};

function ToastItem({ item }: { item: StoredToast }) {
	const status = item.status ?? "info";
	const Icon = STATUS_ICON[status];
	return (
		// biome-ignore lint/a11y/useSemanticElements: toast live region: role=status keeps it announced
		<div
			role="status"
			className={cn(
				"pointer-events-auto flex w-[min(448px,calc(100vw_-_2rem))] items-start gap-3 rounded-md p-3 text-sm text-white shadow-lg",
				STATUS_BG[status],
			)}
		>
			{status === "loading" ? (
				<span className="mt-0.5 inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />
			) : (
				<Icon className="mt-0.5 size-5 shrink-0" />
			)}
			<div className="min-w-0 flex-1">
				{item.title ? <div className="font-semibold">{item.title}</div> : null}
				{item.description ? <div className="mt-0.5 opacity-90">{item.description}</div> : null}
			</div>
			{item.isClosable ? (
				<button
					type="button"
					aria-label="Close"
					onClick={() => closeToast(item.id)}
					className="inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-white/20"
				>
					<XMarkIcon className="size-4" />
				</button>
			) : null}
		</div>
	);
}

/** Mount once near the app root. Renders every open toast at its position. */
export function Toaster() {
	const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	const positions = Array.from(
		new Set(items.map((item) => item.position ?? DEFAULT_POSITION)),
	);
	return (
		<>
			{positions.map((position) => (
				<div
					key={position}
					className={cn(
						"pointer-events-none fixed z-[1700] flex flex-col gap-2",
						POSITION_CLASS[position],
					)}
				>
					{items
						.filter((item) => (item.position ?? DEFAULT_POSITION) === position)
						.map((item) => (
							<ToastItem key={String(item.id)} item={item} />
						))}
				</div>
			))}
		</>
	);
}

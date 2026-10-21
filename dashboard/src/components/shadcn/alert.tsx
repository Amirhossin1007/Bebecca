import type { ElementType } from "react";
import {
	CheckCircleIcon,
	ExclamationTriangleIcon,
	InformationCircleIcon,
	XCircleIcon,
} from "@heroicons/react/24/outline";
import { createContext, useContext, type ComponentPropsWithoutRef } from "react";
import { cn } from "lib/cn";
import { Spinner } from "components/shadcn/feedback";

type Status = "info" | "warning" | "success" | "error" | "loading";
type Variant = "subtle" | "solid" | "left-accent";

/** Chakra's default status colours: info and loading blue, success green, warning orange, error red. */
const STATUS_SCHEME: Record<Status, string> = {
	info: "blue",
	loading: "blue",
	success: "green",
	warning: "orange",
	error: "red",
};

const STATUS_ICON = {
	info: InformationCircleIcon,
	loading: InformationCircleIcon,
	success: CheckCircleIcon,
	warning: ExclamationTriangleIcon,
	error: XCircleIcon,
} as const;

const AlertContext = createContext<{ status: Status }>({ status: "info" });

/** Chakra's Alert. AlertIcon reads the status from context, so the parts can sit as siblings. */
export function Alert({
	status = "info",
	variant = "subtle",
	className,
	children,
	as: Comp = "div",
	...props
}: ComponentPropsWithoutRef<"div"> & { as?: ElementType;
	to?: string; status?: Status; variant?: Variant }) {
	const scheme = STATUS_SCHEME[status];
	const tone =
		variant === "solid"
			? `bg-${scheme}-500 text-white`
			: variant === "left-accent"
				? `border-s-4 border-${scheme}-500 bg-${scheme}-100 dark:bg-${scheme}-200/16`
				: `bg-${scheme}-100 dark:bg-${scheme}-200/16`;
	return (
		<AlertContext.Provider value={{ status }}>
			<Comp
				role="alert"
				className={cn(
					"flex w-full items-center gap-2 rounded-md p-4 text-sm text-panel-text",
					tone,
					className,
				)}
				{...props}
			>
				{children}
			</Comp>
		</AlertContext.Provider>
	);
}

export function AlertIcon({ className }: { className?: string }) {
	const { status } = useContext(AlertContext);
	const scheme = STATUS_SCHEME[status];
	if (status === "loading") {
		return <Spinner size="sm" className={cn("shrink-0", className)} />;
	}
	const Icon = STATUS_ICON[status];
	return (
		<Icon
			className={cn(
				"size-5 shrink-0",
				`text-${scheme}-500 dark:text-${scheme}-200`,
				className,
			)}
		/>
	);
}

export function AlertTitle({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return <div className={cn("font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: ComponentPropsWithoutRef<"div">) {
	return <div className={cn("text-sm", className)} {...props} />;
}

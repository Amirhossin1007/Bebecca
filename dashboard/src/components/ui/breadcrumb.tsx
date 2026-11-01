import { Button } from "components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { cn } from "lib/cn";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import {
	cloneElement,
	forwardRef,
	type HTMLAttributes,
	type LiHTMLAttributes,
	type OlHTMLAttributes,
	type ReactElement,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";

export interface BreadcrumbProps extends HTMLAttributes<HTMLElement> {
	children?: ReactNode;
}

export const Breadcrumb = forwardRef<HTMLElement, BreadcrumbProps>(
	({ className, ...props }, ref) => (
		<nav
			ref={ref}
			aria-label="breadcrumb"
			className={cn("min-w-0", className)}
			{...props}
		/>
	),
);
Breadcrumb.displayName = "Breadcrumb";

export interface BreadcrumbListProps
	extends OlHTMLAttributes<HTMLOListElement> {
	children?: ReactNode;
}

export const BreadcrumbList = forwardRef<HTMLOListElement, BreadcrumbListProps>(
	({ className, ...props }, ref) => (
		<ol
			ref={ref}
			className={cn(
				"flex flex-nowrap items-center gap-1.5 list-none min-w-0 p-0 m-0",
				className,
			)}
			{...props}
		/>
	),
);
BreadcrumbList.displayName = "BreadcrumbList";

export interface BreadcrumbItemProps
	extends LiHTMLAttributes<HTMLLIElement> {
	children?: ReactNode;
}

export const BreadcrumbItem = forwardRef<HTMLLIElement, BreadcrumbItemProps>(
	({ className, ...props }, ref) => (
		<li
			ref={ref}
			className={cn(
				"inline-flex items-center gap-1.5 list-none min-w-0",
				className,
			)}
			{...props}
		/>
	),
);
BreadcrumbItem.displayName = "BreadcrumbItem";

export interface BreadcrumbLinkProps extends HTMLAttributes<HTMLElement> {
	children?: ReactNode;
	href?: string;
	onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
	render?: ReactElement;
	asChild?: boolean;
	isClickable?: boolean;
}

export const BreadcrumbLink = forwardRef<HTMLElement, BreadcrumbLinkProps>(
	(
		{
			render,
			children,
			href,
			onClick,
			isClickable = true,
			className,
			...props
		},
		ref,
	) => {
		if (render) {
			return cloneElement(render, {
				ref,
				className: cn(render.props.className, className),
				onClick: isClickable
					? (e: ReactMouseEvent<HTMLElement>) => {
							render.props.onClick?.(e);
							onClick?.(e);
						}
					: undefined,
				children: render.props.children ?? children,
				...props,
			});
		}

		if (!isClickable || (!href && !onClick)) {
			return (
				<span
					ref={ref as any}
					className={cn(
						"inline-flex items-center p-0 h-auto min-w-0 whitespace-nowrap cursor-default select-none text-xs md:text-[12.5px] font-medium text-panel-text-muted",
						className,
					)}
					{...props}
				>
					{children}
				</span>
			);
		}

		if (href) {
			return (
				<a
					ref={ref as any}
					href={href}
					onClick={onClick}
					className={cn(
						"inline-flex items-center p-0 h-auto min-w-0 whitespace-nowrap bg-transparent border-none cursor-pointer text-xs md:text-[12.5px] font-medium text-panel-text-secondary transition-colors md:hover:text-panel-text active:scale-[0.98]",
						className,
					)}
					{...props}
				>
					{children}
				</a>
			);
		}

		return (
			<button
				ref={ref as any}
				type="button"
				onClick={onClick}
				className={cn(
					"inline-flex items-center p-0 h-auto min-w-0 whitespace-nowrap bg-transparent border-none cursor-pointer text-xs md:text-[12.5px] font-medium text-panel-text-secondary transition-colors md:hover:text-panel-text active:scale-[0.98]",
					className,
				)}
				{...props}
			>
				{children}
			</button>
		);
	},
);
BreadcrumbLink.displayName = "BreadcrumbLink";

export interface BreadcrumbPageProps
	extends HTMLAttributes<HTMLSpanElement> {
	children?: ReactNode;
	isTruncated?: boolean;
	noOfLines?: number;
}

export const BreadcrumbPage = forwardRef<HTMLSpanElement, BreadcrumbPageProps>(
	({ isTruncated = false, className, ...props }, ref) => (
		<span
			ref={ref}
			role="link"
			aria-disabled="true"
			aria-current="page"
			className={cn(
				"text-xs md:text-[12.5px] font-semibold text-panel-text whitespace-nowrap",
				isTruncated ? "truncate max-w-full inline-block" : "inline-flex items-center",
				className,
			)}
			{...props}
		/>
	),
);
BreadcrumbPage.displayName = "BreadcrumbPage";

export interface BreadcrumbSeparatorProps
	extends LiHTMLAttributes<HTMLLIElement> {
	children?: ReactNode;
}

export const BreadcrumbSeparator = forwardRef<
	HTMLLIElement,
	BreadcrumbSeparatorProps
>(({ children, className, ...props }, ref) => {
	const { i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";
	const Chevron = isRTL ? ChevronLeft : ChevronRight;

	return (
		<li
			ref={ref}
			role="presentation"
			aria-hidden="true"
			className={cn(
				"inline-flex items-center justify-center text-panel-text-muted select-none list-none shrink-0",
				className,
			)}
			{...props}
		>
			{children ?? <Chevron className="size-3 stroke-[2.5]" />}
		</li>
	);
});
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

export interface BreadcrumbEllipsisProps
	extends HTMLAttributes<HTMLSpanElement> {
	children?: ReactNode;
}

export const BreadcrumbEllipsis = forwardRef<
	HTMLSpanElement,
	BreadcrumbEllipsisProps
>(({ children, className, ...props }, ref) => (
	<span
		ref={ref}
		role="presentation"
		aria-hidden="true"
		className={cn(
			"inline-flex items-center justify-center w-5 h-5",
			className,
		)}
		{...props}
	>
		{children ?? <MoreHorizontal className="size-3.5" />}
	</span>
));
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";

export interface BreadcrumbEllipsisDropdownProps {
	items: { label: string; path?: string }[];
	onNavigate?: (path: string) => void;
}

export const BreadcrumbEllipsisDropdown = ({
	items,
	onNavigate,
}: BreadcrumbEllipsisDropdownProps) => {
	const { i18n } = useTranslation();
	const isRTL = i18n.dir(i18n.language) === "rtl";

	if (items.length === 0) return null;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="w-[22px] h-[22px] min-w-[22px] p-0 rounded-md text-panel-text-muted hover:text-panel-text md:hover:bg-panel-elevated! active:scale-[0.94] transition-all"
					aria-label="Toggle breadcrumb menu"
				>
					<BreadcrumbEllipsis />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align={isRTL ? "start" : "end"}
				className="bg-panel-surface border border-panel-border! rounded-[14px] shadow-xl p-1.5 min-w-[160px] z-50"
			>
				{items.map((item, idx) => {
					if (!item.path) {
						return (
							<div
								key={`${item.label}-${idx}`}
								className="px-2.5 py-1.5 text-[11px] font-semibold text-panel-text-muted select-none tracking-wide"
							>
								{item.label}
							</div>
						);
					}

					return (
						<DropdownMenuItem
							key={`${item.label}-${idx}`}
							onSelect={() => onNavigate?.(item.path!)}
							className="rounded-lg text-xs font-medium text-panel-text px-2.5 py-1.5 cursor-pointer md:hover:bg-panel-elevated! active:scale-[0.98] transition-all"
						>
							{item.label}
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};

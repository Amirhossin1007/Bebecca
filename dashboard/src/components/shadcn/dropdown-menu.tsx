import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui";
import { CheckIcon } from "@heroicons/react/24/outline";
import type * as React from "react";

import { cn } from "lib/cn";

/**
 * Minimal shadcn/ui dropdown on the panel's tokens. Only the parts the
 * migration needs so far: trigger, content, label, item, checkbox item and
 * separator. Everything else is added as screens move over.
 */
export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;

export function DropdownMenuContent({
	className,
	align = "end",
	sideOffset = 6,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
	return (
		<DropdownMenuPrimitive.Portal>
			<DropdownMenuPrimitive.Content
				align={align}
				sideOffset={sideOffset}
				className={cn(
					"z-[1800] min-w-48 overflow-hidden rounded-xl border border-panel-border bg-panel-surface p-1.5 text-panel-text shadow-xl shadow-black/30",
					"data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
					className,
				)}
				{...props}
			/>
		</DropdownMenuPrimitive.Portal>
	);
}

export function DropdownMenuLabel({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label>) {
	return (
		<DropdownMenuPrimitive.Label
			className={cn(
				"px-2.5 pb-1.5 pt-2 text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-panel-text-muted",
				className,
			)}
			{...props}
		/>
	);
}

export function DropdownMenuItem({
	className,
	inset,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & { inset?: boolean }) {
	return (
		<DropdownMenuPrimitive.Item
			data-inset={inset}
			className={cn(
				"relative flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] leading-none outline-none transition-colors",
				"focus:bg-panel-elevated focus:text-panel-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				className,
			)}
			{...props}
		/>
	);
}

export function DropdownMenuCheckboxItem({
	className,
	children,
	checked,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
	return (
		<DropdownMenuPrimitive.CheckboxItem
			checked={checked}
			className={cn(
				"relative flex cursor-default select-none items-center gap-2.5 rounded-lg py-2 pe-2.5 ps-8 text-[0.8125rem] leading-none outline-none transition-colors",
				"focus:bg-panel-elevated focus:text-panel-text data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
				className,
			)}
			{...props}
		>
			<span className="pointer-events-none absolute start-2.5 flex size-4 items-center justify-center text-panel-accent">
				<DropdownMenuPrimitive.ItemIndicator>
					<CheckIcon className="size-3.5" />
				</DropdownMenuPrimitive.ItemIndicator>
			</span>
			{children}
		</DropdownMenuPrimitive.CheckboxItem>
	);
}

export function DropdownMenuSeparator({
	className,
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
	return (
		<DropdownMenuPrimitive.Separator
			className={cn("-mx-1.5 my-1 h-px bg-panel-border", className)}
			{...props}
		/>
	);
}

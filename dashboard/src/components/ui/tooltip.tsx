import * as React from "react"
import { cn } from "lib/cn"
import { Tooltip as TooltipPrimitive } from "radix-ui"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  // one provider per tooltip: the app never wrapped the tree in one, so the
  // registry's required <TooltipProvider> would otherwise be missing.
  return (
    <TooltipPrimitive.Provider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props}>
        {children}
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-[1950] w-fit origin-(--radix-tooltip-content-transform-origin) animate-in rounded-md bg-panel-elevated px-2.5 py-1 text-xs font-medium text-panel-text shadow-md ring-1 ring-panel-border fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-panel-elevated fill-panel-elevated ring-1 ring-panel-border" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/** Registry-shaped wrapper: <Tooltip><TooltipTrigger asChild>…<TooltipContent>…  */
function TooltipRoot({
	children,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	return (
		<TooltipProvider>
			<Tooltip {...props}>{children}</Tooltip>
		</TooltipProvider>
	)
}

export { TooltipRoot as Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

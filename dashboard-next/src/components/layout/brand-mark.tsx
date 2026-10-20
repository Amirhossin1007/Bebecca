import { cn } from "@/lib/utils"

/**
 * The panel mark: a rounded tile with a signal trace. Drawn inline so it
 * inherits the theme and stays crisp at 20–40px.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative grid place-items-center overflow-hidden rounded-[0.6rem] bg-linear-to-br from-primary/90 to-primary/55 text-primary-foreground shadow-sm ring-1 ring-inset ring-white/15",
        className,
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]">
        <path
          d="M4 15.5 8.2 9.9l3.4 3.1L15 5.8l5 8.6"
          stroke="currentColor"
          strokeWidth="2.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="9.6" cy="17.8" r="1.5" fill="currentColor" />
      </svg>
    </span>
  )
}

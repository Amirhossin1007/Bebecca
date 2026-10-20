import { useId } from "react"

import { cn } from "@/lib/utils"

type Series = {
  values: number[]
  tone?: string
  label?: string
}

type SparklineProps = {
  series: Series[]
  height?: number
  className?: string
  /** Fixed upper bound; defaults to the data maximum. */
  max?: number
  showArea?: boolean
}

/**
 * Dependency-free sparkline. Same clock for every series so overlapping lines
 * stay comparable, and a fixed viewBox so it scales without layout thrash.
 */
export function Sparkline({ series, height = 44, className, max, showArea = true }: SparklineProps) {
  const gradientId = useId().replace(/[:]/g, "")
  const width = 240
  const allValues = series.flatMap((item) => item.values).filter((value) => Number.isFinite(value))
  const upper = max ?? Math.max(...allValues, 1)
  const lower = 0
  const span = Math.max(upper - lower, 1)

  const toPath = (values: number[]) => {
    if (values.length === 0) return ""
    if (values.length === 1) {
      const y = height - ((values[0] - lower) / span) * height
      return `M0 ${y} L${width} ${y}`
    }
    return values
      .map((value, index) => {
        const x = (index / (values.length - 1)) * width
        const y = height - ((value - lower) / span) * height
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(" ")
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-11 w-full overflow-visible", className)}
      style={{ height }}
      role="img"
    >
      <defs>
        {series.map((item, index) => (
          <linearGradient key={index} id={`${gradientId}-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={item.tone ?? "var(--primary)"} stopOpacity="0.28" />
            <stop offset="100%" stopColor={item.tone ?? "var(--primary)"} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {series.map((item, index) => {
        const path = toPath(item.values)
        if (!path) return null
        return (
          <g key={index}>
            {showArea && item.values.length > 1 ? (
              <path
                d={`${path} L${width} ${height} L0 ${height} Z`}
                fill={`url(#${gradientId}-${index})`}
                stroke="none"
              />
            ) : null}
            <path
              d={path}
              fill="none"
              stroke={item.tone ?? "var(--primary)"}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}

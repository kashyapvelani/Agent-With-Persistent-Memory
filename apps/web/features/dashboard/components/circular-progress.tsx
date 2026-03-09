"use client"

interface CircularProgressProps {
  /** Progress value 0–100 */
  value: number
  /** Diameter in pixels */
  size?: number
  /** Stroke width in pixels */
  strokeWidth?: number
  /** Show spinning indeterminate state */
  indeterminate?: boolean
}

export function CircularProgress({
  value,
  size = 40,
  strokeWidth = 3,
  indeterminate = false,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(value, 100) / 100) * circumference
  const center = size / 2

  if (indeterminate) {
    return (
      <svg
        width={size}
        height={size}
        className="animate-spin"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          className="stroke-primary"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * 0.75}
          strokeLinecap="round"
        />
      </svg>
    )
  }

  const displayValue = Math.round(value)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        className="stroke-muted"
        strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        className="stroke-primary transition-[stroke-dashoffset] duration-300"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Percentage text */}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-[10px] font-medium"
      >
        {displayValue}%
      </text>
    </svg>
  )
}

// The observed/projected legend + the line swatch every chart legend is built from.
// Pure helpers and the frontier rule live in observed.ts.
import { LAST_OBSERVED_YEAR } from './observed'

/** One legend entry: a line sample in the series color + its label. */
export function Swatch({
  color = 'currentColor',
  dashed = false,
  children,
}: {
  color?: string
  dashed?: boolean
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="6" aria-hidden>
        <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dashed ? '5 4' : undefined} />
      </svg>
      {children}
    </span>
  )
}

/** Wrapper for a row of <Swatch>es under a chart. */
export function Legend({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">{children}</p>
}

export function ObservedProjectedLegend({
  observedLabel = 'observé',
  projectedLabel = 'projeté',
  until = LAST_OBSERVED_YEAR,
}: {
  observedLabel?: string
  projectedLabel?: string
  until?: number
}) {
  return (
    <Legend>
      <Swatch>
        {observedLabel} (jusqu'à {until})
      </Swatch>
      <Swatch dashed>{projectedLabel}</Swatch>
    </Legend>
  )
}

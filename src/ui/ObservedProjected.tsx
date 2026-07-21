// The observed/projected legend. Pure helpers and the frontier rule live in observed.ts.
import { LAST_OBSERVED_YEAR } from './observed'

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
    <p className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="2" />
        </svg>
        {observedLabel} (jusqu'à {until})
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="20" height="6" aria-hidden>
          <line x1="0" y1="3" x2="20" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" />
        </svg>
        {projectedLabel}
      </span>
    </p>
  )
}

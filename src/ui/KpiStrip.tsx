// Read-the-page-in-5-seconds strip: the four numbers the macro view is really about,
// at the horizon year. Everything comes straight from the projected series — no new
// engine call except the reference run passed in as `baseline` (the same scenario with
// untouched levers), which turns "the curve moved" into "your levers are worth +0,6 pt".
//
// Depuis que choisir une réforme clés en main REMPLACE les leviers de réforme au lieu de s'empiler
// dessus (`applyReform`), ce chiffre décrit la réforme nommée SEULE. Avant, un plafond de pension
// essayé puis oublié restait dans le compte et « impact de vos leviers » ne parlait plus de la
// réforme affichée dans le sélecteur.
import type { TimeSeries } from '../engine/types'
import { fmtBn, fmtNum, fmtPct } from '../lib/format'
import { Skeleton } from '@/components/ui/skeleton'

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'bad'
}) {
  const color = tone === 'bad' ? 'text-destructive' : tone === 'good' ? 'text-success' : ''
  return (
    <div className="bg-card p-3">
      <div className="text-[11px] leading-tight tracking-wide text-muted-foreground uppercase">{label}</div>
      <div className={`mt-1 font-heading text-xl leading-none font-semibold tabular-nums ${color}`}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{sub}</div>}
    </div>
  )
}

export function KpiStrip({
  series,
  baseline,
  changedCount,
  computing,
}: {
  series: TimeSeries
  baseline: TimeSeries
  changedCount: number
  computing: boolean
}) {
  const last = series.at(-1)
  const first = series[0]
  if (!last || !first) return <Skeleton className="h-24" />

  // Same-year comparison: the baseline run uses the same horizon, so both end on it.
  const ref = baseline.at(-1)
  const delta = ref ? (last.soldePctGdp - ref.soldePctGdp) * 100 : 0

  return (
    <div
      className={`grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4 ${computing ? 'opacity-60' : ''}`}
    >
      <Tile
        label={`Solde en ${last.year}`}
        value={`${fmtPct(last.soldePctGdp, 1)} PIB`}
        sub={`${fmtBn(last.balance)} · convention EEC, calé COR`}
        tone={last.balance < 0 ? 'bad' : 'good'}
      />
      <Tile
        label={`Dépenses en ${last.year}`}
        value={`${fmtPct(last.depensesPctGdp, 1)} PIB`}
        sub={`contre ${fmtPct(first.depensesPctGdp, 1)} en ${first.year}`}
      />
      <Tile
        label={`Dépendance en ${last.year}`}
        value={fmtNum(last.dependencyDemographic * 100, 0)}
        sub={`personnes de 65 ans et + pour 100 actifs de 20-64 ans (${fmtNum(first.dependencyDemographic * 100, 0)} en ${first.year})`}
      />
      <Tile
        label="Impact de vos leviers"
        value={changedCount === 0 ? '—' : `${delta >= 0 ? '+' : '−'}${fmtNum(Math.abs(delta), 2)} pt`}
        sub={
          changedCount === 0
            ? 'aucun levier modifié : trajectoire de référence'
            : `sur le solde ${last.year}, contre le même scénario sans réforme`
        }
        tone={changedCount === 0 ? undefined : delta >= 0 ? 'good' : 'bad'}
      />
    </div>
  )
}

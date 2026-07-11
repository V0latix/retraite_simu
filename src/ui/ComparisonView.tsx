import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import corRef from '../data/corReference.json'
import { historical } from '../data/loader'
import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type CorReference, type ScenarioId } from '../data/schema'
import type { PolicyParams } from '../engine/types'
import { useCompare } from '../hooks/useEngine'
import { frontier, LAST_OBSERVED_YEAR, PROJECTED_DASH } from './observed'
import { CHART, SERIES } from './chartColors'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

const cor = corRef as CorReference
const pct1 = (n: number) => `${(n * 100).toFixed(1)} %`

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="gap-0 p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {subtitle && <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="h-64">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </Card>
  )
}

export function ComparisonView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [selected, setSelected] = useState<ScenarioId[]>(['central', 'fertility-low', 'migration-low'])
  // Always project central for the COR validation panel.
  const ids = useMemo(() => Array.from(new Set<ScenarioId>(['central', ...selected])), [selected])
  const { seriesById, computing } = useCompare(ids, policy, 2070, beyondPolicy)

  const toggle = (id: ScenarioId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev))

  // COR validation data: observed solde, then model central solde vs COR reference points.
  const central = seriesById.central ?? []
  type Row = { year: number; observed: number | null; model: number | null; cor: number | null }
  const observed: Row[] = historical.finance.years.flatMap((year, i) => {
    const v = historical.finance.soldePctGdp[i]
    return v == null ? [] : [{ year, observed: +(v * 100).toFixed(2), model: null, cor: null }]
  })
  const validation: Row[] = central
    .filter((r) => r.year % 5 === 0)
    .map((r) => ({ year: r.year, observed: null, model: +(r.soldePctGdp * 100).toFixed(2), cor: null }))
  for (const p of cor.points) {
    const row = validation.find((v) => v.year === p.year)
    if (row) row.cor = +(p.soldePctGdp * 100).toFixed(2)
  }
  const validationWithHistory = [...observed, ...validation]

  // Scenario comparison: solde % PIB per selected scenario, merged by year.
  const years = central.filter((r) => r.year % 2 === 0).map((r) => r.year)
  const comparison = years.map((year) => {
    const row: Record<string, number> = { year }
    for (const id of selected) {
      const s = seriesById[id]?.find((r) => r.year === year)
      if (s) row[id] = +(s.soldePctGdp * 100).toFixed(2)
    }
    return row
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SCENARIO_IDS.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={selected.includes(id) ? 'default' : 'outline'}
            onClick={() => toggle(id)}
          >
            {SCENARIO_LABELS[id]}
          </Button>
        ))}
      </div>

      {computing && central.length === 0 ? (
        <p className="text-sm text-muted-foreground">Calcul…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title="Validation COR — solde (% PIB), scénario central"
            subtitle={`Solde observé jusqu'à ${LAST_OBSERVED_YEAR} (trait plein), puis modèle projeté (pointillés) vs COR. Écart attendu en milieu de période : régime unique agrégé, effectif retraités ≈ 64 ans+ (§13).`}
          >
            <LineChart data={validationWithHistory}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" type="number" domain={['dataMin', 'dataMax']} />
              <YAxis tickFormatter={(v) => `${v}%`} stroke="#888" width={40} />
              <ReferenceLine y={0} stroke="#888" />
              {frontier()}
              <Tooltip formatter={(v) => (v == null ? '—' : `${Number(v).toFixed(2)} % PIB`)} />
              {/* Same hue as the model: one series, two regimes — solid where measured, dashed where projected. */}
              <Line type="monotone" dataKey="observed" name="Observé" stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="model" name="Modèle" stroke={CHART.primary} strokeWidth={2} strokeDasharray={PROJECTED_DASH} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="cor" name="COR" stroke={CHART.danger} strokeWidth={2} strokeDasharray="5 4" connectNulls dot={{ r: 3 }} />
            </LineChart>
          </Panel>

          <Panel
            title="Comparaison de scénarios — solde (% PIB)"
            subtitle="Même politique, démographie INSEE différente (§10). Entièrement projeté : les scénarios ne divergent qu'à partir de l'année de base."
          >
            <LineChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" />
              <YAxis tickFormatter={(v) => `${v}%`} stroke="#888" width={40} />
              <ReferenceLine y={0} stroke="#888" />
              <Tooltip formatter={(v, name) => [`${Number(v).toFixed(2)} %`, SCENARIO_LABELS[name as ScenarioId] ?? name]} />
              {selected.map((id, i) => (
                <Line key={id} type="monotone" dataKey={id} name={id} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </Panel>
        </div>
      )}

      <Card className="gap-2 p-4 text-sm">
        <h3 className="font-medium">Écart modèle − COR (solde, points de PIB)</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {validation
            .filter((v) => v.cor != null)
            .map((v) => (
              <div key={v.year} className="text-center">
                <div className="text-muted-foreground">{v.year}</div>
                <div className="font-semibold tabular-nums">{((v.model ?? 0) - (v.cor ?? 0)).toFixed(1)} pt</div>
              </div>
            ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Base {cor.points[0].year} calée sur COR ; endpoint 2070 proche ({pct1(cor.points.at(-1)!.soldePctGdp)} COR). Le
          creux intermédiaire reflète les simplifications du modèle, pas une donnée.
        </p>
      </Card>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import corRef from '../data/corReference.json'
import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type CorReference, type ScenarioId } from '../data/schema'
import type { PolicyParams } from '../engine/types'
import { useCompare } from '../hooks/useCompare'

const cor = corRef as CorReference
const pct1 = (n: number) => `${(n * 100).toFixed(1)} %`
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ef4444']

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
      {subtitle && <p className="mb-2 text-xs text-neutral-500">{subtitle}</p>}
      <div className="h-64">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}

export function ComparisonView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [selected, setSelected] = useState<ScenarioId[]>(['central', 'fertility-low', 'migration-low'])
  // Always project central for the COR validation panel.
  const ids = useMemo(() => Array.from(new Set<ScenarioId>(['central', ...selected])), [selected])
  const { seriesById, computing } = useCompare(ids, policy, 2070, beyondPolicy)

  const toggle = (id: ScenarioId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev))

  // COR validation data: model central solde vs COR reference points.
  const central = seriesById.central ?? []
  const validation = central
    .filter((r) => r.year % 5 === 0)
    .map((r) => ({
      year: r.year,
      model: +(r.soldePctGdp * 100).toFixed(2),
      cor: null as number | null,
    }))
  for (const p of cor.points) {
    const row = validation.find((v) => v.year === p.year)
    if (row) row.cor = +(p.soldePctGdp * 100).toFixed(2)
  }

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
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={`rounded-full border px-3 py-1 text-sm ${
              selected.includes(id)
                ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
            }`}
          >
            {SCENARIO_LABELS[id]}
          </button>
        ))}
      </div>

      {computing && central.length === 0 ? (
        <p className="text-sm text-neutral-500">Calcul…</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title="Validation COR — solde (% PIB), scénario central"
            subtitle="Modèle vs COR (juin 2025, réf.). Écart attendu en milieu de période : régime unique agrégé, effectif retraités ≈ 64 ans+ (§13)."
          >
            <LineChart data={validation}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" />
              <YAxis tickFormatter={(v) => `${v}%`} stroke="#888" width={40} />
              <ReferenceLine y={0} stroke="#888" />
              <Tooltip formatter={(v) => (v == null ? '—' : `${Number(v).toFixed(2)} % PIB`)} />
              <Line type="monotone" dataKey="model" name="Modèle" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cor" name="COR" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 4" connectNulls dot={{ r: 3 }} />
            </LineChart>
          </Panel>

          <Panel title="Comparaison de scénarios — solde (% PIB)" subtitle="Même politique, démographie INSEE différente (§10).">
            <LineChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" />
              <YAxis tickFormatter={(v) => `${v}%`} stroke="#888" width={40} />
              <ReferenceLine y={0} stroke="#888" />
              <Tooltip formatter={(v, name) => [`${Number(v).toFixed(2)} %`, SCENARIO_LABELS[name as ScenarioId] ?? name]} />
              {selected.map((id, i) => (
                <Line key={id} type="monotone" dataKey={id} name={id} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </Panel>
        </div>
      )}

      <div className="rounded-lg border border-neutral-300 p-4 text-sm dark:border-neutral-700">
        <h3 className="mb-2 font-medium">Écart modèle − COR (solde, points de PIB)</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {validation
            .filter((v) => v.cor != null)
            .map((v) => (
              <div key={v.year} className="text-center">
                <div className="text-neutral-500">{v.year}</div>
                <div className="font-semibold tabular-nums">{(v.model - (v.cor ?? 0)).toFixed(1)} pt</div>
              </div>
            ))}
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Base {cor.points[0].year} calée sur COR ; endpoint 2070 proche ({pct1(cor.points.at(-1)!.soldePctGdp)} COR). Le
          creux intermédiaire reflète les simplifications du modèle, pas une donnée.
        </p>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { historical } from '../data/loader'
import type { BeyondDataPolicy } from '../data/schema'
import type { FanMetric } from '../engine/scenarios/fanchart'
import type { PolicyParams } from '../engine/types'
import { useStochastic } from '../hooks/useEngine'
import { frontier, PROJECTED_DASH } from './observed'
import { ObservedProjectedLegend } from './ObservedProjected'

const METRICS: { id: FanMetric; label: string; fmt: (v: number) => string }[] = [
  { id: 'solde', label: 'Solde (% PIB)', fmt: (v) => `${(v * 100).toFixed(2)} %` },
  { id: 'dependency', label: 'Dépendance système', fmt: (v) => `${(v * 100).toFixed(0)} %` },
  { id: 'share65', label: 'Part des 65 ans et +', fmt: (v) => `${(v * 100).toFixed(0)} %` },
]
const DRAWS = [100, 300, 1000]

/** Observed counterpart of each fan metric: a plain line before the bands begin. */
function observedFor(metric: FanMetric): { year: number; observed: number }[] {
  const { finance, demography } = historical
  const zip = (years: readonly number[], values: readonly (number | null)[], f = (v: number) => v) =>
    years.flatMap((year, i) => (values[i] == null ? [] : [{ year, observed: f(values[i] as number) }]))

  if (metric === 'solde') return zip(finance.years, finance.soldePctGdp)
  // The fan's "dependency" is retirees per contributor — the inverse of what the COR publishes.
  if (metric === 'dependency') return zip(finance.years, finance.activePerRetiree, (v) => 1 / v)
  return zip(demography.share65.years, demography.share65.values)
}

export function StochasticView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [metric, setMetric] = useState<FanMetric>('solde')
  const [draws, setDraws] = useState(300)
  const { fan, computing } = useStochastic(policy, beyondPolicy, draws, 2070, 12345)

  const m = METRICS.find((x) => x.id === metric)!
  const data = useMemo(() => {
    const bands = fan?.[metric] ?? []
    const fanStart = bands[0]?.year ?? Number.POSITIVE_INFINITY
    const before = observedFor(metric).filter((o) => o.year < fanStart)
    // Seed the median at the last observed point so the solid and dashed segments meet.
    const rows = before.map((o, i) => ({
      year: o.year,
      observed: o.observed,
      p50: i === before.length - 1 ? o.observed : null,
      outer: null,
      inner: null,
    }))
    return [
      ...rows,
      ...bands.map((b) => ({
        year: b.year,
        observed: null,
        outer: [b.p5, b.p95] as [number, number],
        inner: [b.p25, b.p75] as [number, number],
        p50: b.p50,
      })),
    ]
  }, [fan, metric])
  const last = data.at(-1)
  const observedCount = data.filter((d) => d.observed != null).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {METRICS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setMetric(x.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                metric === x.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500' : 'border-neutral-300 text-neutral-500 dark:border-neutral-700'
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-500">
          Tirages
          <select
            value={draws}
            onChange={(e) => setDraws(Number(e.target.value))}
            className="rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-700"
          >
            {DRAWS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        {computing && <span className="text-sm text-neutral-500">calcul…</span>}
      </div>

      <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <h3 className="text-sm font-medium text-neutral-500">
          {m.label} — faisceau stochastique (Lee-Carter mortalité + fécondité/migration)
        </h3>
        <p className="mb-2 text-xs text-neutral-500">
          Trait plein : la série réellement observée. Au-delà, bandes p5–p95 et p25–p75, médiane p50 (pointillés) ·{' '}
          {draws} tirages. La médiane suit le central calé ; les volatilités fécondité/migration sont des hypothèses (§6.3).
        </p>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" type="number" domain={['dataMin', 'dataMax']} />
              <YAxis tickFormatter={(v) => m.fmt(v).replace(/\s/g, '')} width={56} stroke="#888" />
              {metric === 'solde' && <ReferenceLine y={0} stroke="#888" />}
              {observedCount > 0 && frontier(data[observedCount - 1].year)}
              <Tooltip formatter={(v) => (Array.isArray(v) ? `${m.fmt(v[0])} … ${m.fmt(v[1])}` : m.fmt(Number(v)))} labelFormatter={(y) => `${y}`} />
              <Area dataKey="outer" stroke="none" fill="#6366f1" fillOpacity={0.15} connectNulls={false} isAnimationActive={false} />
              <Area dataKey="inner" stroke="none" fill="#6366f1" fillOpacity={0.3} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="p50" name="Médiane projetée" stroke="#6366f1" strokeWidth={2} strokeDasharray={PROJECTED_DASH} dot={false} connectNulls={false} isAnimationActive={false} />
              <Line dataKey="observed" name="Observé" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {observedCount > 0 && <ObservedProjectedLegend projectedLabel="médiane projetée" until={data[observedCount - 1].year} />}
        {last?.outer != null && last.p50 != null && (
          <div className="mt-2 text-sm text-neutral-500">
            En {last.year} : médiane <span className="font-semibold text-neutral-800 dark:text-neutral-100">{m.fmt(last.p50)}</span>{' '}
            · intervalle p5–p95 {m.fmt(last.outer[0])} … {m.fmt(last.outer[1])}
          </div>
        )}
      </div>
    </div>
  )
}

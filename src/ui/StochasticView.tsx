import { useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BeyondDataPolicy } from '../data/schema'
import type { FanMetric } from '../engine/scenarios/fanchart'
import type { PolicyParams } from '../engine/types'
import { useStochastic } from '../hooks/useStochastic'

const METRICS: { id: FanMetric; label: string; fmt: (v: number) => string }[] = [
  { id: 'solde', label: 'Solde (% PIB)', fmt: (v) => `${(v * 100).toFixed(2)} %` },
  { id: 'dependency', label: 'Dépendance système', fmt: (v) => `${(v * 100).toFixed(0)} %` },
  { id: 'share65', label: 'Part des 65 ans et +', fmt: (v) => `${(v * 100).toFixed(0)} %` },
]
const DRAWS = [100, 300, 1000]

export function StochasticView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [metric, setMetric] = useState<FanMetric>('solde')
  const [draws, setDraws] = useState(300)
  const { fan, computing } = useStochastic(policy, beyondPolicy, draws, 2070, 12345)

  const m = METRICS.find((x) => x.id === metric)!
  const data = useMemo(
    () =>
      (fan?.[metric] ?? []).map((b) => ({
        year: b.year,
        outer: [b.p5, b.p95] as [number, number],
        inner: [b.p25, b.p75] as [number, number],
        p50: b.p50,
      })),
    [fan, metric],
  )
  const last = data.at(-1)

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
          Bandes p5–p95 et p25–p75, médiane p50 · {draws} tirages. La médiane suit le central calé ;
          les volatilités fécondité/migration sont des hypothèses (§6.3).
        </p>
        <div className="h-80">
          <ResponsiveContainer>
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke="#888" />
              <YAxis tickFormatter={(v) => m.fmt(v).replace(/\s/g, '')} width={56} stroke="#888" />
              {metric === 'solde' && <ReferenceLine y={0} stroke="#888" />}
              <Tooltip formatter={(v) => (Array.isArray(v) ? `${m.fmt(v[0])} … ${m.fmt(v[1])}` : m.fmt(Number(v)))} labelFormatter={(y) => `${y}`} />
              <Area dataKey="outer" stroke="none" fill="#6366f1" fillOpacity={0.15} isAnimationActive={false} />
              <Area dataKey="inner" stroke="none" fill="#6366f1" fillOpacity={0.3} isAnimationActive={false} />
              <Line dataKey="p50" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {last && (
          <div className="mt-2 text-sm text-neutral-500">
            En {last.year} : médiane <span className="font-semibold text-neutral-800 dark:text-neutral-100">{m.fmt(last.p50)}</span>{' '}
            · intervalle p5–p95 {m.fmt(last.outer[0])} … {m.fmt(last.outer[1])}
          </div>
        )}
      </div>
    </div>
  )
}

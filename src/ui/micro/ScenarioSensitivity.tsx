import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { SCENARIO_LABELS, type ScenarioId } from '../../data/schema'
import type { PensionBreakdown } from '../../engine/micro/types'

interface Row {
  scenarioId: ScenarioId
  breakdown: PensionBreakdown
}

// The §5.4 differentiator: same career, one bar per macro scenario.
export function ScenarioSensitivity({ rows, selected }: { rows: Row[]; selected: ScenarioId }) {
  const data = rows.map((r) => ({
    id: r.scenarioId,
    label: SCENARIO_LABELS[r.scenarioId],
    total: Math.round(r.breakdown.total),
    rr: +(r.breakdown.replacementRate * 100).toFixed(1),
  }))

  return (
    <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h3 className="mb-1 text-sm font-medium text-neutral-500">
        Sensibilité au scénario macro — pension annuelle (€), même carrière
      </h3>
      <p className="mb-3 text-xs text-neutral-500">
        Une démographie plus dégradée pèse sur la valeur du point → complémentaire plus faible (§5.4).
      </p>
      <div className="h-64">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" stroke="#888" angle={-30} textAnchor="end" interval={0} fontSize={11} height={60} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} stroke="#888" width={40} />
            <Tooltip
              formatter={(v, name) => (name === 'total' ? [`${Number(v).toLocaleString('fr-FR')} €/an`, 'Pension'] : [v, name])}
            />
            <Bar dataKey="total" isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.id} fill={d.id === selected ? '#6366f1' : '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeries } from '../engine/types'

const bn = (n: number) => `${(n / 1e9).toFixed(0)} Md€`
const pct = (n: number) => `${(n * 100).toFixed(0)}%`

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <h3 className="mb-2 text-sm font-medium text-neutral-500">{title}</h3>
      <div className="h-56">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}

export function MacroCharts({ series }: { series: TimeSeries }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel title="Solde annuel du système">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={bn} width={64} stroke="#888" />
          <ReferenceLine y={0} stroke="#888" />
          <Tooltip formatter={(v) => bn(Number(v))} />
          <Line type="monotone" dataKey="balance" stroke="#ef4444" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel title="Ratio de dépendance (retraités / cotisants)">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={pct} width={48} stroke="#888" />
          <Tooltip formatter={(v) => pct(Number(v))} />
          <Line type="monotone" dataKey="dependencySystem" stroke="#f59e0b" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel title="Cotisants vs retraités">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={48} stroke="#888" />
          <Tooltip formatter={(v) => `${(Number(v) / 1e6).toFixed(1)} M`} />
          <Line type="monotone" dataKey="contributors" name="Cotisants" stroke="#3b82f6" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="retirees" name="Retraités" stroke="#ec4899" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel title="Dette cumulée">
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={bn} width={64} stroke="#888" />
          <Tooltip formatter={(v) => bn(Number(v))} />
          <Line type="monotone" dataKey="cumulativeDebt" stroke="#a855f7" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>
    </div>
  )
}

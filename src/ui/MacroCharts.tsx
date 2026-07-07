import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeries, YearResult } from '../engine/types'

const bn = (n: number) => `${(n / 1e9).toFixed(0)} Md€`
const ratio1 = (n: number) => n.toFixed(1).replace('.', ',')

function Panel({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</h3>
      <p className="mb-2 text-xs leading-snug text-neutral-500">{desc}</p>
      <div className="h-56">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
    </div>
  )
}

// cotisants par retraité — higher is healthier (more actives funding each pension).
const activePerRetiree = (d: YearResult) => (d.retirees > 0 ? d.contributors / d.retirees : 0)

export function MacroCharts({ series }: { series: TimeSeries }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel
        title="Solde annuel du système (% PIB)"
        desc="Cotisations encaissées moins pensions versées, rapportées à la richesse nationale (PIB). Il part de ~0 % en 2025 car le modèle est calé sur le COR, où le système est quasi à l'équilibre ; il se creuse ensuite avec le vieillissement."
      >
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={44} stroke="#888" />
          <ReferenceLine y={0} stroke="#888" />
          <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(2)} % PIB`} />
          <Line type="monotone" dataKey="soldePctGdp" stroke="#ef4444" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel
        title="Nombre de cotisants par retraité"
        desc="Combien d'actifs qui cotisent financent chaque retraité. Plus ce nombre baisse, plus le système est sous tension : chaque pension repose sur moins de cotisants."
      >
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={ratio1} width={40} stroke="#888" domain={[0, 'auto']} />
          <Tooltip formatter={(v) => `${ratio1(Number(v))} cotisant(s) / retraité`} />
          <Line type="monotone" dataKey={activePerRetiree} name="cotisants/retraité" stroke="#f59e0b" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel
        title="Cotisants vs retraités"
        desc="Effectifs en millions : population active occupée qui cotise (bleu) et retraités (rose). L'écart se resserre à mesure que les générations nombreuses partent à la retraite."
      >
        <LineChart data={series}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={48} stroke="#888" />
          <Tooltip formatter={(v) => `${(Number(v) / 1e6).toFixed(1)} M`} />
          <Line type="monotone" dataKey="contributors" name="Cotisants" stroke="#3b82f6" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="retirees" name="Retraités" stroke="#ec4899" dot={false} strokeWidth={2} />
        </LineChart>
      </Panel>

      <Panel
        title="Dette cumulée"
        desc="Somme des soldes annuels accumulés au fil des ans (euros constants). Elle monte tant que le système est en déficit."
      >
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

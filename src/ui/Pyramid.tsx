import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CHART } from './chartColors'

const fmt = (n: number) => `${Math.round(Math.abs(n) / 1000)}k`

export interface PyramidData {
  H: readonly number[]
  F: readonly number[]
  /** True when the pyramid is an INSEE estimate rather than a model projection. */
  observed: boolean
  /** INSEE's champ for that year: "France" from 1991, "France métropolitaine" before. */
  champ?: string
}

export function Pyramid({ H, F, observed, champ }: PyramidData) {
  // Men to the left (negative), women to the right.
  const data = H.map((h, age) => ({ age, H: -h, F: F[age] ?? 0 }))

  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs">
        <span
          className={`border px-1.5 py-0.5 font-medium ${
            observed ? 'border-success text-success' : 'border-primary text-primary'
          }`}
        >
          {observed ? 'observé' : 'projeté'}
        </span>
        <span className="text-muted-foreground">
          {observed ? `INSEE, estimations de population — ${champ}` : 'projection du modèle'}
        </span>
      </div>
      <div className="h-[520px] w-full">
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" stackOffset="sign" barCategoryGap={0}>
            <XAxis type="number" tickFormatter={fmt} stroke="#888" />
            <YAxis type="category" dataKey="age" reversed interval={9} width={32} stroke="#888" />
            <Tooltip
              formatter={(v, name) => [fmt(Number(v)), name === 'H' ? 'Hommes' : 'Femmes']}
              labelFormatter={(a) => `${a} ans`}
            />
            <Bar dataKey="H" stackId="s" fill={CHART.primary} isAnimationActive={false} />
            <Bar dataKey="F" stackId="s" fill={CHART.pink} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

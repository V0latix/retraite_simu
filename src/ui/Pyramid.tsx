import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { YearResult } from '../engine/types'

const fmt = (n: number) => `${Math.round(Math.abs(n) / 1000)}k`

export function Pyramid({ year }: { year: YearResult }) {
  // Men to the left (negative), women to the right.
  const data = year.pyramid.H.map((h, age) => ({
    age,
    H: -h,
    F: year.pyramid.F[age],
  }))

  return (
    <div className="h-[520px] w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" stackOffset="sign" barCategoryGap={0}>
          <XAxis type="number" tickFormatter={fmt} stroke="#888" />
          <YAxis
            type="category"
            dataKey="age"
            reversed
            interval={9}
            width={32}
            stroke="#888"
          />
          <Tooltip
            formatter={(v, name) => [fmt(Number(v)), name === 'H' ? 'Hommes' : 'Femmes']}
            labelFormatter={(a) => `${a} ans`}
          />
          <Bar dataKey="H" stackId="s" fill="#3b82f6" isAnimationActive={false} />
          <Bar dataKey="F" stackId="s" fill="#ec4899" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

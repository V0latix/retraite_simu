import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PensionBreakdown } from '../../engine/micro/types'
import { BASE_YEAR } from '../../data/loader'
import { frontier, mergeObservedProjected, PROJECTED_DASH } from '../observed'
import { ObservedProjectedLegend } from '../ObservedProjected'

const k = (n: number) => `${Math.round(n / 1000).toLocaleString('fr-FR')} k€`
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

function Card({ title, desc, children, footer }: { title: string; desc: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-200">{title}</h3>
      <p className="mb-2 text-xs leading-snug text-neutral-500">{desc}</p>
      <div className="h-60">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
      {footer}
    </div>
  )
}

export function CareerCharts({ b }: { b: PensionBreakdown }) {
  const breakEven = b.total > 0 ? b.totalContributions / b.total : 0
  const lifeExp = b.lifeExpectancyAtRetirement // années de retraite espérées (qx du scénario)
  const paybackYears = Math.max(31, Math.ceil(lifeExp) + 2)
  // Cumulative series: total and (running) employee share. Split at the base year —
  // but nothing here is "observed": even the past years use a salary the user typed.
  // Only the PASS and the contribution rates behind them are historical.
  let cumEmp = 0
  const cumulative = b.contributionsByYear.map((y) => {
    cumEmp += y.employee
    return { year: y.year, cumulative: y.cumulative, cumulEmployee: cumEmp }
  })
  const contribData = mergeObservedProjected(cumulative, cumulative, ['cumulative', 'cumulEmployee'], BASE_YEAR)
  const splitsCareer = cumulative.some((y) => y.year <= BASE_YEAR) && cumulative.some((y) => y.year > BASE_YEAR)
  // Cumulative pension received per year of retirement (constant euros).
  const payback = Array.from({ length: paybackYears + 1 }, (_, y) => ({ year: y, cumulPension: b.total * y }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <div className="text-xs text-neutral-500">Total cotisé (carrière)</div>
          <div className="text-lg font-semibold tabular-nums">{k(b.totalContributions)}</div>
          <div className="text-xs text-neutral-500">employeur + salarié</div>
        </div>
        <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <div className="text-xs text-neutral-500">Dont part salariale</div>
          <div className="text-lg font-semibold tabular-nums">{k(b.employeeContributions)}</div>
          <div className="text-xs text-neutral-500">prélevé sur la fiche de paie</div>
        </div>
        <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
          <div className="text-xs text-neutral-500">Équilibre atteint après</div>
          <div className="text-lg font-semibold tabular-nums">{breakEven.toFixed(0)} ans</div>
          <div className="text-xs text-neutral-500">de retraite (pension = cotisé)</div>
        </div>
      </div>

      <Card
        title="Cotisations retraite cumulées sur la carrière"
        desc={`Somme des cotisations retraite (employeur + salarié) versées année après année, en euros constants. La zone claire isole la part payée directement par le salarié. Le trait devient pointillé après ${BASE_YEAR} : au-delà, la carrière est projetée.`}
        footer={
          splitsCareer ? (
            <>
              <ObservedProjectedLegend observedLabel="carrière passée" projectedLabel="carrière projetée" until={BASE_YEAR} />
              <p className="mt-1 text-[11px] leading-snug text-neutral-500">
                Attention : même avant {BASE_YEAR}, le salaire est celui que vous avez saisi, pas un salaire observé. Seuls le
                PASS et les taux de cotisation sont historiques.
              </p>
            </>
          ) : undefined
        }
      >
        <AreaChart data={contribData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={k} width={56} stroke="#888" />
          {splitsCareer && frontier(BASE_YEAR, 'carrière projetée →')}
          <Tooltip
            formatter={(v, n) => [eur(Number(v)), String(n).includes('cumulEmployee') ? 'Dont part salariale' : 'Cumul total']}
            labelFormatter={(y) => `Année ${y}`}
          />
          <Area type="monotone" dataKey="obs_cumulative" name="Cumul total" stroke="#6366f1" fill="#6366f1" fillOpacity={0.22} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="obs_cumulEmployee" name="Part salariale" stroke="#a5b4fc" fill="#a5b4fc" fillOpacity={0.35} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="proj_cumulative" name="Cumul total" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="proj_cumulEmployee" name="Part salariale" stroke="#a5b4fc" fill="#a5b4fc" fillOpacity={0.18} strokeWidth={1.5} strokeDasharray={PROJECTED_DASH} connectNulls={false} isAnimationActive={false} />
        </AreaChart>
      </Card>

      <Card
        title="Cotisations versées vs pensions perçues"
        desc="Pensions cumulées touchées au fil des années de retraite (bleu) comparées au total cotisé (trait rouge). Le croisement = « équilibre ». ⚠️ Illustratif : le système est par répartition — vos cotisations financent les retraités d'aujourd'hui, ce n'est pas une épargne personnelle."
        footer={
          <p className="mt-1 text-[11px] leading-snug text-neutral-500">
            Ce graphique est entièrement projeté : l'axe compte les années de retraite, toutes à venir.
          </p>
        }
      >
        <LineChart data={payback}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" label={{ value: 'années de retraite', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#888' }} />
          <YAxis tickFormatter={k} width={56} stroke="#888" />
          <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(y) => `${y} ans de retraite`} />
          <ReferenceLine y={b.totalContributions} stroke="#ef4444" strokeDasharray="5 4" label={{ value: 'total cotisé', fontSize: 11, fill: '#ef4444', position: 'insideTopRight' }} />
          <ReferenceLine x={Math.round(breakEven)} stroke="#10b981" label={{ value: `équilibre ${breakEven.toFixed(0)} ans`, fontSize: 11, fill: '#10b981', position: 'top' }} />
          <ReferenceLine x={Math.round(lifeExp)} stroke="#888" strokeDasharray="2 3" label={{ value: `espérance de vie ${lifeExp.toFixed(0)} ans`, fontSize: 10, fill: '#888', position: 'insideBottomRight' }} />
          <Line type="monotone" dataKey="cumulPension" name="Pensions cumulées" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </Card>
    </div>
  )
}

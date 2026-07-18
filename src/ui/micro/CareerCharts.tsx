import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PensionBreakdown } from '../../engine/micro/types'
import { BASE_YEAR } from '../../data/loader'
import { frontier, mergeObservedProjected, PROJECTED_DASH } from '../observed'
import { ObservedProjectedLegend } from '../ObservedProjected'
import { CHART } from '../chartColors'
import { Card as UiCard } from '@/components/ui/card'

const k = (n: number) => `${Math.round(n / 1000).toLocaleString('fr-FR')} k€`
const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

function Card({ title, desc, children, footer }: { title: string; desc: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <UiCard className="gap-0 p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mb-2 text-xs leading-snug text-muted-foreground">{desc}</p>
      <div className="h-60">
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
      {footer}
    </UiCard>
  )
}

export function CareerCharts({ b }: { b: PensionBreakdown }) {
  const breakEven = b.total > 0 ? b.totalContributions / b.total : 0
  const lifeExp = b.lifeExpectancyAtRetirement // années de retraite espérées (qx du scénario)
  const paybackYears = Math.max(31, Math.ceil(lifeExp) + 2)
  const employerTotal = b.totalContributions - b.employeeContributions
  // Dernière année travaillée = référence pour l'illustration brut / net / super-brut,
  // au titre de la retraite seule (le modèle ne connaît pas les autres cotisations).
  const last = b.contributionsByYear[b.contributionsByYear.length - 1]
  const lastEmployer = last.contribution - last.employee
  const brut = last.salary
  const netRetraite = brut - last.employee // brut − cotisation retraite salarié
  const superBrut = brut + lastEmployer // brut + cotisation retraite employeur
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <UiCard className="gap-0 p-3">
          <div className="text-xs text-muted-foreground">Total cotisé (carrière)</div>
          <div className="text-lg font-semibold tabular-nums">{k(b.totalContributions)}</div>
          <div className="text-xs text-muted-foreground">employeur + salarié</div>
        </UiCard>
        <UiCard className="gap-0 p-3">
          <div className="text-xs text-muted-foreground">Dont part salariale</div>
          <div className="text-lg font-semibold tabular-nums">{k(b.employeeContributions)}</div>
          <div className="text-xs text-muted-foreground">prélevé sur la fiche de paie</div>
        </UiCard>
        <UiCard className="gap-0 p-3">
          <div className="text-xs text-muted-foreground">Dont part employeur</div>
          <div className="text-lg font-semibold tabular-nums">{k(employerTotal)}</div>
          <div className="text-xs text-muted-foreground">payé par l'entreprise</div>
        </UiCard>
        <UiCard className="gap-0 p-3">
          <div className="text-xs text-muted-foreground">Équilibre atteint après</div>
          <div className="text-lg font-semibold tabular-nums">{breakEven.toFixed(0)} ans</div>
          <div className="text-xs text-muted-foreground">de retraite (pension = cotisé)</div>
        </UiCard>
      </div>

      <UiCard className="gap-0 p-4">
        <h3 className="text-sm font-medium">Coût du travail vs salaire perçu</h3>
        <p className="mb-3 text-xs leading-snug text-muted-foreground">
          Sur votre dernier salaire ({last.year}), <strong>au titre de la retraite uniquement</strong> — hors santé,
          chômage et CSG, non modélisés ici.
        </p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-lg font-semibold tabular-nums">{eur(superBrut)}</div>
            <div className="text-xs text-muted-foreground">super-brut (coût employeur)</div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums">{eur(brut)}</div>
            <div className="text-xs text-muted-foreground">brut ← saisi</div>
          </div>
          <div>
            <div className="text-lg font-semibold tabular-nums">{eur(netRetraite)}</div>
            <div className="text-xs text-muted-foreground">net de cotisation retraite</div>
          </div>
        </div>
      </UiCard>

      <Card
        title="Cotisations retraite cumulées sur la carrière"
        desc={`Somme des cotisations retraite (employeur + salarié) versées année après année, en euros constants. La zone claire isole la part payée directement par le salarié ; l'écart jusqu'au total est la part employeur. Le trait devient pointillé après ${BASE_YEAR} : au-delà, la carrière est projetée.`}
        footer={
          splitsCareer ? (
            <>
              <ObservedProjectedLegend observedLabel="carrière passée" projectedLabel="carrière projetée" until={BASE_YEAR} />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
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
          <Area type="monotone" dataKey="obs_cumulative" name="Cumul total" stroke={CHART.primary} fill={CHART.primary} fillOpacity={0.22} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="obs_cumulEmployee" name="Part salariale" stroke={CHART.primarySoft} fill={CHART.primarySoft} fillOpacity={0.35} strokeWidth={1.5} connectNulls={false} isAnimationActive={false} />
          <Area type="monotone" dataKey="proj_cumulative" name="Cumul total" stroke={CHART.primary} fill={CHART.primary} fillOpacity={0.1} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          <Area type="monotone" dataKey="proj_cumulEmployee" name="Part salariale" stroke={CHART.primarySoft} fill={CHART.primarySoft} fillOpacity={0.18} strokeWidth={1.5} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
        </AreaChart>
      </Card>

      <Card
        title="Cotisations versées vs pensions perçues"
        desc="Pensions cumulées touchées au fil des années de retraite (bleu) comparées au total cotisé (trait rouge). Le croisement = « équilibre ». ⚠️ Illustratif : le système est par répartition — vos cotisations financent les retraités d'aujourd'hui, ce n'est pas une épargne personnelle."
        footer={
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Ce graphique est entièrement projeté : l'axe compte les années de retraite, toutes à venir.
          </p>
        }
      >
        <LineChart data={payback}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" label={{ value: 'années de retraite', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#888' }} />
          <YAxis tickFormatter={k} width={56} stroke="#888" />
          <Tooltip formatter={(v) => eur(Number(v))} labelFormatter={(y) => `${y} ans de retraite`} />
          <ReferenceLine y={b.totalContributions} stroke={CHART.danger} strokeDasharray="5 4" label={{ value: 'total cotisé', fontSize: 11, fill: CHART.danger, position: 'insideTopRight' }} />
          <ReferenceLine x={Math.round(breakEven)} stroke={CHART.success} label={{ value: `équilibre ${breakEven.toFixed(0)} ans`, fontSize: 11, fill: CHART.success, position: 'top' }} />
          <ReferenceLine x={Math.round(lifeExp)} stroke="#888" strokeDasharray="2 3" label={{ value: `espérance de vie ${lifeExp.toFixed(0)} ans`, fontSize: 10, fill: '#888', position: 'insideBottomRight' }} />
          <Line type="monotone" dataKey="cumulPension" name="Pensions cumulées" stroke={CHART.blue} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </Card>
    </div>
  )
}

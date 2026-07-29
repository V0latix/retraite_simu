import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeries } from '../engine/types'
import { historical } from '../data/loader'
import { jobseekerRate } from '../data/scenarioPresets'
import { frontier, LAST_OBSERVED_YEAR, mergeObservedProjected, PROJECTED_DASH, type Row, toRows } from './observed'
import { Legend, ObservedProjectedLegend, Swatch } from './ObservedProjected'
import { CHART, SERIES } from './chartColors'
import { fmtNum, fmtPct } from '../lib/format'
import { Card } from '@/components/ui/card'

const ratio1 = (n: number) => fmtNum(n, 1)
const ratio2 = (n: number) => fmtNum(n, 2)
const pct = (v: number, d = 2) => `${fmtPct(v, d)} PIB`
const millions = (v: number) => `${fmtNum(v / 1e6, 1)} M`
const signedK = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v / 1000))} 000/an`
const pctPlain = (v: number, d = 1) => fmtPct(v, d)
const eurMonth = (v: number) => `${Math.round(v).toLocaleString('fr-FR')} €/mois`

/** Inscrits France Travail A→G rapportés aux 18-64 ans — l'hypothèse chômage du Pragmatique. */
const JOBSEEKER_RATE = jobseekerRate()

/** Les 7 catégories, dans l'ordre officiel. Couleurs prises dans SERIES, pas réinventées. */
const JOBSEEKER_CATS = [
  ['A', SERIES[0], 'sans activité'],
  ['B', SERIES[1], 'activité réduite ≤ 78 h/mois'],
  ['C', SERIES[2], 'activité réduite > 78 h/mois'],
  ['D', SERIES[3], 'dispensés (formation, maladie)'],
  ['E', SERIES[4], 'dispensés, en emploi'],
  ['F', SERIES[5], 'accompagnement social'],
  ['G', SERIES[6], 'RSA en attente d’orientation'],
] as const

// Shared chart chrome. Repeating these ten times is how axes and tooltips drifted apart;
// the default Recharts tooltip (white, rounded, shadowed) was also the one element left
// contradicting the flat theme.
const GRID = <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
const AXIS = { stroke: CHART.muted, tick: { fontSize: 11 } } as const
const TOOLTIP = {
  contentStyle: { background: '#fff', border: `1px solid ${CHART.ink}`, fontSize: 12, padding: '6px 8px' },
  labelStyle: { fontWeight: 700, color: CHART.ink },
  cursor: { stroke: CHART.muted, strokeWidth: 1 },
} as const

/**
 * One collapsible volet of panels — a dozen charts stacked is a wall, so they read as five
 * stories you open one at a time. Native <details>, like <Hint> in the sidebar: keyboard
 * accessible, zero JS, no state to keep in sync.
 * `count` is passed rather than derived from React.Children: a `wide` panel still counts once,
 * and a conditional child would silently skew the tally.
 */
function Group({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string
  count: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group/vol">
      <summary
        title="Afficher / masquer les graphiques"
        className="mb-3 flex cursor-pointer list-none items-center gap-2 rounded border border-border bg-muted/40 px-2 py-1.5 text-xs font-semibold tracking-wide uppercase select-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="inline-block transition-transform group-open/vol:rotate-90">▸</span>
        {title}
        <span className="ml-auto font-normal normal-case text-muted-foreground tabular-nums">
          {count} graphique{count > 1 ? 's' : ''}
        </span>
        <span className="font-normal normal-case text-muted-foreground">
          · <span className="group-open/vol:hidden">afficher</span>
          <span className="hidden group-open/vol:inline">masquer</span>
        </span>
      </summary>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </details>
  )
}

/**
 * Box-and-whisker drawn as a custom Bar shape — Recharts has no boxplot, and one <g> of lines
 * beats a charting dependency. The Bar's value is the [Q1, Q3] tuple, so `y`/`height` already
 * bracket the box: the pixel scale follows from them and we never touch the axis.
 */
function BoxWhisker({ x = 0, y = 0, width = 0, height = 0, payload }: BoxShapeProps) {
  if (!payload) return null
  const { box, median, low, high } = payload
  const [q1, q3] = box
  // A very low cap can flatten the box (q3 → q1) and kill the scale; fall back to the box line.
  const k = q3 > q1 ? height / (q3 - q1) : 0
  const px = (v: number) => (k === 0 ? y : y + (q3 - v) * k)
  const cx = x + width / 2
  const capW = width * 0.25
  return (
    <g stroke={CHART.violet} strokeWidth={1.5} fill="none">
      <line x1={cx} y1={px(high)} x2={cx} y2={y} />
      <line x1={cx} y1={y + height} x2={cx} y2={px(low)} />
      <line x1={cx - capW} y1={px(high)} x2={cx + capW} y2={px(high)} />
      <line x1={cx - capW} y1={px(low)} x2={cx + capW} y2={px(low)} />
      <rect x={x} y={y} width={width} height={Math.max(height, 1)} fill={CHART.violet} fillOpacity={0.15} />
      <line x1={x} y1={px(median)} x2={x + width} y2={px(median)} strokeWidth={2.5} />
    </g>
  )
}
interface BoxRow {
  year: number
  low: number
  high: number
  median: number
  box: [number, number]
}
// Tout optionnel : Recharts déclare `payload?: any` sur le shape d'une Bar, il faut donc que ce
// type soit un sur-type du sien pour rester assignable sous strictFunctionTypes.
type BoxShapeProps = { x?: number; y?: number; width?: number; height?: number; payload?: BoxRow }

function Panel({
  title,
  desc,
  children,
  footer,
  wide = false,
}: {
  title: string
  desc: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}) {
  return (
    <Card className={`gap-0 p-3${wide ? ' md:col-span-2' : ''}`}>
      <h4 className="font-heading text-sm font-semibold">{title}</h4>
      <p className="mb-2 text-xs leading-snug text-muted-foreground">{desc}</p>
      <div className="h-56" role="img" aria-label={`${title}. ${desc}`}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
      {footer}
    </Card>
  )
}

/** Solid observed line + dashed projected line over one merged dataset. */
function SplitLines({ k, color, name }: { k: string; color: string; name: string }) {
  return (
    <>
      <Line type="monotone" dataKey={`obs_${k}`} name={`${name} (observé)`} stroke={color} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
      <Line type="monotone" dataKey={`proj_${k}`} name={`${name} (projeté)`} stroke={color} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
    </>
  )
}

const CUMUL_FROM = 2002 // first year the COR publishes an observed balance

/**
 * The engine counts retirees as population 64+ and cotisants as occupied actives, which sit at
 * a different LEVEL than COR's administrative headcounts (17.1 M retraités in 2024, incl. those
 * who retired before 64, disability and survivor pensions). The finance block is calibrated to
 * COR separately; the raw counts are not. So the projected headcounts are rebased onto the last
 * observed value — the dashed line continues the observed one by the model's relative evolution
 * instead of jumping to the model's own level. (The COR splices its projections the same way.)
 */
function rebaseFactor(observed: readonly Row[], projected: readonly Row[], key: string): number {
  const oLast = [...observed].reverse().find((r) => r[key] != null)?.[key]
  const pFirst = projected.find((r) => r.year > LAST_OBSERVED_YEAR && r[key] != null)?.[key]
  return oLast != null && pFirst != null && pFirst !== 0 ? (oLast as number) / (pFirst as number) : 1
}

export function MacroCharts({
  series,
  realInterestRate = 0,
  workerExodus = 0,
  frrFlowPct = 0,
  pensionCap = 0,
}: {
  series: TimeSeries
  realInterestRate?: number
  workerExodus?: number
  frrFlowPct?: number
  pensionCap?: number
}) {
  const { finance, anchors, reserves, pensions } = historical

  const data = useMemo(() => {
    const observed = toRows(finance.years, {
      soldePctGdp: finance.soldePctGdp,
      activePerRetiree: finance.activePerRetiree,
      contributors: finance.contributors,
      retirees: finance.retirees,
    })
    const projRaw = series.map((d) => ({ year: d.year, soldePctGdp: d.soldePctGdp, contributors: d.contributors, retirees: d.retirees }))
    const kC = rebaseFactor(observed, projRaw, 'contributors')
    const kR = rebaseFactor(observed, projRaw, 'retirees')
    const projected = projRaw.map((d) => {
      const contributors = d.contributors * kC
      const retirees = d.retirees * kR
      return { year: d.year, soldePctGdp: d.soldePctGdp, contributors, retirees, activePerRetiree: retirees > 0 ? contributors / retirees : null }
    })
    return mergeObservedProjected(observed, projected, ['soldePctGdp', 'activePerRetiree', 'contributors', 'retirees'])
  }, [finance, series])

  // Yearly balances accumulated in euros, then divided by that year's GDP — the way
  // public debt is quoted. (Summing "% of GDP" across years would add ratios with
  // different denominators.) Unlike a counter that resets at the base year, this starts
  // from a dated zero and carries the deficits the system has actually run since 2002.
  //
  // The observed leg is in current euros and the projected one in constant euros; they
  // are spliced at 2024-2025, where the two are within a year of each other.
  const cumul = useMemo(() => {
    let cumulBn = 0 // Md€
    const observed: { year: number; cumul: number | null }[] = []
    finance.years.forEach((year, i) => {
      const solde = finance.soldePctGdp[i]
      const gdp = finance.gdp[i]
      if (solde == null || gdp == null) return observed.push({ year, cumul: null })
      cumulBn += solde * gdp
      observed.push({ year, cumul: Number((cumulBn / gdp).toFixed(5)) })
    })

    // Projected leg: the running cumul snowballs at the chosen real interest rate —
    // debt costs it, reserves earn it. History is left as measured (no rewriting).
    let cumulEur = cumulBn * 1e9
    const projected = series
      .filter((d) => d.year > LAST_OBSERVED_YEAR)
      .map((d) => {
        // FRR endowment (§3.4): reserves added each year (% GDP) lift the cumul (chart uses the
        // positive = reserves convention, opposite sign to the engine's debt cumul).
        cumulEur = cumulEur * (1 + realInterestRate) + d.balance + frrFlowPct * d.gdp
        return { year: d.year, cumul: Number((cumulEur / d.gdp).toFixed(5)) }
      })
    return mergeObservedProjected(observed, projected, ['cumul'])
  }, [finance, series, realInterestRate, frrFlowPct])

  // Fertility: observed ICF (reality) vs the scenario's assumption (series tfr). These
  // are two DIFFERENT series, not one split — the gap at the base year (1,53 observed vs
  // 1,8 assumed) is the whole point, so they are NOT anchored/merged the usual way.
  const fertility = useMemo(() => {
    const f = historical.demography.fertility
    const obs = new Map(f.years.map((y, i) => [y, f.icf[i]]))
    const proj = new Map(series.map((d) => [d.year, Number(d.tfr.toFixed(3))]))
    const years = [...new Set([...obs.keys(), ...proj.keys()])].sort((a, b) => a - b)
    return years.map((year) => ({ year, observed: obs.get(year) ?? null, assumption: proj.get(year) ?? null }))
  }, [series])
  const fertilityNow = historical.demography.fertility.icf.at(-1) ?? 1.53
  const fertilityAssumed = series.find((d) => d.year > LAST_OBSERVED_YEAR)?.tfr ?? 1.8

  // Migration: observed solde migratoire (solid) vs the scenario's assumption, split into TWO
  // dashed curves — immigration (the scenario's inflow) and, only when the Pragmatique risk
  // overlay is on, the youth exodus drawn separately below zero. The engine already nets the
  // exodus out of netMigration, so we add it back to recover the immigration line.
  const migration = useMemo(() => {
    const m = historical.demography.migration
    const obs = new Map(m.years.map((y, i) => [y, m.solde[i]]))
    const proj = new Map(
      series.map((d) => [
        d.year,
        { immigration: Math.round(d.netMigration + workerExodus), exode: workerExodus > 0 ? -workerExodus : null },
      ]),
    )
    const years = [...new Set([...obs.keys(), ...proj.keys()])].sort((a, b) => a - b)
    return years.map((year) => ({
      year,
      observed: obs.get(year) ?? null,
      immigration: proj.get(year)?.immigration ?? null,
      exode: proj.get(year)?.exode ?? null,
    }))
  }, [series, workerExodus])
  const migrationObs = historical.demography.migration
  const migrationNow = migrationObs.solde.at(-1) ?? 176000
  const migrationAssumed = (series.find((d) => d.year > LAST_OBSERVED_YEAR)?.netMigration ?? 70000) + workerExodus
  const migrationFrom = migrationObs.years[0]

  // Unemployment: observed BIT rate vs the scenario's flat assumption (series unemployment).
  // The unemployed are active but don't contribute — they are already removed from cotisants
  // (contributors × (1 − u) in the engine); this panel makes that assumption visible.
  const unemployment = useMemo(() => {
    const un = historical.demography.unemployment
    const obs = new Map(un.years.map((y, i) => [y, un.rate[i]]))
    const proj = new Map(series.map((d) => [d.year, d.unemployment]))
    const years = [...new Set([...obs.keys(), ...proj.keys()])].sort((a, b) => a - b)
    return years.map((year) => ({ year, observed: obs.get(year) ?? null, assumption: proj.get(year) ?? null }))
  }, [series])
  const unemploymentObs = historical.demography.unemployment
  const unemploymentNow = unemploymentObs.rate.at(-1) ?? 0.074
  const unemploymentAssumed = series.find((d) => d.year > LAST_OBSERVED_YEAR)?.unemployment ?? 0.07
  // Même piège que le box plot : une <ReferenceLine> hors domaine est silencieusement ignorée,
  // et l'hypothèse « inscrits A→G » (≈19 %) sort largement du 4-11 % du chômage BIT.
  const unemploymentMax = Math.ceil(Math.max(0.11, unemploymentAssumed, JOBSEEKER_RATE) * 100 + 1) / 100

  // Inscrits à France Travail par catégorie — la mesure large sur laquelle le scénario
  // Pragmatique cale son chômage. Trimestriel et court : F et G datent de janvier 2025.
  const jobseekers = useMemo(() => {
    const j = historical.jobseekers
    return j.periods.map((p, i) => ({ p, A: j.a[i], B: j.b[i], C: j.c[i], D: j.d[i], E: j.e[i], F: j.f[i], G: j.g[i] }))
  }, [])

  // Life expectancy (e0 / e65) derived from the scenario's qx — projection only, no observed
  // series in historical.json. Two very different magnitudes → dual Y axis in the panel below.
  const lifeExp = useMemo(
    () => series.map((d) => ({ year: d.year, e0: Number(d.lifeExpectancyAtBirth.toFixed(1)), e65: Number(d.lifeExpectancyAt65.toFixed(1)) })),
    [series],
  )
  const e0Now = series[0]?.lifeExpectancyAtBirth ?? 0
  const e0End = series.at(-1)?.lifeExpectancyAtBirth ?? 0
  const e65Now = series[0]?.lifeExpectancyAt65 ?? 0
  const e65End = series.at(-1)?.lifeExpectancyAt65 ?? 0

  // Inflation: observed-only (INSEE IPC). No projected leg — the model runs in constant euros
  // and never reads inflation, so there is nothing to overlay. Display context only.
  const inf = historical.economy.inflation
  const inflation = useMemo(() => inf.years.map((year, i) => ({ year, rate: inf.rate[i] })), [inf])
  const inflationFrom = inf.years[0]
  const inflationPeak = Math.max(...inf.rate)

  // Dépenses vs ressources (% PIB): both observed (COR, in historical.finance) and projected
  // (series). Already COR-calibrated → no rebase, unlike the headcounts.
  const depRes = useMemo(() => {
    const observed = toRows(finance.years, { depensesPctGdp: finance.depensesPctGdp, resourcesPctGdp: finance.resourcesPctGdp })
    const projected = series.map((d) => ({ year: d.year, depensesPctGdp: d.depensesPctGdp, resourcesPctGdp: d.resourcesPctGdp }))
    return mergeObservedProjected(observed, projected, ['depensesPctGdp', 'resourcesPctGdp'])
  }, [finance, series])

  // Montants mensuels, euros constants. Comme pour les effectifs, les NIVEAUX diffèrent : le
  // moteur pilote une pension moyenne ancrée sur systemParams et un salaire moyen par cotisant
  // occupé, quand le COR publie des moyennes de champ administratif. On recale donc chaque jambe
  // projetée sur sa dernière valeur observée — la courbe en pointillé prolonge l'observé par
  // l'évolution relative du modèle, jamais par son niveau absolu.
  const montants = useMemo(() => {
    const observed = toRows(pensions.years, {
      pension: pensions.pensionBruteMoyenne,
      salaire: pensions.remuBruteMoyenne,
    })
    const projRaw = series.map((d) => ({ year: d.year, pension: d.avgPension / 12, salaire: d.avgWage / 12 }))
    const kP = rebaseFactor(observed, projRaw, 'pension')
    const kS = rebaseFactor(observed, projRaw, 'salaire')
    const projected = projRaw.map((d) => ({ year: d.year, pension: d.pension * kP, salaire: d.salaire * kS }))
    return mergeObservedProjected(observed, projected, ['pension', 'salaire'])
  }, [pensions, series])

  // Répartition par décile, à quatre horizons témoins pris à intervalles réguliers dans la série
  // (jamais en dur : l'horizon est réglable de 2025 à 2100). Les quartiles sont interpolés entre
  // moyennes de déciles — une approximation, pas des quantiles mesurés ; le `desc` le dit.
  const boxes = useMemo<BoxRow[]>(() => {
    if (series.length === 0) return []
    const idx = [...new Set([0, 1, 2, 3].map((i) => Math.round((i * (series.length - 1)) / 3)))]
    return idx.map((i) => {
      const d = series[i].pensionDeciles
      return {
        year: series[i].year,
        low: d[0],
        high: d[9],
        median: (d[4] + d[5]) / 2,
        box: [(d[1] + d[2]) / 2, (d[6] + d[7]) / 2] as [number, number],
      }
    })
  }, [series])
  // L'axe doit être borné à la main : Recharts ne connaît que la valeur portée par la <Bar>
  // (le couple [Q1, Q3]). Sans ça il cadre sur la boîte — les moustaches débordent hors du
  // graphe, et la ligne de plafond, hors domaine, n'est même pas dessinée.
  const boxMax = Math.max(pensionCap, ...boxes.map((b) => b.high), 0)
  const boxDomain: [number, number] = [0, Math.ceil((boxMax * 1.08) / 500) * 500]

  return (
    <div className="space-y-6">
      <Group title="Trajectoire financière" count={3} defaultOpen>
        <Panel
          wide
          title="Solde annuel du système (% PIB)"
          desc="Cotisations encaissées moins pensions versées, rapportées à la richesse nationale (PIB). Observé par le COR jusqu'en 2024 ; au-delà, c'est notre modèle qui projette. Il se creuse avec le vieillissement."
          footer={
            <>
              <ObservedProjectedLegend />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                Convention <b>EEC</b> (« effort de l'État constant ») : le déficit économiquement pertinent, ≈ −8,7 Md€ dès
                2025 — cohérent avec la Cour des comptes. La convention <b>EPR</b> du rapport COR, qui suppose la fonction
                publique équilibrée par l'État, afficherait ≈ 0 aujourd'hui ; les deux convergent vers −1,4 % en 2070. Les
                deux coïncident sur les années observées, elles ne divergent qu'en projection.
              </p>
            </>
          }
        >
          <LineChart data={data}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            {/* One decimal: the observed balances live within ±0,5 pt, so integer ticks collide. */}
            <YAxis tickFormatter={(v) => `${fmtNum(v * 100, 1)}%`} width={52} {...AXIS} />
            <ReferenceLine y={0} stroke={CHART.muted} />
            {frontier()}
            <Tooltip {...TOOLTIP} formatter={(v) => pct(Number(v))} />
            <SplitLines k="soldePctGdp" color={CHART.danger} name="Solde" />
          </LineChart>
        </Panel>

        <Panel
          wide
          title="Dépenses vs ressources (% PIB)"
          desc="Les deux courbes phares du COR : pensions versées (dépenses) et cotisations + transferts (ressources), en part de la richesse nationale. L'écart entre les deux, c'est le solde. Les dépenses montent avec le vieillissement ; les ressources restent à peu près stables."
          footer={<ObservedProjectedLegend />}
        >
          <LineChart data={depRes}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={44} {...AXIS} domain={['auto', 'auto']} />
            {frontier()}
            <Tooltip {...TOOLTIP} formatter={(v) => pct(Number(v))} />
            <SplitLines k="depensesPctGdp" color={CHART.danger} name="Dépenses" />
            <SplitLines k="resourcesPctGdp" color={CHART.primary} name="Ressources" />
          </LineChart>
        </Panel>

        <Panel
          wide
          title={`Solde cumulé depuis ${CUMUL_FROM} (% PIB)`}
          desc={`Soldes annuels accumulés depuis ${CUMUL_FROM} (premier solde publié par le COR), rapportés au PIB de chaque année — comme on mesure la dette publique. Sous zéro, le système a versé plus qu'il n'a encaissé depuis cette date. En projection, le cumul porte intérêt au taux réel choisi (${fmtNum(realInterestRate * 100, 2)} %) : la dette coûte, les réserves rapportent — l'effet boule de neige du levier « Contexte & risques ».`}
          footer={
            <>
              <ObservedProjectedLegend />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                La ligne violette situe les réserves du système fin 2024 — {anchors.reserves2024.toFixed(0)} Md€, soit{' '}
                {pct(anchors.reservesPctGdp, 1)} (COR, tableau 2.3). L'année où la courbe la franchit est celle où le cumul des
                déficits dépasse ce que le système a mis de côté. À ne pas confondre avec le FRR (fonds de réserve dédié), qui
                se dénoue : {reserves.frr.valueMdEur[0].toFixed(0)} Md€ ({reserves.frr.years[0]}) →{' '}
                {reserves.frr.valueMdEur.at(-1)!.toFixed(0)} Md€ ({reserves.frr.years.at(-1)}), versé à la CADES d'ici 2033.
              </p>
            </>
          }
        >
          <LineChart data={cumul}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={48} {...AXIS} />
            <ReferenceLine y={0} stroke={CHART.muted} />
            <ReferenceLine
              y={-anchors.reservesPctGdp}
              stroke={CHART.violet}
              strokeDasharray="4 3"
              label={{ value: 'réserves fin 2024', position: 'insideBottomRight', fontSize: 10, fill: CHART.violet }}
            />
            {frontier()}
            <Tooltip {...TOOLTIP} formatter={(v) => pct(Number(v))} />
            <SplitLines k="cumul" color={CHART.violet} name="Solde cumulé" />
          </LineChart>
        </Panel>
      </Group>

      <Group title="Démographie du système" count={2}>
        <Panel
          title="Nombre de cotisants par retraité"
          desc="Combien d'actifs qui cotisent financent chaque retraité. Il est passé de ~2,1 en 2002 à ~1,8 aujourd'hui. Plus il baisse, plus chaque pension repose sur peu de cotisants."
          footer={
            <>
              <ObservedProjectedLegend />
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                La projection est recalée sur le dernier point observé : le modèle compte les retraités comme la population de
                64 ans et plus, un peu en dessous du décompte administratif du COR (17,1 M, réversions et départs anticipés
                inclus). On montre donc l'évolution du modèle à partir du niveau réel, pas son niveau absolu.
              </p>
            </>
          }
        >
          <LineChart data={data}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={ratio1} width={40} {...AXIS} domain={[0, 'auto']} />
            {frontier()}
            <Tooltip {...TOOLTIP} formatter={(v) => `${ratio1(Number(v))} cotisant(s) / retraité`} />
            <SplitLines k="activePerRetiree" color={CHART.amber} name="Cotisants/retraité" />
          </LineChart>
        </Panel>

        <Panel
          title="Cotisants vs retraités"
          desc="Effectifs en millions : actifs qui cotisent (bleu) et retraités (rose). L'écart se resserre à mesure que les générations nombreuses partent à la retraite."
          footer={<ObservedProjectedLegend />}
        >
          <LineChart data={data}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={48} {...AXIS} />
            {frontier()}
            <Tooltip {...TOOLTIP} formatter={(v) => millions(Number(v))} />
            <SplitLines k="contributors" color={CHART.blue} name="Cotisants" />
            <SplitLines k="retirees" color={CHART.pink} name="Retraités" />
          </LineChart>
        </Panel>
      </Group>

      <Group title="Niveau des pensions" count={2}>
        <Panel
          wide
          title="Pension moyenne et salaire moyen (€/mois, euros constants)"
          desc="Ce que touche un retraité et ce que gagne un cotisant, en pouvoir d'achat d'aujourd'hui. L'écart entre les deux courbes, c'est le niveau de vie relatif des retraités : le salaire suit la productivité, la pension seulement l'indexation (prix, par défaut) plus l'effet noria — les nouveaux retraités ayant eu de meilleures carrières que ceux qu'ils remplacent. C'est ce décrochage lent qui équilibre le système sans jamais baisser aucune pension. Le curseur « plafonnement » (leviers avancés) écrête cette courbe par le haut."
          footer={<ObservedProjectedLegend />}
        >
          <LineChart data={montants}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${ratio1(Number(v) / 1000)} k€`} width={46} {...AXIS} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} formatter={(v) => eurMonth(Number(v))} />
            {frontier()}
            <SplitLines k="salaire" color={CHART.primary} name="Salaire moyen" />
            <SplitLines k="pension" color={CHART.danger} name="Pension moyenne" />
          </LineChart>
        </Panel>

        <Panel
          wide
          title="Répartition des pensions par décile (€/mois, euros constants)"
          desc={`Comment la pension se répartit entre les retraités, à quatre horizons. La boîte couvre la moitié centrale (du 1ᵉʳ au 3ᵉ quartile), le trait épais est la médiane, les moustaches vont de la moyenne du dixième le plus modeste à celle du dixième le plus aisé. Toute la distribution monte lentement avec l'effet noria — l'écart entre le haut et le bas, lui, ne bouge pas : le modèle applique une forme fixe (DREES) qu'il met à l'échelle. Les quartiles sont interpolés entre moyennes de déciles, ce sont des ordres de grandeur et non des quantiles mesurés.${pensionCap > 0 ? ` Le plafond de ${pensionCap.toLocaleString('fr-FR')} €/mois est en euros constants : il mord de plus en plus à mesure que les pensions dérivent.` : ' Le curseur « plafonnement » (leviers avancés) fait apparaître la ligne d\'écrêtement.'}`}
          footer={
            <Legend>
              <Swatch color={CHART.violet}>
                moustaches = 1ᵉʳ et 10ᵉ décile · boîte = Q1–Q3 · trait épais = médiane
              </Swatch>
              {pensionCap > 0 && <Swatch color={CHART.danger} dashed>plafond ({eurMonth(pensionCap)})</Swatch>}
            </Legend>
          }
        >
          <BarChart data={boxes}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${ratio1(Number(v) / 1000)} k€`} width={46} {...AXIS} domain={boxDomain} allowDataOverflow={false} />
            <Tooltip
              {...TOOLTIP}
              formatter={(_v, _n, item) => {
                const d = item.payload as { low: number; high: number; median: number; box: [number, number] }
                return [`${eurMonth(d.low)} … ${eurMonth(d.high)} · médiane ${eurMonth(d.median)}`, 'D1 → D10']
              }}
              labelFormatter={(y) => `Année ${y}`}
            />
            {pensionCap > 0 && (
              <ReferenceLine
                y={pensionCap}
                stroke={CHART.danger}
                strokeDasharray={PROJECTED_DASH}
                label={{ value: `plafond ${eurMonth(pensionCap)}`, position: 'insideTopRight', fontSize: 10, fill: CHART.danger }}
              />
            )}
            <Bar dataKey="box" shape={BoxWhisker} isAnimationActive={false} />
          </BarChart>
        </Panel>
      </Group>

      <Group title="Hypothèses du scénario — réalité observée vs projection" count={5}>
        <Panel
          title="Fécondité : réalité observée vs hypothèse du scénario"
          desc={`Nombre d'enfants par femme. Le scénario sélectionné retient ${ratio2(fertilityAssumed)} à long terme, alors qu'en ${LAST_OBSERVED_YEAR + 1} la fécondité observée n'est déjà plus que de ${ratio2(fertilityNow)}. Une hypothèse plus haute que la réalité rend les projections (cotisants futurs, solde) optimistes ; le scénario « Pragmatique » colle à la tendance observée.`}
          footer={
            <Legend>
              <Swatch color={CHART.primary}>fécondité observée (INSEE, jusqu'à {LAST_OBSERVED_YEAR + 1})</Swatch>
              <Swatch color={CHART.danger} dashed>
                hypothèse du scénario ({ratio2(fertilityAssumed)})
              </Swatch>
            </Legend>
          }
        >
          <LineChart data={fertility}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={ratio1} width={32} {...AXIS} domain={[1.3, 2.2]} />
            <ReferenceLine
              y={2.1}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'renouvellement (2,1)', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip {...TOOLTIP} formatter={(v) => (v == null ? '—' : `${ratio2(Number(v))} enf./femme`)} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Fécondité observée" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            {/* L'hypothèse affichée est celle du CURSEUR, pas celle de l'INSEE : le libellé de
                l'infobulle disait « Hypothèse INSEE » même à 1,45, une valeur que l'INSEE ne
                retient dans aucune de ses variantes. */}
            <Line type="monotone" dataKey="assumption" name="Hypothèse du scénario" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>

        <Panel
          title="Immigration : solde migratoire observé vs hypothèse du scénario"
          desc={`Solde migratoire (entrées − sorties), en personnes par an. Le scénario retient une immigration de ${signedK(migrationAssumed)}, alors que l'INSEE observe un solde de ${signedK(migrationNow)} en ${LAST_OBSERVED_YEAR + 1}. Une immigration forte ajoute des actifs et soutient le système — l'effet inverse de la fécondité basse. ${workerExodus > 0 ? `Le scénario Pragmatique retire en plus un exode de ${signedK(-workerExodus)} de jeunes actifs (courbe orange) : le solde net est d'autant plus faible.` : ''} Mesure incertaine et révisée par l'INSEE.`}
          footer={
            <Legend>
              <Swatch color={CHART.primary}>
                solde observé (INSEE, {migrationFrom}–{LAST_OBSERVED_YEAR + 1})
              </Swatch>
              <Swatch color={CHART.danger} dashed>
                immigration (hyp. {signedK(migrationAssumed)})
              </Swatch>
              {workerExodus > 0 && (
                <Swatch color={CHART.amber} dashed>
                  exode jeunes actifs ({signedK(-workerExodus)})
                </Swatch>
              )}
            </Legend>
          }
        >
          <LineChart data={migration}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} {...AXIS} domain={[(min: number) => Math.min(0, min), 'auto']} />
            <ReferenceLine
              y={70000}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'repère : INSEE central (+70k)', position: 'insideBottomRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip {...TOOLTIP} formatter={(v) => (v == null ? '—' : signedK(Number(v)))} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Solde observé" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="immigration" name="Immigration (hyp.)" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="exode" name="Exode jeunes actifs" stroke={CHART.amber} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>

        <Panel
          title="Chômage : deux mesures, deux scénarios"
          desc={`Un actif qui ne cotise pas est retiré du nombre de cotisants (× (1 − taux de chômage)). Le scénario sélectionné retient ${pctPlain(unemploymentAssumed)}. Deux thermomètres s'opposent : le chômage au sens du BIT — ${pctPlain(unemploymentNow)} en ${LAST_OBSERVED_YEAR}, celui du COR et de l'INSEE — et le nombre de personnes inscrites à France Travail, toutes catégories A à G, soit ${pctPlain(JOBSEEKER_RATE)} des 18-64 ans, que retient le scénario « Pragmatique ». L'écart n'est pas une erreur de mesure : les deux comptent des gens différents (voir ci-dessous).`}
          footer={
            <>
              <Legend>
                <Swatch color={CHART.primary}>
                  chômage BIT observé (INSEE, {unemploymentObs.years[0]}–{LAST_OBSERVED_YEAR})
                </Swatch>
                <Swatch color={CHART.danger} dashed>
                  hypothèse du scénario ({pctPlain(unemploymentAssumed)})
                </Swatch>
              </Legend>
              <details className="group/exp mt-2">
                <summary className="w-fit cursor-pointer list-none text-xs font-medium text-muted-foreground select-none hover:text-foreground">
                  ⓘ Pourquoi le scénario COR central (7 %) et le Pragmatique ({pctPlain(JOBSEEKER_RATE)}) divergent autant
                </summary>
                <div className="mt-1 space-y-2 text-xs leading-snug text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Le BIT (7 %, scénario central).</strong> Définition
                    internationale, celle du COR et de l'INSEE : être sans aucun emploi, disponible sous deux
                    semaines, et avoir cherché activement dans le mois. Les trois conditions à la fois. C'est un
                    taux bas par construction, et les projections officielles supposent souvent qu'il baisse encore
                    — jusqu'à 4,5 % dans les variantes « plein emploi ».
                  </p>
                  <p>
                    <strong className="text-foreground">Les inscrits à France Travail ({pctPlain(JOBSEEKER_RATE)},
                    Pragmatique).</strong> Un décompte administratif, pas un sondage : toute personne inscrite,
                    quelle que soit sa catégorie. <em>A</em> sans activité, <em>B</em> et <em>C</em> en activité
                    réduite (≤ ou &gt; 78 h/mois), <em>D</em> dispensés de recherche (formation, maladie),
                    <em> E</em> dispensés et en emploi (contrats aidés, créateurs d'entreprise), et depuis janvier
                    2025 <em>F</em> (accompagnement social) et <em>G</em> (allocataires du RSA en attente
                    d'orientation) créées par la loi plein emploi — d'où le saut de série et l'absence d'historique
                    avant 2025.
                  </p>
                  <p>
                    <strong className="text-foreground">D'où vient l'écart.</strong> Quelqu'un qui travaille
                    quelques heures par mois, ou qui suit une formation, est « en emploi » ou « inactif » pour le
                    BIT mais reste inscrit à France Travail. L'inscription automatique des allocataires du RSA
                    ajoute à elle seule plusieurs centaines de milliers de personnes que le BIT ne compte pas,
                    faute de recherche active. Les deux chiffres sont justes ; ils ne répondent pas à la même
                    question.
                  </p>
                  <p>
                    <strong className="text-foreground">La limite de ce choix.</strong> Le modèle traite ce taux
                    comme une part d'actifs qui ne cotisent pas. Or les catégories B, C et E travaillent et
                    cotisent déjà, au moins partiellement. Le Pragmatique est donc une <strong>borne haute</strong>
                    {' '}du sous-emploi, pas une prévision — le dénominateur retenu (les 18-64 ans, plus large que
                    la population active) en amortit une partie.
                  </p>
                </div>
              </details>
            </>
          }
        >
          <LineChart data={unemployment}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} {...AXIS} domain={[0.04, unemploymentMax]} />
            {/* Repère caché quand le scénario est déjà calé dessus (Pragmatique) : le libellé
                se poserait pile sur la courbe d'hypothèse et ne dirait rien de neuf. */}
            {Math.abs(unemploymentAssumed - JOBSEEKER_RATE) > 0.005 && (
              <ReferenceLine
                y={JOBSEEKER_RATE}
                stroke={CHART.muted}
                strokeDasharray="2 3"
                label={{ value: `inscrits France Travail A→G (${pctPlain(JOBSEEKER_RATE)})`, position: 'insideTopRight', fontSize: 10, fill: CHART.muted }}
              />
            )}
            <ReferenceLine
              y={0.045}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'hyp. COR favorable (4,5 %)', position: 'insideBottomRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip {...TOOLTIP} formatter={(v) => (v == null ? '—' : pctPlain(Number(v)))} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Chômage BIT observé" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="assumption" name="Hypothèse chômage" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>

        <Panel
          title="Inscrits à France Travail, par catégorie"
          desc={`Le décompte derrière l'hypothèse du scénario Pragmatique : ${millions(jobseekers.at(-1) ? Object.values(jobseekers.at(-1)!).filter((v) => typeof v === 'number').reduce((s, v) => s + (v as number), 0) : 0)} de personnes inscrites au ${jobseekers.at(-1)?.p ?? ''}, toutes catégories confondues. Effectifs bruts trimestriels (France entière hors Mayotte, Dares–France Travail STMT). La série démarre en 2025T1 : les catégories F et G n'existaient pas avant la loi plein emploi.`}
          footer={
            <Legend>
              {JOBSEEKER_CATS.map(([k, color, label]) => (
                <Swatch key={k} color={color}>
                  {k} — {label}
                </Swatch>
              ))}
            </Legend>
          }
        >
          <BarChart data={jobseekers}>
            {GRID}
            <XAxis dataKey="p" {...AXIS} />
            <YAxis tickFormatter={(v) => `${fmtNum(v / 1e6, 0)} M`} width={40} {...AXIS} />
            <Tooltip {...TOOLTIP} formatter={(v) => millions(Number(v))} labelFormatter={(p) => `Trimestre ${p}`} />
            {JOBSEEKER_CATS.map(([k, color]) => (
              <Bar key={k} dataKey={k} stackId="ft" name={`Catégorie ${k}`} fill={color} isAnimationActive={false} />
            ))}
          </BarChart>
        </Panel>

        <Panel
          title="Espérance de vie (hypothèse du scénario)"
          desc={`Elle grimpe : à la naissance de ${ratio1(e0Now)} à ${ratio1(e0End)} ans, et à 65 ans — la durée de retraite espérée — de ${ratio1(e65Now)} à ${ratio1(e65End)} ans d'ici ${series.at(-1)?.year ?? ''}. C'est le moteur du vieillissement : plus on vit longtemps après 65 ans, plus il y a de retraités par cotisant. Sensible au scénario — basculez sur « EV haute » ou « EV basse » pour voir l'écart. Projection seule (dérivée du qx du scénario).`}
          footer={
            <Legend>
              <Swatch color={CHART.violet} dashed>
                à la naissance (axe gauche)
              </Swatch>
              <Swatch color={CHART.blue} dashed>
                à 65 ans (axe droit)
              </Swatch>
            </Legend>
          }
        >
          <LineChart data={lifeExp}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis yAxisId="e0" tickFormatter={(v) => `${Math.round(v)}`} width={32} {...AXIS} stroke={CHART.violet} domain={['auto', 'auto']} />
            <YAxis yAxisId="e65" orientation="right" tickFormatter={(v) => `${Math.round(v)}`} width={32} {...AXIS} stroke={CHART.blue} domain={['auto', 'auto']} />
            <Tooltip {...TOOLTIP} formatter={(v, n) => [`${ratio1(Number(v))} ans`, String(n)]} labelFormatter={(y) => `Année ${y}`} />
            <Line yAxisId="e0" type="monotone" dataKey="e0" name="À la naissance" stroke={CHART.violet} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} isAnimationActive={false} />
            <Line yAxisId="e65" type="monotone" dataKey="e65" name="À 65 ans" stroke={CHART.blue} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} isAnimationActive={false} />
          </LineChart>
        </Panel>
      </Group>

      <Group title="Contexte" count={1}>
        <Panel
          wide
          title="Inflation observée (INSEE, IPC)"
          desc={`Hausse annuelle des prix à la consommation, de ${inflationFrom} à ${LAST_OBSERVED_YEAR}. Longtemps proche de la cible BCE (2 %), quasi nulle en 2015, puis pic à ${pctPlain(inflationPeak)} en 2022. À titre indicatif : le simulateur n'utilise PAS cette série — tous les calculs (pensions, cotisations, PIB) sont en euros constants, donc l'inflation est neutralisée par construction. Une pension « indexée sur les prix » est plate en euros constants.`}
          footer={
            <Legend>
              <Swatch color={CHART.primary}>
                inflation observée (INSEE, {inflationFrom}–{LAST_OBSERVED_YEAR})
              </Swatch>
              <Swatch color={CHART.muted} dashed>
                cible BCE (2 %)
              </Swatch>
            </Legend>
          }
        >
          <LineChart data={inflation}>
            {GRID}
            <XAxis dataKey="year" {...AXIS} />
            <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={40} {...AXIS} domain={[0, 'auto']} />
            <ReferenceLine
              y={0.02}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'cible BCE (2 %)', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }}
            />
            <Tooltip {...TOOLTIP} formatter={(v) => pctPlain(Number(v))} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="rate" name="Inflation observée" stroke={CHART.primary} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </Panel>
      </Group>
    </div>
  )
}

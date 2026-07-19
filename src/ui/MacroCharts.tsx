import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeries } from '../engine/types'
import { historical } from '../data/loader'
import { frontier, LAST_OBSERVED_YEAR, mergeObservedProjected, PROJECTED_DASH, type Row, toRows } from './observed'
import { ObservedProjectedLegend } from './ObservedProjected'
import { CHART } from './chartColors'
import { Card } from '@/components/ui/card'

const ratio1 = (n: number) => n.toFixed(1).replace('.', ',')
const ratio2 = (n: number) => n.toFixed(2).replace('.', ',')
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d).replace('.', ',')} % PIB`
const millions = (v: number) => `${(v / 1e6).toFixed(1).replace('.', ',')} M`
const signedK = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(Math.round(v / 1000))} 000/an`
const pctPlain = (v: number, d = 1) => `${(v * 100).toFixed(d).replace('.', ',')} %`

function Panel({ title, desc, children, footer }: { title: string; desc: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="gap-0 p-3">
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mb-2 text-xs leading-snug text-muted-foreground">{desc}</p>
      <div className="h-56">
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
}: {
  series: TimeSeries
  realInterestRate?: number
  workerExodus?: number
}) {
  const { finance, anchors } = historical

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
        cumulEur = cumulEur * (1 + realInterestRate) + d.balance
        return { year: d.year, cumul: Number((cumulEur / d.gdp).toFixed(5)) }
      })
    return mergeObservedProjected(observed, projected, ['cumul'])
  }, [finance, series, realInterestRate])

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

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Panel
        title="Solde annuel du système (% PIB)"
        desc="Cotisations encaissées moins pensions versées, rapportées à la richesse nationale (PIB). Observé par le COR jusqu'en 2024 ; au-delà, c'est notre modèle qui projette. Il se creuse avec le vieillissement."
        footer={
          <>
            <ObservedProjectedLegend />
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              Convention <b>EEC</b> (« effort de l'État constant ») : le déficit économiquement pertinent, ≈ −8,7 Md€ dès
              2025 — cohérent avec la Cour des comptes. La convention <b>EPR</b> du rapport COR, qui suppose la fonction
              publique équilibrée par l'État, afficherait ≈ 0 aujourd'hui ; les deux convergent vers −1,4 % en 2070. Les
              deux coïncident sur les années observées, elles ne divergent qu'en projection.
            </p>
          </>
        }
      >
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          {/* One decimal: the observed balances live within ±0,5 pt, so integer ticks collide. */}
          <YAxis tickFormatter={(v) => `${(v * 100).toFixed(1).replace('.', ',')}%`} width={52} stroke="#888" />
          <ReferenceLine y={0} stroke="#888" />
          {frontier()}
          <Tooltip formatter={(v) => pct(Number(v))} />
          <SplitLines k="soldePctGdp" color={CHART.danger} name="Solde" />
        </LineChart>
      </Panel>

      <Panel
        title="Nombre de cotisants par retraité"
        desc="Combien d'actifs qui cotisent financent chaque retraité. Il est passé de ~2,1 en 2002 à ~1,8 aujourd'hui. Plus il baisse, plus chaque pension repose sur peu de cotisants."
        footer={
          <>
            <ObservedProjectedLegend />
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              La projection est recalée sur le dernier point observé : le modèle compte les retraités comme la population de
              64 ans et plus, un peu en dessous du décompte administratif du COR (17,1 M, réversions et départs anticipés
              inclus). On montre donc l'évolution du modèle à partir du niveau réel, pas son niveau absolu.
            </p>
          </>
        }
      >
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={ratio1} width={40} stroke="#888" domain={[0, 'auto']} />
          {frontier()}
          <Tooltip formatter={(v) => `${ratio1(Number(v))} cotisant(s) / retraité`} />
          <SplitLines k="activePerRetiree" color={CHART.amber} name="Cotisants/retraité" />
        </LineChart>
      </Panel>

      <Panel
        title="Cotisants vs retraités"
        desc="Effectifs en millions : actifs qui cotisent (bleu) et retraités (rose). L'écart se resserre à mesure que les générations nombreuses partent à la retraite."
        footer={<ObservedProjectedLegend />}
      >
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} width={48} stroke="#888" />
          {frontier()}
          <Tooltip formatter={(v) => millions(Number(v))} />
          <SplitLines k="contributors" color={CHART.blue} name="Cotisants" />
          <SplitLines k="retirees" color={CHART.pink} name="Retraités" />
        </LineChart>
      </Panel>

      <Panel
        title={`Solde cumulé depuis ${CUMUL_FROM} (% PIB)`}
        desc={`Soldes annuels accumulés depuis ${CUMUL_FROM} (premier solde publié par le COR), rapportés au PIB de chaque année — comme on mesure la dette publique. Sous zéro, le système a versé plus qu'il n'a encaissé depuis cette date. En projection, le cumul porte intérêt au taux réel choisi (${(realInterestRate * 100).toFixed(2).replace('.', ',')} %) : la dette coûte, les réserves rapportent — l'effet boule de neige du levier « Contexte & risques ».`}
        footer={
          <>
            <ObservedProjectedLegend />
            <p className="mt-1 text-[11px] leading-snug text-neutral-500">
              La ligne violette situe les réserves du système fin 2024 — {anchors.reserves2024.toFixed(0)} Md€, soit{' '}
              {pct(anchors.reservesPctGdp, 1)} (COR, tableau 2.3). L'année où la courbe la franchit est celle où le cumul des
              déficits dépasse ce que le système a mis de côté.
            </p>
          </>
        }
      >
        <LineChart data={cumul}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={48} stroke="#888" />
          <ReferenceLine y={0} stroke="#888" />
          <ReferenceLine
            y={-anchors.reservesPctGdp}
            stroke={CHART.violet}
            strokeDasharray="4 3"
            label={{ value: 'réserves fin 2024', position: 'insideBottomRight', fontSize: 10, fill: CHART.violet }}
          />
          {frontier()}
          <Tooltip formatter={(v) => pct(Number(v))} />
          <SplitLines k="cumul" color={CHART.violet} name="Solde cumulé" />
        </LineChart>
      </Panel>

      <div className="md:col-span-2">
        <Panel
          title="Fécondité : réalité observée vs hypothèse du scénario"
          desc={`Nombre d'enfants par femme. Le scénario sélectionné retient ${ratio2(fertilityAssumed)} à long terme, alors qu'en ${LAST_OBSERVED_YEAR + 1} la fécondité observée n'est déjà plus que de ${ratio2(fertilityNow)}. Une hypothèse plus haute que la réalité rend les projections (cotisants futurs, solde) optimistes ; le scénario « Pragmatique » colle à la tendance observée.`}
          footer={
            <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.primary} strokeWidth="2" />
                </svg>
                fécondité observée (INSEE, jusqu'à {LAST_OBSERVED_YEAR + 1})
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.danger} strokeWidth="2" strokeDasharray="5 4" />
                </svg>
                hypothèse du scénario ({ratio2(fertilityAssumed)})
              </span>
            </p>
          }
        >
          <LineChart data={fertility}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="year" stroke="#888" />
            <YAxis tickFormatter={ratio1} width={32} stroke="#888" domain={[1.3, 2.2]} />
            <ReferenceLine
              y={2.1}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'renouvellement des générations (2,1)', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip formatter={(v) => (v == null ? '—' : `${ratio2(Number(v))} enf./femme`)} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Fécondité observée" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="assumption" name="Hypothèse INSEE" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>
      </div>

      <div className="md:col-span-2">
        <Panel
          title="Immigration : solde migratoire observé vs hypothèse du scénario"
          desc={`Solde migratoire (entrées − sorties), en personnes par an. Le scénario retient une immigration de ${signedK(migrationAssumed)}, alors que l'INSEE observe un solde de ${signedK(migrationNow)} en ${LAST_OBSERVED_YEAR + 1}. Une immigration forte ajoute des actifs et soutient le système — l'effet inverse de la fécondité basse. ${workerExodus > 0 ? `Le scénario Pragmatique retire en plus un exode de ${signedK(-workerExodus)} de jeunes actifs (courbe orange) : le solde net est d'autant plus faible.` : ''} Mesure incertaine et révisée par l'INSEE.`}
          footer={
            <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.primary} strokeWidth="2" />
                </svg>
                solde observé (INSEE, {migrationFrom}–{LAST_OBSERVED_YEAR + 1})
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.danger} strokeWidth="2" strokeDasharray="5 4" />
                </svg>
                immigration (hyp. {signedK(migrationAssumed)})
              </span>
              {workerExodus > 0 && (
                <span className="flex items-center gap-1.5">
                  <svg width="20" height="6" aria-hidden>
                    <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.amber} strokeWidth="2" strokeDasharray="5 4" />
                  </svg>
                  exode jeunes actifs ({signedK(-workerExodus)})
                </span>
              )}
            </p>
          }
        >
          <LineChart data={migration}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="year" stroke="#888" />
            <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={40} stroke="#888" domain={[(min: number) => Math.min(0, min), 'auto']} />
            <ReferenceLine
              y={70000}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'hyp. INSEE central (+70k)', position: 'insideBottomRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip formatter={(v) => (v == null ? '—' : signedK(Number(v)))} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Solde observé" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="immigration" name="Immigration (hyp.)" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="exode" name="Exode jeunes actifs" stroke={CHART.amber} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>
      </div>

      <div className="md:col-span-2">
        <Panel
          title="Chômage : taux observé vs hypothèse du scénario"
          desc={`Un chômeur est un actif qui ne cotise pas : il est déjà retiré du nombre de cotisants (× (1 − taux de chômage)). Le scénario sélectionné retient ${pctPlain(unemploymentAssumed)}, alors que le chômage observé (au sens du BIT) a oscillé entre 7 et 10 % ces 25 dernières années — ${pctPlain(unemploymentNow)} en ${LAST_OBSERVED_YEAR}. Le scénario « Pragmatique » colle au dernier niveau observé, quand les projections officielles supposent parfois un retour au plein emploi (4,5 %).`}
          footer={
            <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.primary} strokeWidth="2" />
                </svg>
                chômage observé (INSEE, {unemploymentObs.years[0]}–{LAST_OBSERVED_YEAR})
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="20" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.danger} strokeWidth="2" strokeDasharray="5 4" />
                </svg>
                hypothèse du scénario ({pctPlain(unemploymentAssumed)})
              </span>
            </p>
          }
        >
          <LineChart data={unemployment}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="year" stroke="#888" />
            <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} width={40} stroke="#888" domain={[0.04, 0.11]} />
            <ReferenceLine
              y={0.045}
              stroke={CHART.muted}
              strokeDasharray="2 3"
              label={{ value: 'hyp. COR favorable (4,5 %)', position: 'insideBottomRight', fontSize: 10, fill: CHART.muted }}
            />
            {frontier(LAST_OBSERVED_YEAR + 1)}
            <Tooltip formatter={(v) => (v == null ? '—' : pctPlain(Number(v)))} labelFormatter={(y) => `Année ${y}`} />
            <Line type="monotone" dataKey="observed" name="Chômage observé" stroke={CHART.primary} dot={false} strokeWidth={2} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="assumption" name="Hypothèse chômage" stroke={CHART.danger} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls isAnimationActive={false} />
          </LineChart>
        </Panel>
      </div>

      <div className="md:col-span-2">
      <Panel
        title="Espérance de vie (hypothèse du scénario)"
        desc={`Elle grimpe : à la naissance de ${ratio1(e0Now)} à ${ratio1(e0End)} ans, et à 65 ans — la durée de retraite espérée — de ${ratio1(e65Now)} à ${ratio1(e65End)} ans d'ici ${series.at(-1)?.year ?? ''}. C'est le moteur du vieillissement : plus on vit longtemps après 65 ans, plus il y a de retraités par cotisant. Sensible au scénario — basculez sur « EV haute » ou « EV basse » pour voir l'écart. Projection seule (dérivée du qx du scénario).`}
        footer={
          <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden>
                <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.violet} strokeWidth="2" strokeDasharray="5 4" />
              </svg>
              à la naissance (axe gauche)
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden>
                <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.blue} strokeWidth="2" strokeDasharray="5 4" />
              </svg>
              à 65 ans (axe droit)
            </span>
          </p>
        }
      >
        <LineChart data={lifeExp}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis yAxisId="e0" tickFormatter={(v) => `${Math.round(v)}`} width={32} stroke={CHART.violet} domain={['auto', 'auto']} />
          <YAxis yAxisId="e65" orientation="right" tickFormatter={(v) => `${Math.round(v)}`} width={32} stroke={CHART.blue} domain={['auto', 'auto']} />
          <Tooltip formatter={(v, n) => [`${ratio1(Number(v))} ans`, String(n)]} labelFormatter={(y) => `Année ${y}`} />
          <Line yAxisId="e0" type="monotone" dataKey="e0" name="À la naissance" stroke={CHART.violet} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} isAnimationActive={false} />
          <Line yAxisId="e65" type="monotone" dataKey="e65" name="À 65 ans" stroke={CHART.blue} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} isAnimationActive={false} />
        </LineChart>
      </Panel>
      </div>

      <div className="md:col-span-2">
      <Panel
        title="Dépenses vs ressources (% PIB)"
        desc="Les deux courbes phares du COR : pensions versées (dépenses) et cotisations + transferts (ressources), en part de la richesse nationale. L'écart entre les deux, c'est le solde. Les dépenses montent avec le vieillissement ; les ressources restent à peu près stables."
        footer={<ObservedProjectedLegend />}
      >
        <LineChart data={depRes}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={44} stroke="#888" domain={['auto', 'auto']} />
          {frontier()}
          <Tooltip formatter={(v) => pct(Number(v))} />
          <SplitLines k="depensesPctGdp" color={CHART.danger} name="Dépenses" />
          <SplitLines k="resourcesPctGdp" color={CHART.primary} name="Ressources" />
        </LineChart>
      </Panel>
      </div>

      <div className="md:col-span-2">
      <Panel
        title="Inflation observée (INSEE, IPC)"
        desc={`Hausse annuelle des prix à la consommation, de ${inflationFrom} à ${LAST_OBSERVED_YEAR}. Longtemps proche de la cible BCE (2 %), quasi nulle en 2015, puis pic à ${pctPlain(inflationPeak)} en 2022. À titre indicatif : le simulateur n'utilise PAS cette série — tous les calculs (pensions, cotisations, PIB) sont en euros constants, donc l'inflation est neutralisée par construction. Une pension « indexée sur les prix » est plate en euros constants.`}
        footer={
          <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden>
                <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.primary} strokeWidth="2" />
              </svg>
              inflation observée (INSEE, {inflationFrom}–{LAST_OBSERVED_YEAR})
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="6" aria-hidden>
                <line x1="0" y1="3" x2="20" y2="3" stroke={CHART.muted} strokeWidth="2" strokeDasharray="2 3" />
              </svg>
              cible BCE (2 %)
            </span>
          </p>
        }
      >
        <LineChart data={inflation}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} width={40} stroke="#888" domain={[0, 'auto']} />
          <ReferenceLine
            y={0.02}
            stroke={CHART.muted}
            strokeDasharray="2 3"
            label={{ value: 'cible BCE (2 %)', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }}
          />
          <Tooltip formatter={(v) => pctPlain(Number(v))} labelFormatter={(y) => `Année ${y}`} />
          <Line type="monotone" dataKey="rate" name="Inflation observée" stroke={CHART.primary} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </Panel>
      </div>
    </div>
  )
}

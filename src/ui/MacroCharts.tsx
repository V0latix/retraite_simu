import { useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TimeSeries } from '../engine/types'
import { historical } from '../data/loader'
import { frontier, LAST_OBSERVED_YEAR, mergeObservedProjected, PROJECTED_DASH, type Row, toRows } from './observed'
import { ObservedProjectedLegend } from './ObservedProjected'
import { CHART } from './chartColors'
import { Card } from '@/components/ui/card'

const ratio1 = (n: number) => n.toFixed(1).replace('.', ',')
const pct = (v: number, d = 2) => `${(v * 100).toFixed(d).replace('.', ',')} % PIB`
const millions = (v: number) => `${(v / 1e6).toFixed(1).replace('.', ',')} M`

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
      <Line type="monotone" dataKey={`proj_${k}`} name={`${name} (projeté)`} stroke={color} dot={false} strokeWidth={2} strokeDasharray={PROJECTED_DASH} connectNulls={false} isAnimationActive={false} />
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

export function MacroCharts({ series }: { series: TimeSeries }) {
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

    let cumulEur = cumulBn * 1e9
    const projected = series
      .filter((d) => d.year > LAST_OBSERVED_YEAR)
      .map((d) => {
        cumulEur += d.balance
        return { year: d.year, cumul: Number((cumulEur / d.gdp).toFixed(5)) }
      })
    return mergeObservedProjected(observed, projected, ['cumul'])
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
        desc={`Soldes annuels accumulés depuis ${CUMUL_FROM} (premier solde publié par le COR), rapportés au PIB de chaque année — comme on mesure la dette publique. Sous zéro, le système a versé plus qu'il n'a encaissé depuis cette date.`}
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
    </div>
  )
}

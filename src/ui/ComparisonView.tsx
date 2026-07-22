import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import corRef from '../data/corReference.json'
import { historical, referenceIndicators } from '../data/loader'
import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type CorReference, type ScenarioId } from '../data/schema'
import type { PolicyParams } from '../engine/types'
import { useCompare } from '../hooks/useEngine'
import { fmtNum, fmtPct, fmtPctRaw } from '../lib/format'
import { frontier, LAST_OBSERVED_YEAR, PROJECTED_DASH } from './observed'
import { InternationalComparison } from './InternationalComparison'
import { CHART, SERIES } from './chartColors'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const cor = corRef as CorReference

function Panel({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <Card className="gap-0 p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {subtitle && <p className="mb-2 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="h-64" role="img" aria-label={subtitle ? `${title}. ${subtitle}` : title}>
        <ResponsiveContainer>{children as React.ReactElement}</ResponsiveContainer>
      </div>
      {footer}
    </Card>
  )
}

export function ComparisonView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [selected, setSelected] = useState<ScenarioId[]>(['central', 'fertility-low', 'migration-low'])
  // Always project central for the COR validation panel.
  const ids = useMemo(() => Array.from(new Set<ScenarioId>(['central', ...selected])), [selected])
  const { seriesById, computing } = useCompare(ids, policy, 2070, beyondPolicy)

  const toggle = (id: ScenarioId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 5 ? [...prev, id] : prev))

  // COR validation data: observed solde, then model central solde vs COR reference points.
  const central = seriesById.central ?? []
  type Row = { year: number; observed: number | null; model: number | null; cor: number | null }
  const observed: Row[] = historical.finance.years.flatMap((year, i) => {
    const v = historical.finance.soldePctGdp[i]
    return v == null ? [] : [{ year, observed: +(v * 100).toFixed(2), model: null, cor: null }]
  })
  const validation: Row[] = central
    .filter((r) => r.year % 5 === 0)
    .map((r) => ({ year: r.year, observed: null, model: +(r.soldePctGdp * 100).toFixed(2), cor: null }))
  for (const p of cor.points) {
    const row = validation.find((v) => v.year === p.year)
    if (row) row.cor = +(p.soldePctGdp * 100).toFixed(2)
  }
  const validationWithHistory = [...observed, ...validation]

  // Niveau de vie relatif des retraités (DREES observé + projection COR). Reference/context —
  // the engine does not model it. Observed solid, projected dashed, joined at 2022.
  const nvr = referenceIndicators.niveauDeVieRelatif
  const nvrYears = Array.from(new Set([...nvr.observed, ...nvr.projected].map((p) => p.year))).sort((a, b) => a - b)
  const nvrData = nvrYears.map((year) => ({
    year,
    obs: nvr.observed.find((p) => p.year === year)?.value ?? null,
    proj: nvr.projected.find((p) => p.year === year)?.value ?? null,
  }))

  // Scenario comparison: solde % PIB per selected scenario, merged by year.
  const years = central.filter((r) => r.year % 2 === 0).map((r) => r.year)
  const comparison = years.map((year) => {
    const row: Record<string, number> = { year }
    for (const id of selected) {
      const s = seriesById[id]?.find((r) => r.year === year)
      if (s) row[id] = +(s.soldePctGdp * 100).toFixed(2)
    }
    return row
  })

  return (
    <div className="space-y-6">
      <Card className="gap-1 p-4 text-sm">
        <h2 className="text-base font-semibold">Comparer les scénarios démographiques</h2>
        <p className="text-muted-foreground">
          À politique identique, chaque scénario INSEE change une hypothèse (fécondité, espérance de vie, migration) et fait
          diverger le solde du système. Le graphe de gauche valide le modèle contre les points du COR ; celui de droite
          superpose les scénarios que vous sélectionnez ci-dessous (jusqu'à 5).
        </p>
      </Card>

      <div className="flex flex-wrap gap-2">
        {SCENARIO_IDS.map((id) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={selected.includes(id) ? 'default' : 'outline'}
            onClick={() => toggle(id)}
          >
            {SCENARIO_LABELS[id]}
          </Button>
        ))}
      </div>

      {computing && central.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Calcul en cours">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Panel
            title="Validation COR — solde (% PIB), scénario central"
            subtitle={`Solde observé jusqu'à ${LAST_OBSERVED_YEAR} (trait plein), puis modèle projeté (pointillés) vs COR. Écart attendu en milieu de période : régime unique agrégé, effectif retraités ≈ 64 ans+ (§13).`}
          >
            <LineChart data={validationWithHistory}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke={CHART.muted} type="number" domain={['dataMin', 'dataMax']} />
              <YAxis tickFormatter={(v) => `${v}%`} stroke={CHART.muted} width={40} />
              <ReferenceLine y={0} stroke={CHART.muted} />
              {frontier()}
              <Tooltip formatter={(v) => (v == null ? '—' : `${fmtPctRaw(Number(v), 2)} PIB`)} />
              {/* Same hue as the model: one series, two regimes — solid where measured, dashed where projected. */}
              <Line type="monotone" dataKey="observed" name="Observé" stroke={CHART.primary} strokeWidth={2} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="model" name="Modèle" stroke={CHART.primary} strokeWidth={2} strokeDasharray={PROJECTED_DASH} dot={false} connectNulls={false} />
              <Line type="monotone" dataKey="cor" name="COR" stroke={CHART.danger} strokeWidth={2} strokeDasharray="5 4" connectNulls dot={{ r: 3 }} />
            </LineChart>
          </Panel>

          <Panel
            title="Comparaison de scénarios — solde (% PIB)"
            subtitle="Même politique, démographie INSEE différente (§10). Entièrement projeté : les scénarios ne divergent qu'à partir de l'année de base."
            footer={
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {selected.map((id, i) => (
                  <span key={id} className="flex items-center gap-1.5">
                    <svg width="20" height="6" aria-hidden>
                      <line x1="0" y1="3" x2="20" y2="3" stroke={SERIES[i % SERIES.length]} strokeWidth="2" />
                    </svg>
                    {SCENARIO_LABELS[id]}
                  </span>
                ))}
              </p>
            }
          >
            <LineChart data={comparison}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="year" stroke={CHART.muted} />
              <YAxis tickFormatter={(v) => `${v}%`} stroke={CHART.muted} width={40} />
              <ReferenceLine y={0} stroke={CHART.muted} />
              <Tooltip formatter={(v, name) => [fmtPctRaw(Number(v), 2), SCENARIO_LABELS[name as ScenarioId] ?? name]} />
              {selected.map((id, i) => (
                <Line key={id} type="monotone" dataKey={id} name={id} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </Panel>
        </div>
      )}

      <Card className="gap-2 p-4 text-sm">
        <h3 className="font-medium">Écart modèle − COR (solde, points de PIB)</h3>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {validation
            .filter((v) => v.cor != null)
            .map((v) => (
              <div key={v.year} className="text-center">
                <div className="text-muted-foreground">{v.year}</div>
                <div className="font-semibold tabular-nums">{fmtNum((v.model ?? 0) - (v.cor ?? 0), 1)} pt</div>
              </div>
            ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Base {cor.points[0].year} calée sur COR ; endpoint 2070 proche ({fmtPct(cor.points.at(-1)!.soldePctGdp)} COR). Le
          creux intermédiaire reflète les simplifications du modèle, pas une donnée.
        </p>
      </Card>

      <Panel
        title="Niveau de vie relatif des retraités — repère DREES / COR (non modélisé)"
        subtitle={`Niveau de vie médian des retraités rapporté à l'ensemble de la population. Observé DREES (trait plein) jusqu'en 2022 ≈ parité, puis projection COR (pointillés) : ${fmtPctRaw(nvr.projected[0].value * 100, 1)} en 2022 → ${fmtPctRaw(nvr.projected.at(-1)!.value * 100, 1)} en 2070 (pensions indexées sur les prix, salaires sur la productivité). Série de contexte : le moteur ne la calcule pas.`}
        footer={
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Taux de remplacement moyen à la liquidation ≈ {fmtPctRaw(referenceIndicators.tauxRemplacementMoyen.value2024 * 100, 0)}{' '}
            (COR 2024), en baisse de génération en génération — comparable aux cas-types de l'onglet « Ma pension ».
          </p>
        }
      >
        <LineChart data={nvrData}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="year" stroke={CHART.muted} type="number" domain={['dataMin', 'dataMax']} />
          <YAxis tickFormatter={(v) => `${Math.round(v * 100)}%`} stroke={CHART.muted} width={44} domain={[0.8, 1.1]} />
          <ReferenceLine y={1} stroke={CHART.muted} label={{ value: 'parité', position: 'insideTopRight', fontSize: 10, fill: CHART.muted }} />
          {frontier(2022, 'projection COR →')}
          <Tooltip formatter={(v) => (v == null ? '—' : fmtPctRaw(Number(v) * 100, 1))} />
          <Line type="monotone" dataKey="obs" name="Observé (DREES)" stroke={CHART.primary} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
          <Line type="monotone" dataKey="proj" name="Projeté (COR)" stroke={CHART.primary} strokeWidth={2} strokeDasharray={PROJECTED_DASH} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </Panel>

      <InternationalComparison />
    </div>
  )
}

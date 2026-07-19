import { useEffect, useMemo, useState } from 'react'
import { BASE_YEAR, historicalPyramid } from './data/loader'
import { PRAGMATIQUE_RISK } from './data/pragmatique'
import type { BeyondDataPolicy, ScenarioId } from './data/schema'
import type { PolicyParams } from './engine/types'
import { useProjection } from './hooks/useEngine'
import { type View, decodeState, downloadCsv, encodeState, seriesToCsv } from './lib/share'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComparisonView } from './ui/ComparisonView'
import { Levers } from './ui/Levers'
import { MacroCharts } from './ui/MacroCharts'
import { Pyramid } from './ui/Pyramid'
import { StochasticView } from './ui/StochasticView'
import { MicroView } from './ui/micro/MicroView'

const TAB_LABELS: Record<View, string> = {
  macro: 'Vue macro',
  micro: 'Vue micro (ma pension)',
  comparaison: 'Comparaison scénarios',
  stochastique: 'Aléatoire',
}

const bn = (n: number) => `${(n / 1e9).toFixed(1)} Md€`

// Observed pyramids start at the birth of the régime général (ordonnances d'octobre 1945).
const PYRAMID_FROM = historicalPyramid.years[0]
const PYRAMID_LAST_OBSERVED = historicalPyramid.years[historicalPyramid.years.length - 1]

const sumAges = (H: number[], F: number[], lo: number, hi: number) => {
  let s = 0
  for (let a = lo; a <= hi && a < H.length; a++) s += H[a] + F[a]
  return s
}

const init = decodeState(new URLSearchParams(window.location.search))

function App() {
  const [view, setView] = useState<View>(init.view)
  const [scenarioId, setScenarioId] = useState<ScenarioId>(init.scenarioId)
  const [beyondPolicy, setBeyondPolicy] = useState<BeyondDataPolicy>(init.beyondPolicy)
  const [policy, setPolicy] = useState<PolicyParams>(init.policy)
  const [horizon, setHorizon] = useState(init.horizon)
  const [year, setYear] = useState(BASE_YEAR)

  // Sync the whole app state into the URL (shareable/reproducible), no re-render.
  useEffect(() => {
    const qs = encodeState({ view, scenarioId, beyondPolicy, horizon, policy })
    window.history.replaceState(null, '', `?${qs}`)
  }, [view, scenarioId, beyondPolicy, horizon, policy])

  const { series, computing } = useProjection(scenarioId, policy, horizon, beyondPolicy)

  const current = useMemo(
    () => series.find((r) => r.year === year) ?? series[0],
    [series, year],
  )
  const last = series[series.length - 1]

  // Up to 2025 the pyramid is measured (INSEE); beyond, the engine projects it.
  const pyramid = useMemo(() => {
    const i = historicalPyramid.years.indexOf(year)
    if (i >= 0) {
      const { H, F } = { H: historicalPyramid.H[i], F: historicalPyramid.F[i] }
      return {
        H,
        F,
        observed: true,
        champ: historicalPyramid.champ[String(year)],
        dependency: sumAges(H, F, 65, 200) / sumAges(H, F, 20, 64),
      }
    }
    if (!current) return null
    return {
      H: current.pyramid.H,
      F: current.pyramid.F,
      observed: false,
      dependency: current.dependencyDemographic,
    }
  }, [year, current])

  const setP = (p: Partial<PolicyParams>) => setPolicy((prev) => ({ ...prev, ...p }))

  // Exode & intérêt sur la dette ne jouent QUE dans le Pragmatique : changer de scénario
  // (ré)applique le défaut du scénario — Pragmatique les allume, tout autre les remet à 0,
  // laissant les scénarios INSEE/COR figés sur la référence.
  const onScenario = (id: ScenarioId) => {
    setScenarioId(id)
    setPolicy((prev) => ({
      ...prev,
      ...(id === 'pragmatique' ? PRAGMATIQUE_RISK : { realInterestRate: 0, workerExodus: 0 }),
    }))
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-foreground">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Simulateur de retraite — France</h1>
        <p className="text-sm text-muted-foreground">
          Modèle macro + micro sur données INSEE (Projections 2021-2070), finance
          calée COR.
        </p>
      </header>

      <Card className="mb-6 gap-1 p-4 text-sm">
        <div className="font-semibold">Qu'est-ce que le COR ?</div>
        <p className="text-muted-foreground">
          Le <b>Conseil d'orientation des retraites</b> est l'organisme public qui, depuis 2000, projette
          l'équilibre du système de retraite français et publie chaque année le rapport de référence. Ce
          simulateur cale ses trajectoires financières sur le rapport COR de juin 2025.{' '}
          <a
            href="https://fr.wikipedia.org/wiki/Conseil_d%27orientation_des_retraites"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2"
          >
            En savoir plus (Wikipédia)
          </a>
        </p>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-6">
        {/* Each tab is styled as a discrete bordered button (same visual language as the
            scenario toggles), so it clearly reads as clickable; active = solid primary.
            Single scrollable row — the 4 French labels never fit at 375px, so scroll
            rather than wrap. `!` overrides beat the trigger's baked-in active styles. */}
        <TabsList className="!h-auto w-full max-w-full justify-start gap-1.5 overflow-x-auto border-0 bg-transparent p-0">
          {(['macro', 'micro', 'comparaison', 'stochastique'] as const).map((v) => (
            <TabsTrigger
              key={v}
              value={v}
              className="flex-none shrink-0 border border-border! bg-card px-3 py-1.5 font-medium text-foreground/70 hover:text-foreground data-active:border-primary! data-active:bg-primary! data-active:text-primary-foreground!"
            >
              {TAB_LABELS[v]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {view === 'micro' && <MicroView policy={policy} beyondPolicy={beyondPolicy} />}
      {view === 'comparaison' && <ComparisonView policy={policy} beyondPolicy={beyondPolicy} />}
      {view === 'stochastique' && <StochasticView policy={policy} beyondPolicy={beyondPolicy} />}

      {view === 'macro' && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Levers
            scenarioId={scenarioId}
            beyondPolicy={beyondPolicy}
            policy={policy}
            horizon={horizon}
            onScenario={onScenario}
            onBeyond={setBeyondPolicy}
            onPolicy={setP}
            onHorizon={setHorizon}
          />
          {last && (
            <Card className="gap-1 p-4 text-sm">
              <div className="text-muted-foreground">Solde en {last.year}</div>
              <div className={`text-xl font-semibold ${last.balance < 0 ? 'text-destructive' : 'text-success'}`}>
                {(last.soldePctGdp * 100).toFixed(1)} % PIB
              </div>
              <div className="text-xs text-muted-foreground">{bn(last.balance)} · calé COR</div>
            </Card>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
          >
            Copier le lien (scénario + leviers)
          </Button>
        </aside>

        <main className="min-w-0 space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pyramide des âges — {year}</h2>
              <span className="text-sm text-muted-foreground">
                {computing ? 'calcul…' : `dép. démographique ${pyramid ? (pyramid.dependency * 100).toFixed(0) : '–'}%`}
              </span>
            </div>
            <Slider
              min={PYRAMID_FROM}
              max={horizon}
              value={[year]}
              onValueChange={([v]) => setYear(v)}
              className="my-2"
            />
            <div className="mb-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{PYRAMID_FROM} — création du régime général</span>
              <span>{PYRAMID_LAST_OBSERVED} — fin des données observées</span>
              <span>{horizon}</span>
            </div>
            {pyramid && <Pyramid {...pyramid} />}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Trajectoires financières</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={series.length === 0}
                onClick={() => downloadCsv(`retraite-${scenarioId}.csv`, seriesToCsv(series))}
              >
                Exporter CSV
              </Button>
            </div>
            {series.length > 0 && (
              <MacroCharts series={series} realInterestRate={policy.realInterestRate} workerExodus={policy.workerExodus} />
            )}
          </section>
        </main>
      </div>
      )}
    </div>
  )
}

export default App

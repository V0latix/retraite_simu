import { useEffect, useMemo, useState } from 'react'
import { BASE_YEAR, DEFAULT_POLICY, historicalPyramid } from './data/loader'
import { REFORM_PRESETS } from './data/reforms'
import { SCENARIO_PRESETS } from './data/scenarioPresets'
import type { ScenarioId } from './data/schema'
import type { PolicyParams } from './engine/types'
import { useProjection } from './hooks/useEngine'
import { type View, countChangedLevers, decodeState, downloadCsv, encodeState, seriesToCsv } from './lib/share'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ComparisonView } from './ui/ComparisonView'
import { KpiStrip } from './ui/KpiStrip'
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

// Observed pyramids start at the birth of the régime général (ordonnances d'octobre 1945).
const PYRAMID_FROM = historicalPyramid.years[0]
const PYRAMID_LAST_OBSERVED = historicalPyramid.years[historicalPyramid.years.length - 1]

const sumAges = (H: number[], F: number[], lo: number, hi: number) => {
  let s = 0
  for (let a = lo; a <= hi && a < H.length; a++) s += H[a] + F[a]
  return s
}

const init = decodeState(new URLSearchParams(window.location.search))

/** Section header — small caps over a hard rule, same language as the sidebar cards. */
function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-2">
      <h2 className="text-sm font-semibold tracking-wide uppercase">{children}</h2>
      {aside}
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>(init.view)
  const [scenarioId, setScenarioId] = useState<ScenarioId>(init.scenarioId)
  const [policy, setPolicy] = useState<PolicyParams>(init.policy)
  const [reformKey, setReformKey] = useState(init.reformKey)
  const [horizon, setHorizon] = useState(init.horizon)
  const [year, setYear] = useState(BASE_YEAR)
  const [copied, setCopied] = useState(false)

  // Sync the whole app state into the URL (shareable/reproducible), no re-render.
  useEffect(() => {
    const qs = encodeState({ view, scenarioId, horizon, policy, reformKey })
    window.history.replaceState(null, '', `?${qs}`)
  }, [view, scenarioId, horizon, policy, reformKey])

  const { series, computing } = useProjection(scenarioId, policy, horizon)

  // The scenario's own preset, untouched — the reference the user's edits are priced against
  // ("+0,6 pt de PIB"). One extra worker; the engine and the main run are untouched.
  const basePolicy = useMemo<PolicyParams>(
    () => ({ ...DEFAULT_POLICY, ...SCENARIO_PRESETS[scenarioId] }),
    [scenarioId],
  )
  const { series: baseline } = useProjection(scenarioId, basePolicy, horizon)
  const changedCount = countChangedLevers(policy, basePolicy)

  const current = useMemo(
    () => series.find((r) => r.year === year) ?? series[0],
    [series, year],
  )

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

  // Manual slider edit detaches from the selected reform (empty sentinel), like MicroView's setC.
  // Le calendrier ne saute QUE si l'utilisateur bouge un curseur d'âge ou de durée : ce sont les
  // deux seuls champs qu'il pilote, et le garder les avalerait silencieusement. Bouger la
  // productivité ou l'indexation ne doit pas effacer la montée en charge de la réforme 2023.
  const setP = (p: Partial<PolicyParams>) => {
    setReformKey('')
    const breaksCalendar = p.legalAge !== undefined || p.requiredQuarters !== undefined
    setPolicy((prev) => ({ ...prev, ...p, ...(breaksCalendar ? { schedule: undefined } : {}) }))
  }

  // Selecting a turnkey reform applies its PolicyParams delta in one go (same merge channel),
  // plus its phase-in calendar when it has one (a law, as opposed to a debate proposal).
  const onReform = (key: string) => {
    const preset = REFORM_PRESETS[key]
    if (!preset) return
    setReformKey(key)
    setPolicy((prev) => ({ ...prev, ...preset.delta, schedule: preset.schedule }))
  }

  // Un scénario = un jeu de positions de curseurs : le choisir les déplace sous les yeux de
  // l'utilisateur (fécondité, migration, productivité, chômage + risques macro), qui peut
  // ensuite en bouger un. Les leviers de réforme déjà réglés sont conservés.
  const onScenario = (id: ScenarioId) => {
    setScenarioId(id)
    setPolicy((prev) => ({ ...prev, ...SCENARIO_PRESETS[id] }))
  }

  // Back to the scenario's own reference trajectory (same baseline the delta is measured against).
  const onReset = () => {
    setReformKey('')
    setPolicy(basePolicy)
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

      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)} className="mb-6">
        {/* Each tab is styled as a discrete bordered button (same visual language as the
            scenario toggles), so it clearly reads as clickable; active = solid primary.
            The four tabs wrap onto a second row on narrow screens (`flex-wrap`). `!`
            overrides beat the trigger's baked-in active styles. */}
        <TabsList className="!h-auto w-full max-w-full flex-wrap justify-start gap-1.5 border-0 bg-transparent p-0">
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

      {view === 'micro' && <MicroView policy={policy} />}
      {view === 'comparaison' && <ComparisonView policy={policy} />}
      {view === 'stochastique' && <StochasticView policy={policy} />}

      {view === 'macro' && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* `self-start` is what makes `sticky` work here: without it the grid item is
            stretched to the row height and never scrolls past its own container. */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <Levers
            scenarioId={scenarioId}
            policy={policy}
            horizon={horizon}
            reformKey={reformKey}
            changedCount={changedCount}
            onScenario={onScenario}
            onPolicy={setP}
            onReform={onReform}
            onHorizon={setHorizon}
            onReset={onReset}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? 'Copié !' : 'Copier le lien (scénario + leviers)'}
          </Button>
        </aside>

        <main className="min-w-0 space-y-6">
          <KpiStrip series={series} baseline={baseline} changedCount={changedCount} computing={computing} />

          <section>
            <SectionTitle
              aside={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={series.length === 0}
                  onClick={() => downloadCsv(`retraite-${scenarioId}.csv`, seriesToCsv(series))}
                >
                  Exporter CSV
                </Button>
              }
            >
              Trajectoires financières
            </SectionTitle>
            {series.length > 0 ? (
              <div className={computing ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                <MacroCharts
                  series={series}
                  realInterestRate={policy.realInterestRate}
                  workerExodus={policy.workerExodus}
                  frrFlowPct={policy.frrFlowPct}
                  pensionCap={policy.pensionCap}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
                <Skeleton className="h-72 md:col-span-2" />
              </div>
            )}
          </section>

          <section>
            <SectionTitle
              aside={
                <span className="text-xs text-muted-foreground tabular-nums">
                  {computing ? 'Calcul…' : `${pyramid ? (pyramid.dependency * 100).toFixed(0) : '–'} pour 100 actifs`}
                </span>
              }
            >
              Pyramide des âges — {year} {pyramid?.observed ? '(observée)' : '(projetée)'}
            </SectionTitle>
            <Slider
              min={PYRAMID_FROM}
              max={horizon}
              value={[year]}
              onValueChange={([v]) => setYear(v)}
              aria-label="Année de la pyramide des âges"
              className="my-2"
            />
            <div className="mb-3 flex justify-between text-[11px] text-muted-foreground">
              <span>{PYRAMID_FROM} — création du régime général</span>
              <span>observé jusqu'à {PYRAMID_LAST_OBSERVED}, projeté ensuite</span>
              <span>{horizon}</span>
            </div>
            {pyramid && <Pyramid {...pyramid} />}
          </section>

          <Card className="gap-1 p-4 text-sm">
            <details>
              <summary className="cursor-pointer font-semibold select-none">Qu'est-ce que le COR ?</summary>
              <p className="mt-2 text-muted-foreground">
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
            </details>
          </Card>
        </main>
      </div>
      )}
    </div>
  )
}

export default App

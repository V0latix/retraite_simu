import { useMemo, useState } from 'react'
import { BASE_YEAR, DEFAULT_POLICY, historicalPyramid } from './data/loader'
import type { BeyondDataPolicy, ScenarioId } from './data/schema'
import type { PolicyParams } from './engine/types'
import { useProjection } from './hooks/useProjection'
import { Levers } from './ui/Levers'
import { MacroCharts } from './ui/MacroCharts'
import { Pyramid } from './ui/Pyramid'
import { MicroView } from './ui/micro/MicroView'
import { ComparisonView } from './ui/ComparisonView'
import { StochasticView } from './ui/StochasticView'

const bn = (n: number) => `${(n / 1e9).toFixed(1)} Md€`

// Observed pyramids start at the birth of the régime général (ordonnances d'octobre 1945).
const PYRAMID_FROM = historicalPyramid.years[0]
const PYRAMID_LAST_OBSERVED = historicalPyramid.years[historicalPyramid.years.length - 1]

const sumAges = (H: number[], F: number[], lo: number, hi: number) => {
  let s = 0
  for (let a = lo; a <= hi && a < H.length; a++) s += H[a] + F[a]
  return s
}

function App() {
  const [view, setView] = useState<'macro' | 'micro' | 'comparison' | 'stochastic'>('macro')
  const [scenarioId, setScenarioId] = useState<ScenarioId>('central')
  const [beyondPolicy, setBeyondPolicy] = useState<BeyondDataPolicy>('hold')
  const [policy, setPolicy] = useState<PolicyParams>(DEFAULT_POLICY)
  const [horizon, setHorizon] = useState(2070)
  const [year, setYear] = useState(BASE_YEAR)

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-neutral-800 dark:text-neutral-100">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Simulateur de retraite — France</h1>
        <p className="text-sm text-neutral-500">
          Modèle macro + micro sur données INSEE (Projections 2021-2070), finance
          calée COR ; mode stochastique Lee-Carter.
        </p>
      </header>

      <div className="mb-6 flex gap-1 border-b border-neutral-300 dark:border-neutral-700">
        {(['macro', 'micro', 'comparison', 'stochastic'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              view === v
                ? 'border-indigo-500 text-indigo-500'
                : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            {v === 'macro'
              ? 'Vue macro'
              : v === 'micro'
                ? 'Vue micro (ma pension)'
                : v === 'comparison'
                  ? 'Validation & comparaison'
                  : 'Aléa (fan chart)'}
          </button>
        ))}
      </div>

      {view === 'micro' && <MicroView policy={policy} beyondPolicy={beyondPolicy} />}
      {view === 'comparison' && <ComparisonView policy={policy} beyondPolicy={beyondPolicy} />}
      {view === 'stochastic' && <StochasticView policy={policy} beyondPolicy={beyondPolicy} />}

      {view === 'macro' && (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Levers
            scenarioId={scenarioId}
            beyondPolicy={beyondPolicy}
            policy={policy}
            horizon={horizon}
            onScenario={setScenarioId}
            onBeyond={setBeyondPolicy}
            onPolicy={setP}
            onHorizon={setHorizon}
          />
          {last && (
            <div className="rounded-lg border border-neutral-300 p-4 text-sm dark:border-neutral-700">
              <div className="text-neutral-500">Solde en {last.year}</div>
              <div className={`text-xl font-semibold ${last.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {(last.soldePctGdp * 100).toFixed(1)} % PIB
              </div>
              <div className="text-xs text-neutral-500">{bn(last.balance)} · calé COR</div>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pyramide des âges — {year}</h2>
              <span className="text-sm text-neutral-500">
                {computing ? 'calcul…' : `dép. démographique ${pyramid ? (pyramid.dependency * 100).toFixed(0) : '–'}%`}
              </span>
            </div>
            <input
              type="range"
              min={PYRAMID_FROM}
              max={horizon}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="mb-2 flex justify-between text-[11px] text-neutral-500">
              <span>{PYRAMID_FROM} — création du régime général</span>
              <span>{PYRAMID_LAST_OBSERVED} — fin des données observées</span>
              <span>{horizon}</span>
            </div>
            {pyramid && <Pyramid {...pyramid} />}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Trajectoires financières</h2>
            {series.length > 0 && <MacroCharts series={series} />}
          </section>
        </main>
      </div>
      )}
    </div>
  )
}

export default App

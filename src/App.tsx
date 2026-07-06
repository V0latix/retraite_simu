import { useMemo, useState } from 'react'
import { BASE_YEAR, DEFAULT_POLICY } from './data/loader'
import type { BeyondDataPolicy, ScenarioId } from './data/schema'
import type { PolicyParams } from './engine/types'
import { useProjection } from './hooks/useProjection'
import { Levers } from './ui/Levers'
import { MacroCharts } from './ui/MacroCharts'
import { Pyramid } from './ui/Pyramid'

const bn = (n: number) => `${(n / 1e9).toFixed(1)} Md€`

function App() {
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

  const setP = (p: Partial<PolicyParams>) => setPolicy((prev) => ({ ...prev, ...p }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-neutral-800 dark:text-neutral-100">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Simulateur de retraite — France</h1>
        <p className="text-sm text-neutral-500">
          Modèle macro couplé (démographie → économie → système). Démographie
          sur données INSEE (Projections 2021-2070) ; calage COR à venir (Phase 4).
        </p>
      </header>

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
                {bn(last.balance)}
              </div>
            </div>
          )}
        </aside>

        <main className="min-w-0 space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pyramide des âges — {year}</h2>
              <span className="text-sm text-neutral-500">
                {computing ? 'calcul…' : `dép. démographique ${current ? (current.dependencyDemographic * 100).toFixed(0) : '–'}%`}
              </span>
            </div>
            <input
              type="range"
              min={BASE_YEAR}
              max={horizon}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mb-2 w-full accent-indigo-500"
            />
            {current && <Pyramid year={current} />}
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Trajectoires financières</h2>
            {series.length > 0 && <MacroCharts series={series} />}
          </section>
        </main>
      </div>
    </div>
  )
}

export default App

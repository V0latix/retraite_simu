import { useMemo, useState } from 'react'
import { DEFAULT_POLICY } from './data/seed'
import type { PolicyParams } from './engine/types'
import { useProjection } from './hooks/useProjection'
import { Levers } from './ui/Levers'
import { MacroCharts } from './ui/MacroCharts'
import { Pyramid } from './ui/Pyramid'

const bn = (n: number) => `${(n / 1e9).toFixed(1)} Md€`

function App() {
  const [policy, setPolicy] = useState<PolicyParams>(DEFAULT_POLICY)
  const [horizon, setHorizon] = useState(2070)
  const [year, setYear] = useState(2025)

  const { series, computing } = useProjection(policy, horizon)

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
          Modèle macro couplé (démographie → économie → système). Données seed —
          calage COR à venir (Phase 4).
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Levers policy={policy} horizon={horizon} onPolicy={setP} onHorizon={setHorizon} />
          {last && (
            <div className="rounded-lg border border-neutral-300 p-4 text-sm dark:border-neutral-700">
              <div className="text-neutral-500">Solde en {last.year}</div>
              <div className={`text-xl font-semibold ${last.balance < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                {bn(last.balance)}
              </div>
            </div>
          )}
        </aside>

        <main className="space-y-6">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Pyramide des âges — {year}</h2>
              <span className="text-sm text-neutral-500">
                {computing ? 'calcul…' : `dép. démographique ${current ? (current.dependencyDemographic * 100).toFixed(0) : '–'}%`}
              </span>
            </div>
            <input
              type="range"
              min={2025}
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

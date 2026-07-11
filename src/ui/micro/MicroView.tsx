import { useMemo, useState } from 'react'
import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type ScenarioId } from '../../data/schema'
import { PRESETS } from '../../engine/micro/career'
import type { CareerParams } from '../../engine/micro/types'
import type { PolicyParams } from '../../engine/types'
import { useMicro } from '../../hooks/useEngine'
import { CareerCharts } from './CareerCharts'
import { CareerForm } from './CareerForm'
import { PensionResult } from './PensionResult'
import { ScenarioSensitivity } from './ScenarioSensitivity'

export function MicroView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [career, setCareer] = useState<CareerParams>(PRESETS.median)
  const [scenarioId, setScenarioId] = useState<ScenarioId>('central')

  const { perScenario, computing } = useMicro(career, policy, beyondPolicy)
  const selected = useMemo(() => perScenario.find((r) => r.scenarioId === scenarioId), [perScenario, scenarioId])

  const setC = (p: Partial<CareerParams>) => setCareer((prev) => ({ ...prev, ...p }))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <CareerForm params={career} onChange={setC} onPreset={(k) => setCareer(PRESETS[k])} />
        <label className="block rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">Scénario détaillé</span>
          <select
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value as ScenarioId)}
            className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
          >
            {SCENARIO_IDS.map((id) => (
              <option key={id} value={id}>
                {SCENARIO_LABELS[id]}
              </option>
            ))}
          </select>
        </label>
      </aside>

      <main className="min-w-0 space-y-6">
        {computing && perScenario.length === 0 ? (
          <p className="text-sm text-neutral-500">Calcul…</p>
        ) : (
          <>
            {selected && <PensionResult b={selected.breakdown} scenarioLabel={SCENARIO_LABELS[scenarioId]} />}
            {selected && <CareerCharts b={selected.breakdown} />}
            {perScenario.length > 0 && <ScenarioSensitivity rows={perScenario} selected={scenarioId} />}
          </>
        )}
      </main>
    </div>
  )
}

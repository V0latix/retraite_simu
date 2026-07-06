import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type ScenarioId } from '../data/schema'
import type { Indexation, PolicyParams } from '../engine/types'

interface Props {
  scenarioId: ScenarioId
  beyondPolicy: BeyondDataPolicy
  policy: PolicyParams
  horizon: number
  onScenario: (id: ScenarioId) => void
  onBeyond: (b: BeyondDataPolicy) => void
  onPolicy: (p: Partial<PolicyParams>) => void
  onHorizon: (h: number) => void
}

const BEYOND_LABELS: Record<BeyondDataPolicy, string> = {
  hold: 'Geler (hold)',
  trend: 'Prolonger la tendance (trend)',
  converge: 'Converger (converge)',
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  fmt,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  fmt: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm">
        <span className="text-neutral-500">{label}</span>
        <span className="font-medium tabular-nums">{fmt(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
    </label>
  )
}

export function Levers({
  scenarioId,
  beyondPolicy,
  policy,
  horizon,
  onScenario,
  onBeyond,
  onPolicy,
  onHorizon,
}: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <label className="block">
        <span className="text-sm text-neutral-500">Scénario INSEE</span>
        <select
          value={scenarioId}
          onChange={(e) => onScenario(e.target.value as ScenarioId)}
          className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        >
          {SCENARIO_IDS.map((id) => (
            <option key={id} value={id}>
              {SCENARIO_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      <h2 className="text-lg font-semibold">Leviers de réforme</h2>
      <Slider
        label="Âge légal de départ"
        value={policy.legalAge}
        min={60}
        max={70}
        fmt={(v) => `${v} ans`}
        onChange={(v) => onPolicy({ legalAge: v })}
      />
      <Slider
        label="Durée requise"
        value={policy.requiredQuarters}
        min={160}
        max={188}
        fmt={(v) => `${v} trim.`}
        onChange={(v) => onPolicy({ requiredQuarters: v })}
      />
      <Slider
        label="Taux de cotisation"
        value={policy.contributionRate}
        min={0.2}
        max={0.4}
        step={0.005}
        fmt={(v) => `${(v * 100).toFixed(1)}%`}
        onChange={(v) => onPolicy({ contributionRate: v })}
      />
      <label className="block">
        <span className="text-sm text-neutral-500">Règle d'indexation</span>
        <select
          value={policy.indexation}
          onChange={(e) => onPolicy({ indexation: e.target.value as Indexation })}
          className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        >
          <option value="prices">Prix</option>
          <option value="wages">Salaires</option>
          <option value="mix">Mixte</option>
        </select>
      </label>
      <Slider
        label="Horizon"
        value={horizon}
        min={2030}
        max={2100}
        fmt={(v) => String(v)}
        onChange={onHorizon}
      />
      <label className="block">
        <span className="text-sm text-neutral-500">Extrapolation après 2070</span>
        <select
          value={beyondPolicy}
          onChange={(e) => onBeyond(e.target.value as BeyondDataPolicy)}
          className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        >
          {(Object.keys(BEYOND_LABELS) as BeyondDataPolicy[]).map((b) => (
            <option key={b} value={b}>
              {BEYOND_LABELS[b]}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

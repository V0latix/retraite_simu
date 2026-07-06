import { PRESETS } from '../../engine/micro/career'
import type { CareerParams, Status } from '../../engine/micro/types'

interface Props {
  params: CareerParams
  onChange: (p: Partial<CareerParams>) => void
  onPreset: (key: string) => void
}

function Field({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-500">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border border-neutral-300 bg-transparent p-2 tabular-nums dark:border-neutral-700"
        />
        {suffix && <span className="text-sm text-neutral-500">{suffix}</span>}
      </div>
    </label>
  )
}

export function CareerForm({ params, onChange, onPreset }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="text-lg font-semibold">Carrière</h2>

      <label className="block">
        <span className="text-sm text-neutral-500">Cas-type</span>
        <select
          onChange={(e) => onPreset(e.target.value)}
          defaultValue=""
          className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        >
          <option value="" disabled>
            Choisir un préréglage…
          </option>
          {Object.keys(PRESETS).map((k) => (
            <option key={k} value={k}>
              {k === 'smic' ? 'SMIC' : k === 'median' ? 'Salaire médian' : 'Cadre'}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Année de naissance" value={params.birthYear} min={1955} max={2005} onChange={(v) => onChange({ birthYear: v })} />
        <Field label="Début de carrière" value={params.startYear} min={1970} max={2030} onChange={(v) => onChange({ startYear: v })} />
        <Field label="Salaire de départ" value={params.startSalary} min={15000} max={200000} step={1000} suffix="€/an" onChange={(v) => onChange({ startSalary: v })} />
        <Field label="Croissance réelle" value={+(params.annualGrowth * 100).toFixed(1)} min={0} max={5} step={0.1} suffix="%/an" onChange={(v) => onChange({ annualGrowth: v / 100 })} />
        <Field label="Âge de départ" value={params.retirementAge} min={60} max={70} suffix="ans" onChange={(v) => onChange({ retirementAge: v })} />
        <Field label="Temps de travail" value={Math.round(params.partTimeFactor * 100)} min={40} max={100} step={5} suffix="%" onChange={(v) => onChange({ partTimeFactor: v / 100 })} />
      </div>

      <label className="block">
        <span className="text-sm text-neutral-500">Statut</span>
        <select
          value={params.status}
          onChange={(e) => onChange({ status: e.target.value as Status })}
          className="mt-1 w-full rounded border border-neutral-300 bg-transparent p-2 dark:border-neutral-700"
        >
          <option value="non-cadre">Non-cadre</option>
          <option value="cadre">Cadre</option>
        </select>
      </label>
      <p className="text-xs text-neutral-500">Montants en euros constants (réels). Barèmes indicatifs — cf. CLAUDE.md.</p>
    </div>
  )
}

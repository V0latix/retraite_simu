import { useState } from 'react'
import { PRESETS } from '../../engine/micro/career'
import type { CareerParams, Status } from '../../engine/micro/types'
import { clamp } from '../../lib/clamp'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  params: CareerParams
  preset: string
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
  // While editing, keep the raw string so the field can be emptied/typed freely;
  // `null` means "show the controlled value". Clamp + commit on blur, never a silent 0.
  const [raw, setRaw] = useState<string | null>(null)
  const display = raw ?? String(value)
  const parsed = Number(display)
  const outOfBounds = display !== '' && !Number.isNaN(parsed) && (parsed < min || parsed > max)

  const commit = () => {
    const clamped = display === '' || Number.isNaN(parsed) ? value : clamp(parsed, min, max)
    onChange(clamped)
    setRaw(null)
  }

  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={display}
          onChange={(e) => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          aria-invalid={outOfBounds}
          className="tabular-nums"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {outOfBounds && (
        <span className="mt-0.5 block text-xs text-destructive">
          entre {min} et {max}
        </span>
      )}
    </label>
  )
}

export function CareerForm({ params, preset, onChange, onPreset }: Props) {
  return (
    <Card className="gap-4 p-4">
      <h2 className="text-lg font-semibold">Carrière</h2>

      <label className="block">
        <span className="text-sm text-muted-foreground">Cas-type</span>
        <Select value={preset} onValueChange={onPreset}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue placeholder="Choisir un préréglage…" />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(PRESETS).map((k) => (
              <SelectItem key={k} value={k}>
                {k === 'smic' ? 'SMIC' : k === 'median' ? 'Salaire médian' : 'Cadre'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
        <span className="text-sm text-muted-foreground">Statut</span>
        <Select value={params.status} onValueChange={(v) => onChange({ status: v as Status })}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="non-cadre">Non-cadre</SelectItem>
            <SelectItem value="cadre">Cadre</SelectItem>
          </SelectContent>
        </Select>
      </label>
    </Card>
  )
}

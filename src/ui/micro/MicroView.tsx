import { useMemo, useState } from 'react'
import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type ScenarioId } from '../../data/schema'
import { PRESETS } from '../../engine/micro/career'
import type { CareerParams } from '../../engine/micro/types'
import type { PolicyParams } from '../../engine/types'
import { useMicro } from '../../hooks/useEngine'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CareerCharts } from './CareerCharts'
import { CareerForm } from './CareerForm'
import { PensionResult } from './PensionResult'
import { ScenarioSensitivity } from './ScenarioSensitivity'

export function MicroView({ policy, beyondPolicy }: { policy: PolicyParams; beyondPolicy: BeyondDataPolicy }) {
  const [career, setCareer] = useState<CareerParams>(PRESETS.median)
  const [preset, setPreset] = useState('median')
  const [scenarioId, setScenarioId] = useState<ScenarioId>('central')

  const { perScenario, computing } = useMicro(career, policy, beyondPolicy)
  const selected = useMemo(() => perScenario.find((r) => r.scenarioId === scenarioId), [perScenario, scenarioId])

  // Editing any field detaches from the preset, so the dropdown stops claiming one.
  const setC = (p: Partial<CareerParams>) => {
    setPreset('')
    setCareer((prev) => ({ ...prev, ...p }))
  }
  const onPreset = (k: string) => {
    setPreset(k)
    setCareer(PRESETS[k])
  }

  return (
    <div className="space-y-6">
    <Card className="gap-1 p-4 text-sm">
      <h2 className="text-base font-semibold">Votre pension, estimée dans un scénario</h2>
      <p className="text-muted-foreground">
        Décrivez une carrière (à gauche) : le simulateur calcule la pension qui en résulterait — régime général (base) +
        AGIRC-ARRCO (complémentaire) — <strong>à l'intérieur</strong> du scénario macro choisi, qui fixe la démographie et la
        valeur du point. Quelques repères : le <strong>SAM</strong> est le salaire moyen de vos 25 meilleures années ; le{' '}
        <strong>PASS</strong> le plafond annuel de la Sécurité sociale ; la <strong>décote</strong> minore la pension quand il
        manque des <strong>trimestres</strong>. Les termes soulignés en pointillé sont définis au survol.
      </p>
    </Card>
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <CareerForm params={career} preset={preset} onChange={setC} onPreset={onPreset} />
        <Card className="gap-1 p-4">
          <span className="text-sm text-muted-foreground">Scénario détaillé</span>
          <Select value={scenarioId} onValueChange={(v) => setScenarioId(v as ScenarioId)}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCENARIO_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {SCENARIO_LABELS[id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>
      </aside>

      <main className="min-w-0 space-y-6">
        {computing && perScenario.length === 0 ? (
          <div className="space-y-4" aria-busy="true" aria-label="Calcul en cours">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-60" />
          </div>
        ) : (
          <>
            {selected && <PensionResult b={selected.breakdown} scenarioLabel={SCENARIO_LABELS[scenarioId]} />}
            {selected && <CareerCharts b={selected.breakdown} />}
            {perScenario.length > 0 && <ScenarioSensitivity rows={perScenario} selected={scenarioId} />}
          </>
        )}
      </main>
    </div>
    </div>
  )
}

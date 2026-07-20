import { useState } from 'react'
import type { PensionBreakdown } from '../../engine/micro/types'
import { CHART } from '../chartColors'
import { BASE_YEAR } from '../../data/loader'
import { Card } from '@/components/ui/card'
import { Slider as UiSlider } from '@/components/ui/slider'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const mo = (n: number) => `${Math.round(n / 12).toLocaleString('fr-FR')} €/mois`

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-0 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </Card>
  )
}

export function PensionResult({ b, scenarioLabel }: { b: PensionBreakdown; scenarioLabel: string }) {
  const rgPct = b.total > 0 ? (b.pRG / b.total) * 100 : 0
  const [infl, setInfl] = useState(2)
  const n = Math.max(0, b.liquidationYear - BASE_YEAR)
  const nominal = b.total * (1 + infl / 100) ** n
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pension totale" value={mo(b.total)} hint={`${eur(b.total)}/an · euros d'aujourd'hui`} />
        <Stat label="Taux de remplacement" value={`${(b.replacementRate * 100).toFixed(0)} %`} hint={`vs ${eur(b.lastSalary)} de dernier salaire`} />
        <Stat label="Départ" value={`${b.retirementAge} ans`} hint={`liquidation ${b.liquidationYear} · ${b.quartersWorked} trim.`} />
        <Stat label="Scénario macro" value={scenarioLabel} hint={`taux ${(b.rate * 100).toFixed(1)} %`} />
      </div>

      <Card className="gap-0 p-4">
        <div className="grid gap-4 md:grid-cols-2 md:items-center">
          <div>
            <div className="text-xs text-muted-foreground">Montant nominal en {b.liquidationYear}</div>
            <div className="text-2xl font-semibold tabular-nums">{mo(nominal)}</div>
            <div className="text-xs text-muted-foreground">{eur(nominal)}/an · euros courants de {b.liquidationYear}</div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground">
              Le chiffre affiché sur votre futur relevé, à {infl.toFixed(1)} % d'inflation sur {n} an{n > 1 ? 's' : ''}. Sa
              valeur réelle, en pouvoir d'achat d'aujourd'hui, reste {mo(b.total)}.
            </p>
          </div>
          <label className="block">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Inflation</span>
              <span className="font-medium tabular-nums">{infl.toFixed(1)} %/an</span>
            </div>
            <UiSlider className="mt-2" min={0} max={5} step={0.1} value={[infl]} onValueChange={([v]) => setInfl(v)} />
          </label>
        </div>
      </Card>

      <Card className="gap-0 p-4">
        <p className="mb-2 text-xs leading-snug text-muted-foreground">
          Votre pension se compose du <span style={{ color: CHART.primary }}>régime général</span> (base, CNAV) et de la{' '}
          <span style={{ color: CHART.pink }}>complémentaire</span> (AGIRC-ARRCO, en points). Le <em>taux de remplacement</em> est
          la part de votre dernier salaire que remplace la pension ; le <em>SAM</em> est le salaire annuel moyen de vos 25
          meilleures années ; le <em>taux de liquidation</em> (50 % au maximum) est réduit par une décote s'il manque des trimestres.
        </p>
        <div className="mb-2 flex justify-between text-sm">
          <span style={{ color: CHART.primary }}>Régime général {eur(b.pRG)}</span>
          <span style={{ color: CHART.pink }}>Complémentaire {eur(b.pComp)}</span>
        </div>
        <div className="flex h-6 overflow-hidden border border-border">
          <div style={{ width: `${rgPct}%`, backgroundColor: CHART.primary }} />
          <div style={{ width: `${100 - rgPct}%`, backgroundColor: CHART.pink }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <div>SAM (25 meilleures) : <span className="font-medium text-foreground">{eur(b.sam)}</span></div>
          <div>Points AGIRC-ARRCO : <span className="font-medium text-foreground">{Math.round(b.points).toLocaleString('fr-FR')}</span></div>
          <div>Taux de liquidation : <span className="font-medium text-foreground">{(b.rate * 100).toFixed(1)} %</span></div>
          <div>Trimestres : <span className="font-medium text-foreground">{b.quartersWorked}</span></div>
        </div>
      </Card>
    </div>
  )
}

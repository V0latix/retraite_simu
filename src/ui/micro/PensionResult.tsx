import type { PensionBreakdown } from '../../engine/micro/types'

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`
const mo = (n: number) => `${Math.round(n / 12).toLocaleString('fr-FR')} €/mois`

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-neutral-300 p-3 dark:border-neutral-700">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-neutral-500">{hint}</div>}
    </div>
  )
}

export function PensionResult({ b, scenarioLabel }: { b: PensionBreakdown; scenarioLabel: string }) {
  const rgPct = b.total > 0 ? (b.pRG / b.total) * 100 : 0
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Pension totale" value={mo(b.total)} hint={`${eur(b.total)}/an`} />
        <Stat label="Taux de remplacement" value={`${(b.replacementRate * 100).toFixed(0)} %`} hint={`vs ${eur(b.lastSalary)} de dernier salaire`} />
        <Stat label="Départ" value={`${b.retirementAge} ans`} hint={`liquidation ${b.liquidationYear} · ${b.quartersWorked} trim.`} />
        <Stat label="Scénario macro" value={scenarioLabel} hint={`taux ${(b.rate * 100).toFixed(1)} %`} />
      </div>

      <div className="rounded-lg border border-neutral-300 p-4 dark:border-neutral-700">
        <p className="mb-2 text-xs leading-snug text-neutral-500">
          Votre pension se compose du <span className="text-blue-500">régime général</span> (base, CNAV) et de la{' '}
          <span className="text-pink-500">complémentaire</span> (AGIRC-ARRCO, en points). Le <em>taux de remplacement</em> est
          la part de votre dernier salaire que remplace la pension ; le <em>SAM</em> est le salaire annuel moyen de vos 25
          meilleures années ; le <em>taux de liquidation</em> (50 % au maximum) est réduit par une décote s'il manque des trimestres.
        </p>
        <div className="mb-2 flex justify-between text-sm">
          <span className="text-blue-500">Régime général {eur(b.pRG)}</span>
          <span className="text-pink-500">Complémentaire {eur(b.pComp)}</span>
        </div>
        <div className="flex h-6 overflow-hidden rounded">
          <div className="bg-blue-500" style={{ width: `${rgPct}%` }} />
          <div className="bg-pink-500" style={{ width: `${100 - rgPct}%` }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-neutral-500 md:grid-cols-4">
          <div>SAM (25 meilleures) : <span className="font-medium text-neutral-700 dark:text-neutral-200">{eur(b.sam)}</span></div>
          <div>Points AGIRC-ARRCO : <span className="font-medium text-neutral-700 dark:text-neutral-200">{Math.round(b.points).toLocaleString('fr-FR')}</span></div>
          <div>Taux de liquidation : <span className="font-medium text-neutral-700 dark:text-neutral-200">{(b.rate * 100).toFixed(1)} %</span></div>
          <div>Trimestres : <span className="font-medium text-neutral-700 dark:text-neutral-200">{b.quartersWorked}</span></div>
        </div>
      </div>
    </div>
  )
}

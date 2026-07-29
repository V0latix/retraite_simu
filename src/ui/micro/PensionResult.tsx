import { useState } from 'react'
import type { PensionBreakdown } from '../../engine/micro/types'
import { CHART } from '../chartColors'
import { BASE_YEAR, referenceIndicators } from '../../data/loader'
import { formatAge } from '../../data/reforms'
import { Card } from '@/components/ui/card'
import { Slider as UiSlider } from '@/components/ui/slider'
import { Term } from '@/components/ui/tooltip'

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
      {/* La réforme choisie côté macro fixe l'âge légal de l'année de liquidation. On signale
          le départ trop précoce sans l'interdire : les départs anticipés existent (carrières
          longues, inaptitude, handicap), le modèle ne sait juste pas vérifier l'éligibilité. */}
      {b.belowLegalAge && (
        <Card className="gap-0 border-2 p-3" style={{ borderColor: CHART.pink }}>
          <p className="text-sm leading-snug">
            <span className="font-semibold">Départ à {formatAge(b.retirementAge)} en dessous de l'âge légal.</span>{' '}
            La réforme retenue fixe l'âge légal à {formatAge(b.legalAgeAtLiquidation)} en {b.liquidationYear}. Ce départ
            suppose un dispositif anticipé (carrière longue, inaptitude, handicap) — cochez « carrière longue » dans le
            formulaire si c'est votre cas.
          </p>
        </Card>
      )}

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
          meilleures années ; le <em>taux de liquidation</em> (50 % au maximum) est réduit par une{' '}
          <Term def="Minoration définitive de la pension quand il manque des trimestres à l'âge de départ choisi.">décote</Term>{' '}
          s'il manque des trimestres.
        </p>
        <div className="mb-2 flex justify-between text-sm">
          <span style={{ color: CHART.primary }}>Régime général {eur(b.pRG)}</span>
          <span style={{ color: CHART.pink }}>Complémentaire {eur(b.pComp)}</span>
        </div>
        {b.micoApplied && (
          <p className="mb-2 text-xs font-medium" style={{ color: CHART.primary }}>
            <Term def="Minimum contributif : plancher de la pension de base au taux plein, proratisé par la durée. Ici, la pension calculée était inférieure, elle est portée à ce minimum.">
              Pension portée au minimum (MICO)
            </Term>
          </p>
        )}
        <div className="flex h-6 overflow-hidden border border-border">
          <div style={{ width: `${rgPct}%`, backgroundColor: CHART.primary }} />
          <div style={{ width: `${100 - rgPct}%`, backgroundColor: CHART.pink }} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-muted-foreground md:grid-cols-4">
          <div>
            <Term def="Salaire annuel moyen des 25 meilleures années (plafonné au PASS), base du régime général.">SAM</Term>{' '}
            (25 meilleures) : <span className="font-medium text-foreground">{eur(b.sam)}</span>
          </div>
          <div>Points AGIRC-ARRCO : <span className="font-medium text-foreground">{Math.round(b.points).toLocaleString('fr-FR')}</span></div>
          <div>
            <Term def="Taux appliqué au SAM (50 % au maximum), réduit par la décote s'il manque des trimestres.">Taux de liquidation</Term>{' '}
            : <span className="font-medium text-foreground">{(b.rate * 100).toFixed(1)} %</span>
          </div>
          <div>
            <Term def="Unité de durée d'assurance : 4 par an travaillé, il en faut ≈ 172 pour le taux plein.">Trimestres</Term>{' '}
            : <span className="font-medium text-foreground">{b.quartersWorked}</span>
          </div>
        </div>
      </Card>

      <DreesReference b={b} />
    </div>
  )
}

/** Places the computed cas-type against real DREES 2023 / COR figures (§4). Reference, not
 *  model output: the DREES panorama covers all schemes and current retirees, while the cas-type
 *  is prospective and RG + AGIRC-ARRCO only — so it's a plausibility check, not an equality. */
function DreesReference({ b }: { b: PensionBreakdown }) {
  const d = referenceIndicators.drees2023
  const rrRef = referenceIndicators.tauxRemplacementMoyen.value2024
  const monthly = b.total / 12
  const pensionGap = (monthly / d.pensionBruteMoyenne - 1) * 100
  const rrGap = (b.replacementRate - rrRef) * 100
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(0)}`
  return (
    <Card className="gap-2 p-4">
      <h3 className="text-sm font-medium">Repères DREES 2023 · COR — où se situe ce cas-type</h3>
      <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs text-muted-foreground">Pension (ce cas-type)</div>
          <div className="font-semibold tabular-nums">{mo(b.total)}</div>
          <div className="text-xs text-muted-foreground">
            vs {d.pensionBruteMoyenne.toLocaleString('fr-FR')} €/mois moyen ({signed(pensionGap)} %)
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Taux de remplacement</div>
          <div className="font-semibold tabular-nums">{(b.replacementRate * 100).toFixed(0)} %</div>
          <div className="text-xs text-muted-foreground">
            vs {(rrRef * 100).toFixed(0)} % moyen ({signed(rrGap)} pt)
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pension moyenne nette</div>
          <div className="font-semibold tabular-nums">{d.pensionNetteMoyenne.toLocaleString('fr-FR')} €/mois</div>
          <div className="text-xs text-muted-foreground">{d.pensionAvecReversion.toLocaleString('fr-FR')} € avec réversion</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Pauvreté des retraités</div>
          <div className="font-semibold tabular-nums">{(d.tauxPauvreteRetraites * 100).toFixed(1)} %</div>
          <div className="text-xs text-muted-foreground">vs {(d.tauxPauvretePopulation * 100).toFixed(1)} % population</div>
        </div>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Repères <strong>observés</strong> (tous régimes, retraités actuels — DREES éd. 2025, COR juin 2025). Le cas-type est
        prospectif et limité au régime général + AGIRC-ARRCO : c'est un contrôle de vraisemblance, pas une égalité. Écart de
        pension femmes/hommes : −{(d.ecartPensionFemmesHommes * 100).toFixed(0)} %.
      </p>
    </Card>
  )
}

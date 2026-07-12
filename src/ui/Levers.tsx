import { SCENARIO_IDS, SCENARIO_LABELS, type BeyondDataPolicy, type ScenarioId } from '../data/schema'
import type { Indexation, PolicyParams } from '../engine/types'
import { Card } from '@/components/ui/card'
import { Slider as UiSlider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

const INDEXATION_LABELS: Record<Indexation, string> = {
  prices: 'Prix',
  wages: 'Salaires',
  mix: 'Mixte',
}

// Hypothèses des variantes INSEE « Projections de population 2021-2070 ». Chaque variante ne
// change qu'un seul levier par rapport au central ; les valeurs sont les cibles 2070.
const SCENARIO_DESCRIPTIONS: Record<ScenarioId, string> = {
  central: 'Scénario de référence de l’INSEE (et du COR) : 1,8 enfant par femme, gains d’espérance de vie tendanciels, solde migratoire +70 000/an.',
  'fertility-high': 'Comme le central, mais 2,0 enfants par femme. Plus de naissances → plus de cotisants… mais seulement après ~20 ans, le temps qu’ils entrent sur le marché du travail.',
  'fertility-low': 'Comme le central, mais 1,6 enfant par femme. Moins de naissances → population active plus faible à long terme, ratio cotisants/retraité plus dégradé.',
  'mortality-low': 'Espérance de vie haute : gains de longévité plus rapides (~92 ans à la naissance en 2070). On vit plus vieux → plus de retraités, plus longtemps → dépenses plus lourdes.',
  'mortality-high': 'Espérance de vie basse : gains de longévité plus lents (~86 ans en 2070). Retraités moins nombreux et moins longtemps → solde moins dégradé.',
  'migration-high': 'Solde migratoire haut : +120 000/an. Les migrants sont surtout des actifs → davantage de cotisants, ratio mieux soutenu.',
  'migration-low': 'Solde migratoire bas : +20 000/an. Moins d’apport d’actifs → cotisants plus rares, ratio plus dégradé.',
  pragmatique:
    'Hors scénarios INSEE : fécondité et migration calées sur les tendances réellement observées — fécondité ~1,5 en baisse (vs 1,8) et solde migratoire ~+176 000/an (vs +70 000). Seul scénario à intégrer aussi les risques macro : intérêt sur la dette (boule de neige) et exode des jeunes actifs — réglables ci-dessous.',
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
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{fmt(value)}</span>
      </div>
      <UiSlider className="mt-2" min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
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
    <>
      {/* Carte 1 — le contexte démographique projeté (quel scénario, sur quel horizon). */}
      <Card className="gap-4 p-4">
        <h2 className="text-lg font-semibold">Scénario</h2>
        <label className="block">
          <span className="text-sm text-muted-foreground">Scénario INSEE</span>
          <Select value={scenarioId} onValueChange={(v) => onScenario(v as ScenarioId)}>
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
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{SCENARIO_DESCRIPTIONS[scenarioId]}</p>
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
          <span className="text-sm text-muted-foreground">Extrapolation après 2070</span>
          <Select value={beyondPolicy} onValueChange={(v) => onBeyond(v as BeyondDataPolicy)}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BEYOND_LABELS) as BeyondDataPolicy[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BEYOND_LABELS[b]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </Card>

      {/* Carte 2 — les leviers de réforme, qui recalculent le solde à démographie donnée. */}
      <Card className="gap-4 p-4">
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
          <span className="text-sm text-muted-foreground">Règle d'indexation</span>
          <Select value={policy.indexation} onValueChange={(v) => onPolicy({ indexation: v as Indexation })}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(INDEXATION_LABELS) as Indexation[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {INDEXATION_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </Card>

      {/* Carte 3 — risques macro propres au Pragmatique : finances publiques + fuite des actifs.
          Masquée pour les scénarios INSEE/COR, qui restent figés sur la référence. */}
      {scenarioId === 'pragmatique' && (
        <Card className="gap-4 p-4">
          <h2 className="text-lg font-semibold">Contexte & risques</h2>
          <p className="-mt-1 text-xs leading-snug text-muted-foreground">
            Spécifiques au scénario Pragmatique : les scénarios INSEE/COR n'en tiennent pas compte.
          </p>
          <Slider
            label="Taux d'intérêt sur la dette"
            value={policy.realInterestRate ?? 0}
            min={0}
            max={0.04}
            step={0.001}
            fmt={(v) => `${(v * 100).toFixed(1).replace('.', ',')} %`}
            onChange={(v) => onPolicy({ realInterestRate: v })}
          />
          <p className="-mt-2 text-xs leading-snug text-muted-foreground">
            Les déficits cumulés portent intérêt (et les réserves rapportent) : effet boule de neige sur le
            graphe « Solde cumulé ». Le solde annuel, comparable au COR, n'est pas modifié.
          </p>
          <Slider
            label="Exode des jeunes actifs (25-40 ans)"
            value={policy.workerExodus ?? 0}
            min={0}
            max={100000}
            step={5000}
            fmt={(v) => (v === 0 ? 'aucun' : `−${Math.round(v / 1000)} 000/an`)}
            onChange={(v) => onPolicy({ workerExodus: v })}
          />
          <p className="-mt-2 text-xs leading-snug text-muted-foreground">
            Émigration nette de jeunes actifs, retirée du solde migratoire : moins de cotisants aujourd'hui,
            moins de naissances demain. Tracée à part sur le graphe « Immigration ».
          </p>
        </Card>
      )}
    </>
  )
}

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
  'cor-productivite-basse':
    'Démographie centrale, mais gains de productivité de long terme à 0,7 %/an (bas du faisceau COR, vs 1,0 % au central). Salaires réels plus faibles → moins de cotisations → solde plus dégradé. Le curseur de productivité ci-dessous est neutralisé pour ce scénario.',
  'cor-productivite-haute':
    'Démographie centrale, mais gains de productivité de long terme à 1,3 %/an (haut du faisceau COR, vs 1,0 % au central). Salaires réels plus élevés → plus de cotisations → solde soutenu. Le curseur de productivité ci-dessous est neutralisé pour ce scénario.',
  'choc-recession':
    'Démographie centrale, mais un choc conjoncturel ponctuel : le chômage monte de 7 % à ~10 % entre 2027 et 2028 puis revient à 7 % en 2030. Les chômeurs ne cotisent pas → creux transitoire du solde qui se résorbe après la crise.',
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  fmt,
  onChange,
  disabled = false,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <label className={`block${disabled ? ' opacity-50' : ''}`}>
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{fmt(value)}</span>
      </div>
      <UiSlider className="mt-2" min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([v]) => onChange(v)} />
    </label>
  )
}

/** COR-productivité scenarios pin productivity intrinsically → the lever is inert. */
const COR_PROD_LOCK: Partial<Record<ScenarioId, number>> = {
  'cor-productivite-basse': 0.007,
  'cor-productivite-haute': 0.013,
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

      {/* Carte 2 — les leviers de réforme, qui recalculent le solde à démographie donnée.
          Les deux leviers les plus courants restent visibles ; les six autres se replient
          dans un <details> natif (clavier-accessible, zéro JS) pour désencombrer. */}
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
        <p className="-mt-2 text-xs leading-snug text-muted-foreground">
          Le levier le plus direct : reculer l'âge ajoute des cotisants et retire des retraités.
          +1&nbsp;an = chaque génération cotise un an de plus avant de basculer en retraite.
        </p>
        <Slider
          label="Taux de cotisation"
          value={policy.contributionRate}
          min={0.2}
          max={0.4}
          step={0.005}
          fmt={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={(v) => onPolicy({ contributionRate: v })}
        />
        <p className="-mt-2 text-xs leading-snug text-muted-foreground">
          Levier de recette le plus direct : <strong>+5&nbsp;pts ≈ +1,4&nbsp;pt de PIB</strong> sur le
          solde en 2070. En contrepartie, autant de pouvoir d'achat en moins pour les actifs.
        </p>

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            Leviers avancés
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            <Slider
              label="Âge légal indexé sur l'espérance de vie"
              value={policy.legalAgeLEShare ?? 0}
              min={0}
              max={1}
              step={0.05}
              fmt={(v) => (v === 0 ? 'désactivé' : `${Math.round(v * 100)} %`)}
              onChange={(v) => onPolicy({ legalAgeLEShare: v })}
            />
            <p className="-mt-2 text-xs leading-snug text-muted-foreground">
              Au lieu de figer l'âge, on le fait <strong>monter avec l'espérance de vie</strong>. À
              <em> 100 %</em>, chaque année de vie gagnée depuis 2025 devient une année de travail ; à
              <em> 0 %</em>, l'âge reste bloqué sur le curseur ci-dessus. Les réformes officielles (COR)
              calent souvent ce partage autour des <strong>deux tiers</strong>.
            </p>
            <Slider
              label="Durée requise"
              value={policy.requiredQuarters}
              min={160}
              max={188}
              fmt={(v) => `${v} trim.`}
              onChange={(v) => onPolicy({ requiredQuarters: v })}
            />
            <p className="-mt-2 text-xs leading-snug text-muted-foreground">
              Trimestres cotisés exigés pour le taux plein (4&nbsp;trim. = 1&nbsp;an). En exiger davantage
              repousse l'âge effectif de départ → plus de cotisants, moins de retraités. (Le modèle ne
              retient que ce recul des départs, pas le report vers la décote.)
            </p>
            <Slider
              label="Taux de chômage"
              value={policy.unemployment ?? 0.07}
              min={0.045}
              max={0.11}
              step={0.005}
              fmt={(v) => `${(v * 100).toFixed(1).replace('.', ',')} %`}
              onChange={(v) => onPolicy({ unemployment: v })}
            />
            <p className="-mt-2 text-xs leading-snug text-muted-foreground">
              Un chômeur ne cotise pas : les cotisants sont comptés × (1&nbsp;−&nbsp;u). Ce curseur
              <strong> force l'hypothèse</strong> de chômage, quel que soit le scénario (les projections
              officielles supposent souvent un retour vers 4,5&nbsp;% ; l'observé récent ≈ 7,4&nbsp;%).
            </p>
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
            <Slider
              label="Sous-indexation des pensions"
              value={policy.underIndexation ?? 0}
              min={0}
              max={0.015}
              step={0.0025}
              fmt={(v) => (v === 0 ? 'aucune' : `−${(v * 100).toFixed(2).replace('.', ',')} pt/an`)}
              onChange={(v) => onPolicy({ underIndexation: v })}
            />
            <Slider
              label="Durée de la sous-indexation"
              value={policy.underIndexationYears ?? 0}
              min={0}
              max={10}
              step={1}
              fmt={(v) => (v === 0 ? 'aucune' : `${v} ans`)}
              onChange={(v) => onPolicy({ underIndexationYears: v })}
            />
            <p className="-mt-2 text-xs leading-snug text-muted-foreground">
              Retrancher quelques points/an à la revalorisation des pensions (« prix&nbsp;−&nbsp;1&nbsp;pt »
              = pensions 1&nbsp;point sous l'inflation). Effet puissant car il porte sur <em>tout le
              stock</em> : <strong>−1&nbsp;pt/an pendant 10&nbsp;ans ≈ −10 %</strong> sur la pension
              moyenne, donc autant de dépenses en moins. Indolore à court terme, mais cumulatif.
            </p>
            <Slider
              label="Croissance de la productivité"
              value={COR_PROD_LOCK[scenarioId] ?? policy.productivity ?? 0.01}
              min={0.004}
              max={0.02}
              step={0.001}
              fmt={(v) => `${(v * 100).toFixed(1).replace('.', ',')} %/an`}
              onChange={(v) => onPolicy({ productivity: v })}
              disabled={scenarioId in COR_PROD_LOCK}
            />
            <p className="-mt-2 text-xs leading-snug text-muted-foreground">
              Rythme de hausse des salaires réels. Les pensions suivant les prix (pas les salaires), une
              productivité plus forte réduit les dépenses en part de PIB et améliore le solde. Repère
              COR : 1,0 %/an (variantes 0,4 à 1,6 %).
            </p>
          </div>
        </details>
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

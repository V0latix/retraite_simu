import { REFORM_PRESETS } from '../data/reforms'
import { SCENARIO_DESCRIPTIONS } from '../data/scenarioPresets'
import { SCENARIO_IDS, SCENARIO_LABELS, type ScenarioId } from '../data/schema'
import type { Indexation, PolicyParams } from '../engine/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider as UiSlider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  scenarioId: ScenarioId
  policy: PolicyParams
  horizon: number
  reformKey: string
  changedCount: number
  onScenario: (id: ScenarioId) => void
  onPolicy: (p: Partial<PolicyParams>) => void
  onReform: (key: string) => void
  onHorizon: (h: number) => void
  onReset: () => void
}

const INDEXATION_LABELS: Record<Indexation, string> = {
  prices: 'Prix',
  wages: 'Salaires',
  mix: 'Mixte',
}

/** Section title, brutalist: small caps over a hard rule. */
function Title({ children }: { children: React.ReactNode }) {
  return <h2 className="border-b border-border pb-2 text-sm font-semibold tracking-wide uppercase">{children}</h2>
}

/**
 * Pedagogical copy, folded away. Native <details> — keyboard-accessible, zero JS.
 * ponytail: the sidebar is 280px wide; 12 paragraphs inline made it a wall of text.
 */
export function Hint({ children }: { children: React.ReactNode }) {
  return (
    <details className="group/hint">
      <summary
        className="w-fit cursor-pointer list-none text-xs text-muted-foreground select-none hover:text-foreground"
        title="Afficher l'explication"
        aria-label="Afficher l'explication"
      >
        ⓘ
      </summary>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{children}</p>
    </details>
  )
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
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  fmt: (v: number) => string
  onChange: (v: number) => void
  disabled?: boolean
  hint?: React.ReactNode
}) {
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <label className="block">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium tabular-nums">{fmt(value)}</span>
        </div>
        <UiSlider className="mt-2" min={min} max={max} step={step} value={[value]} disabled={disabled} onValueChange={([v]) => onChange(v)} />
      </label>
      {hint && (
        <div className="mt-1.5">
          <Hint>{hint}</Hint>
        </div>
      )}
    </div>
  )
}

export function Levers({
  scenarioId,
  policy,
  horizon,
  reformKey,
  changedCount,
  onScenario,
  onPolicy,
  onReform,
  onHorizon,
  onReset,
}: Props) {
  return (
    <>
      {/* Carte 1 — le contexte projeté. Le scénario ne fait que positionner les curseurs
          d'hypothèses ci-dessous : les bouger fabrique sa propre variante (« modifié »). */}
      <Card className="gap-4 p-4">
        <Title>Scénario</Title>
        <label className="block">
          <span className="text-sm text-muted-foreground">Jeu d'hypothèses</span>
          <Select value={scenarioId} onValueChange={(v) => onScenario(v as ScenarioId)}>
            <SelectTrigger className="mt-1 w-full">
              {/* children override the selected item's label → on y colle l'état « modifié ». */}
              <SelectValue>
                {SCENARIO_LABELS[scenarioId]}
                {changedCount > 0 && ' — modifié'}
              </SelectValue>
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
      </Card>

      {/* Carte 2 — les hypothèses, curseurs de plein droit. Chaque scénario n'est qu'un jeu de
          positions ici : les anciennes variantes INSEE (fécondité ±, migration ±, productivité
          COR ±) sont exactement ces curseurs déplacés. */}
      <Card className="gap-4 p-4">
        <Title>Hypothèses</Title>
        <Slider
          label="Fécondité"
          value={policy.tfr ?? 1.8}
          min={1.2}
          max={2.2}
          step={0.05}
          fmt={(v) => `${v.toFixed(2).replace('.', ',')} enf./f.`}
          onChange={(v) => onPolicy({ tfr: v })}
          hint={
            <>
              Nombre d'enfants par femme (indice conjoncturel). Repères : <strong>1,8</strong> = hypothèse
              INSEE, <strong>1,6</strong> = observé 2024. Levier lent : un bébé de 2026 ne cotise pas avant
              ~2046 — l'effet sur le solde n'apparaît qu'après 20 ans, mais il pèse ensuite pour toujours.
            </>
          }
        />
        <Slider
          label="Solde migratoire"
          value={policy.netMigration ?? 70000}
          min={0}
          max={250000}
          step={5000}
          fmt={(v) => `+${Math.round(v / 1000)} 000/an`}
          onChange={(v) => onPolicy({ netMigration: v })}
          hint={
            <>
              Entrées moins sorties, tous âges. Repères : <strong>+70 000</strong> = hypothèse INSEE,
              <strong> +176 000</strong> = moyenne observée 2023-2025. Effet <em>immédiat</em>, à l'inverse de
              la fécondité : les arrivants sont surtout des actifs, donc des cotisants tout de suite.
            </>
          }
        />
        <Slider
          label="Croissance de la productivité"
          value={policy.productivity ?? 0.01}
          min={0.004}
          max={0.02}
          step={0.001}
          fmt={(v) => `${(v * 100).toFixed(1).replace('.', ',')} %/an`}
          onChange={(v) => onPolicy({ productivity: v })}
          hint={
            <>
              Rythme de hausse des salaires réels. Les pensions suivant les prix (pas les salaires), une
              productivité plus forte réduit les dépenses en part de PIB et améliore le solde. Faisceau
              COR&nbsp;: 0,7 à 1,3 %/an autour de 1,0 %.
            </>
          }
        />
        <Slider
          label="Taux de chômage"
          value={policy.unemployment ?? 0.07}
          min={0.045}
          max={0.11}
          step={0.005}
          fmt={(v) => `${(v * 100).toFixed(1).replace('.', ',')} %`}
          onChange={(v) => onPolicy({ unemployment: v })}
          hint={
            <>
              Un chômeur ne cotise pas : les cotisants sont comptés × (1&nbsp;−&nbsp;u). Les projections
              officielles supposent souvent un retour vers 4,5&nbsp;% ; l'observé récent ≈ 7,4&nbsp;%.
            </>
          }
        />
      </Card>

      {/* Carte 3 — les leviers de réforme, qui recalculent le solde à hypothèses données.
          Les deux leviers les plus courants restent visibles ; les six autres se replient
          dans un <details> natif (clavier-accessible, zéro JS) pour désencombrer. */}
      <Card className="gap-4 p-4">
        <Title>Leviers de réforme</Title>
        {/* The count lives on the button rather than in a separate badge: same information,
            one element, and the way out is always next to the reason you need it. */}
        {changedCount > 0 && (
          <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={onReset}>
            Réinitialiser · {changedCount} levier{changedCount > 1 ? 's' : ''} modifié{changedCount > 1 ? 's' : ''}
          </Button>
        )}
        <label className="block">
          <span className="text-sm text-muted-foreground">Réforme clés en main</span>
          <Select value={reformKey} onValueChange={onReform}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Choisir une proposition…" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REFORM_PRESETS).map(([key, r]) => (
                <SelectItem key={key} value={key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {reformKey && REFORM_PRESETS[reformKey] && (
            <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{REFORM_PRESETS[reformKey].source}</p>
          )}
        </label>
        <Hint>
          Applique un jeu de leviers en un clic. Ajuster un curseur ci-dessous repart d'une réforme
          « sur mesure ».
        </Hint>
        <Slider
          label="Âge légal de départ"
          value={policy.legalAge}
          min={60}
          max={70}
          fmt={(v) => `${v} ans`}
          onChange={(v) => onPolicy({ legalAge: v })}
          hint={
            <>
              Le levier le plus direct : reculer l'âge ajoute des cotisants et retire des retraités.
              +1&nbsp;an = chaque génération cotise un an de plus avant de basculer en retraite.
            </>
          }
        />
        <Slider
          label="Taux de cotisation"
          value={policy.contributionRate}
          min={0.2}
          max={0.4}
          step={0.005}
          fmt={(v) => `${(v * 100).toFixed(1)}%`}
          onChange={(v) => onPolicy({ contributionRate: v })}
          hint={
            <>
              Levier de recette le plus direct : <strong>+5&nbsp;pts ≈ +1,4&nbsp;pt de PIB</strong> sur le
              solde en 2070. En contrepartie, autant de pouvoir d'achat en moins pour les actifs.
            </>
          }
        />

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
              hint={
                <>
                  Au lieu de figer l'âge, on le fait <strong>monter avec l'espérance de vie</strong>. À
                  <em> 100 %</em>, chaque année de vie gagnée depuis 2025 devient une année de travail ; à
                  <em> 0 %</em>, l'âge reste bloqué sur le curseur ci-dessus. Les réformes officielles (COR)
                  calent souvent ce partage autour des <strong>deux tiers</strong>.
                </>
              }
            />
            <Slider
              label="Durée requise"
              value={policy.requiredQuarters}
              min={160}
              max={188}
              fmt={(v) => `${v} trim.`}
              onChange={(v) => onPolicy({ requiredQuarters: v })}
              hint={
                <>
                  Trimestres cotisés exigés pour le taux plein (4&nbsp;trim. = 1&nbsp;an). En exiger davantage
                  repousse l'âge effectif de départ → plus de cotisants, moins de retraités. (Le modèle ne
                  retient que ce recul des départs, pas le report vers la décote.)
                </>
              }
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
              hint={
                <>
                  Retrancher quelques points/an à la revalorisation des pensions (« prix&nbsp;−&nbsp;1&nbsp;pt »
                  = pensions 1&nbsp;point sous l'inflation). Effet puissant car il porte sur <em>tout le
                  stock</em> : <strong>−1&nbsp;pt/an pendant 10&nbsp;ans ≈ −10 %</strong> sur la pension
                  moyenne, donc autant de dépenses en moins. Indolore à court terme, mais cumulatif.
                </>
              }
            />
            <Slider
              label="Recettes nouvelles (retraités / CSG)"
              value={policy.additionalResourcesPct ?? 0}
              min={0}
              max={0.02}
              step={0.0025}
              fmt={(v) => (v === 0 ? 'aucune' : `+${(v * 100).toFixed(2).replace('.', ',')} pt PIB`)}
              onChange={(v) => onPolicy({ additionalResourcesPct: v })}
              hint={
                <>
                  Recette supplémentaire en part de PIB — hausse de CSG sur les pensions, contribution des
                  retraités… Ajoutée aux ressources, elle améliore le solde d'autant, sans toucher aux
                  cotisations des actifs.
                </>
              }
            />
            <Slider
              label="Abondement du FRR (réserves)"
              value={policy.frrFlowPct ?? 0}
              min={0}
              max={0.01}
              step={0.001}
              fmt={(v) => (v === 0 ? 'aucun' : `+${(v * 100).toFixed(1).replace('.', ',')} pt PIB/an`)}
              onChange={(v) => onPolicy({ frrFlowPct: v })}
              hint={
                <>
                  Mettre des réserves de côté chaque année (capitalisation partielle / Fonds de réserve).
                  Visible sur le graphe « Solde cumulé » : les réserves accumulées repoussent le moment où
                  les déficits épuisent le fonds. Le solde annuel, comparable au COR, n'est pas modifié.
                </>
              }
            />
            <Slider
              label="Départs anticipés (carrières longues)"
              value={policy.earlyRetirementShare ?? 0}
              min={0}
              max={0.3}
              step={0.05}
              fmt={(v) => (v === 0 ? 'aucun' : `${Math.round(v * 100)} %`)}
              onChange={(v) => onPolicy({ earlyRetirementShare: v })}
              hint={
                <>
                  Part des 60-âge légal partant plus tôt (carrières longues, pénibilité) : ils basculent de
                  cotisants à retraités avant l'âge légal. Effet inverse d'un recul d'âge — dégrade le solde.
                </>
              }
            />
          </div>
        </details>
      </Card>

      {/* Carte 4 — risques macro propres au Pragmatique : finances publiques + fuite des actifs.
          Masquée pour les scénarios INSEE/COR, qui restent figés sur la référence. */}
      {scenarioId === 'pragmatique' && (
        <Card className="gap-4 p-4">
          <Title>Contexte & risques</Title>
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
            hint={
              <>
                Les déficits cumulés portent intérêt (et les réserves rapportent) : effet boule de neige sur le
                graphe « Solde cumulé ». Le solde annuel, comparable au COR, n'est pas modifié.
              </>
            }
          />
          <Slider
            label="Exode des jeunes actifs (25-40 ans)"
            value={policy.workerExodus ?? 0}
            min={0}
            max={100000}
            step={5000}
            fmt={(v) => (v === 0 ? 'aucun' : `−${Math.round(v / 1000)} 000/an`)}
            onChange={(v) => onPolicy({ workerExodus: v })}
            hint={
              <>
                Émigration nette de jeunes actifs, retirée du solde migratoire : moins de cotisants aujourd'hui,
                moins de naissances demain. Tracée à part sur le graphe « Immigration ».
              </>
            }
          />
        </Card>
      )}
    </>
  )
}

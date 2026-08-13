import { useRef, useState } from 'react'
import { REFORM_PRESETS, scheduleSummary, type ReformPreset } from '../data/reforms'
import {
  HYPOTHESIS_LEVER_SPECS,
  INDEXATION_LABELS,
  REFORM_LEVER_SPECS,
  RISK_LEVER_SPECS,
  diffReformLevers,
  fromInput,
  sameSchedule,
  toInput,
  type EditSpec,
  type ReformLeverKey,
  type ReformMode,
} from '../data/reformLevers'
import { SCENARIO_DESCRIPTIONS } from '../data/scenarioPresets'
import { SCENARIO_IDS, SCENARIO_LABELS, type ScenarioId } from '../data/schema'
import { clamp } from '../lib/clamp'
import { MAX_NAME_LENGTH, type CustomReform } from '../lib/customReforms'
import { parseFrNumber } from '../lib/format'
import type { Indexation, PolicyParams } from '../engine/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Slider as UiSlider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Props {
  scenarioId: ScenarioId
  policy: PolicyParams
  /** La référence du scénario, leviers de réforme non touchés : c'est l'« avant » du récapitulatif
   *  et le point de retour des réinitialisations. */
  basePolicy: PolicyParams
  horizon: number
  reformKey: string
  reformMode: ReformMode
  reformName: string
  /** Presets intégrés + réformes enregistrées sur cet appareil, même canal. */
  presets: Record<string, ReformPreset>
  savedReforms: CustomReform[]
  canSaveReforms: boolean
  /** Déviations des seules HYPOTHÈSES : c'est ce compteur qui a le droit de dire « — modifié »
   *  sur le sélecteur de scénario. */
  hypothesisChangedCount: number
  onScenario: (id: ScenarioId) => void
  /** Un levier de réforme : détache de la réforme sélectionnée. */
  onPolicy: (p: Partial<PolicyParams>) => void
  /** Une hypothèse ou un risque : décrit le monde, pas la réforme — ne la détache donc pas. */
  onHypothesis: (p: Partial<PolicyParams>) => void
  onReform: (key: string) => void
  onCustomMode: () => void
  onPresetMode: () => void
  onHorizon: (h: number) => void
  onResetHypotheses: () => void
  onResetReform: () => void
  onRestoreCalendar: () => void
  onReformName: (n: string) => void
  onSaveReform: (name: string) => void
  onDeleteReform: (key: string) => void
}

/** Section title, brutalist: small caps over a hard rule. */
function Title({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="border-b border-border pb-2 text-sm font-semibold tracking-wide uppercase">{children}</h2>
  )
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
  edit,
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
  /** Absent ⇒ valeur en lecture seule, curseur seul. Présent ⇒ la valeur se clique et se tape. */
  edit?: EditSpec
  onChange: (v: number) => void
  disabled?: boolean
  hint?: React.ReactNode
}) {
  // `null` = pas en édition, on affiche `fmt(value)` ; sinon la frappe en cours, telle quelle, pour
  // qu'on puisse vider le champ ou taper « 1, » sans que la valeur saute (même convention que le
  // `raw` de CareerForm). Échap passe par `cancelled` plutôt que par un démontage : le blur qui
  // suit doit savoir qu'il ne valide rien.
  const [raw, setRaw] = useState<string | null>(null)
  const cancelled = useRef(false)

  // Ce que vaudrait la frappe en cours : `null` = pas en édition, ou pas un nombre.
  const typed = raw === null || !edit ? null : fromInput(raw, { min, max, edit })
  // Hors bornes pendant la frappe : on le signale, mais au commit on clampe plutôt que rejeter.
  // L'epsilon absorbe le bruit flottant de `min * scale` (0,045 × 100 n'est pas toujours 4,5).
  const parsed = raw === null || !edit ? null : parseFrNumber(raw)
  const outOfBounds =
    parsed !== null &&
    edit != null &&
    (parsed < min * edit.scale - 1e-9 || parsed > max * edit.scale + 1e-9)

  const commit = () => {
    // On n'appelle `onChange` que si la valeur bouge : un clic-sortie sans rien taper détacherait
    // sinon la réforme sélectionnée (`setReformLever` blanchit `reformKey`).
    if (typed !== null && typed !== value && !cancelled.current) onChange(typed)
    cancelled.current = false
    setRaw(null)
  }

  /** ↑/↓ dans le champ : un pas de curseur, ce que `type="text"` ne donne plus gratuitement. */
  const bump = (dir: 1 | -1) => {
    if (!edit) return
    setRaw(toInput(clamp((typed ?? value) + dir * step, min, max), edit))
  }

  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-muted-foreground">{label}</span>
        {raw !== null && edit ? (
          <span className="flex shrink-0 items-center gap-1">
            <Input
              autoFocus
              type="text"
              inputMode="decimal"
              value={raw}
              aria-label={`${label}, valeur en ${edit.unit}`}
              aria-invalid={outOfBounds}
              onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => setRaw(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                else if (e.key === 'Escape') {
                  cancelled.current = true
                  e.currentTarget.blur()
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault()
                  bump(e.key === 'ArrowUp' ? 1 : -1)
                }
              }}
              // w-20 : « 176000 » et « 2100 » doivent tenir sans que le champ se mette à défiler.
              className="h-6 w-20 px-1.5 py-0 text-right text-sm tabular-nums md:text-sm"
            />
            <span className="text-xs text-muted-foreground">{edit.unit}</span>
          </span>
        ) : edit && !disabled ? (
          // Le champ ne s'ouvre qu'au clic : 16 curseurs dans une colonne de 280px, au repos on veut
          // les libellés lisibles (« aucun », « 64 ans 3 mois »), pas 16 boîtes de saisie.
          <button
            type="button"
            title="Saisir une valeur précise"
            onClick={() => setRaw(toInput(value, edit))}
            className="-mx-1 shrink-0 cursor-text rounded px-1 font-medium tabular-nums hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
          >
            {fmt(value)}
          </button>
        ) : (
          <span className="shrink-0 font-medium tabular-nums">{fmt(value)}</span>
        )}
      </div>
      {outOfBounds && edit && (
        <p className="mt-0.5 text-right text-xs text-destructive">
          entre {toInput(min, edit)} et {toInput(max, edit)}
        </p>
      )}
      {/* Le <label> qui enveloppait libellé + curseur a sauté : il ne pouvait pas désigner deux
          contrôles. Le libellé passe au pouce Radix (seul élément à porter role="slider"). */}
      <UiSlider
        className="mt-2"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
      />
      {hint && (
        <div className="mt-1.5">
          <Hint>{hint}</Hint>
        </div>
      )}
    </div>
  )
}

/**
 * La pédagogie par levier, indexée par clé — le pendant JSX de `REFORM_LEVER_SPECS`, qui ne porte
 * que des nombres et des formats (pas de JSX sous `src/data/`).
 */
const REFORM_HINTS: Partial<Record<ReformLeverKey, React.ReactNode>> = {
  legalAge: (
    <>
      Le levier le plus direct : reculer l'âge ajoute des cotisants et retire des retraités. Tout le monde ne
      bascule pas pour autant — une partie de la tranche d'âge était déjà inactive sans être retraitée, une
      autre travaillait déjà au-delà, et les départs anticipés en exemptent une part. Le modèle ne retient
      donc qu'<strong>un quart environ de l'effet théorique</strong>, calé sur les chiffrages publiés de la
      réforme 2023 (≈&nbsp;14&nbsp;Md€/an pour +2&nbsp;ans).
    </>
  ),
  contributionRate: (
    <>
      Levier de recette le plus direct : <strong>+5&nbsp;pts ≈ +1,4&nbsp;pt de PIB</strong> sur le solde en
      2070. En contrepartie, autant de pouvoir d'achat en moins pour les actifs.
    </>
  ),
  legalAgeLEShare: (
    <>
      Au lieu de figer l'âge, on le fait <strong>monter avec l'espérance de vie</strong>. À<em> 100 %</em>,
      chaque année de vie gagnée depuis 2025 devient une année de travail ; à<em> 0 %</em>, l'âge reste bloqué
      sur le curseur ci-dessus. Les réformes officielles (COR) calent souvent ce partage autour des{' '}
      <strong>deux tiers</strong>.
    </>
  ),
  requiredQuarters: (
    <>
      Trimestres cotisés exigés pour le taux plein (4&nbsp;trim. = 1&nbsp;an). En exiger davantage repousse
      l'âge effectif de départ → plus de cotisants, moins de retraités. (Le modèle ne retient que ce recul des
      départs, pas le report vers la décote.)
    </>
  ),
  pensionCap: (
    <>
      Écrête les pensions brutes au-dessus du plafond. L'économie est calculée sur la{' '}
      <strong>distribution des pensions par décile</strong> (DREES) appliquée à la pension moyenne projetée :
      un plafond à <em>4 000 €</em> ne touche que le dernier dixième des retraités, un plafond à{' '}
      <em>2 000 €</em> mord sur près de la moitié. Le plafond est en euros constants — il se resserre donc à
      mesure que les pensions dérivent. Ordre de grandeur : la distribution est approximative, pas un
      chiffrage d'étude d'impact.
    </>
  ),
  underIndexationYears: (
    <>
      Retrancher quelques points/an à la revalorisation des pensions («&nbsp;prix&nbsp;−&nbsp;1&nbsp;pt&nbsp;»
      = pensions 1&nbsp;point sous l'inflation). Effet puissant car il porte sur <em>tout le stock</em> :{' '}
      <strong>−1&nbsp;pt/an pendant 10&nbsp;ans ≈ −10 %</strong> sur la pension moyenne, donc autant de
      dépenses en moins. Indolore à court terme, mais cumulatif.
    </>
  ),
  additionalResourcesPct: (
    <>
      Recette supplémentaire en part de PIB — hausse de CSG sur les pensions, contribution des retraités…
      Ajoutée aux ressources, elle améliore le solde d'autant, sans toucher aux cotisations des actifs.
    </>
  ),
  frrFlowPct: (
    <>
      Mettre des réserves de côté chaque année (capitalisation partielle / Fonds de réserve). Visible sur le
      graphe « Solde cumulé » : les réserves accumulées repoussent le moment où les déficits épuisent le
      fonds. Le solde annuel, comparable au COR, n'est pas modifié.
    </>
  ),
  earlyRetirementShare: (
    <>
      Part des 60-âge légal partant plus tôt (carrières longues, pénibilité) : ils basculent de cotisants à
      retraités avant l'âge légal. Effet inverse d'un recul d'âge — dégrade le solde.
    </>
  ),
}

const HYPOTHESIS_HINTS: Record<string, React.ReactNode> = {
  tfr: (
    <>
      Nombre d'enfants par femme (indice conjoncturel). Repères : <strong>1,8</strong> = hypothèse INSEE,{' '}
      <strong>1,6</strong> = observé 2024. Levier lent : un bébé de 2026 ne cotise pas avant ~2046 — l'effet
      sur le solde n'apparaît qu'après 20 ans, mais il pèse ensuite pour toujours.
    </>
  ),
  netMigration: (
    <>
      Entrées moins sorties, tous âges. Repères : <strong>+70 000</strong> = hypothèse INSEE,
      <strong> +176 000</strong> = moyenne observée 2023-2025. Effet <em>immédiat</em>, à l'inverse de la
      fécondité : les arrivants sont surtout des actifs, donc des cotisants tout de suite.
    </>
  ),
  productivity: (
    <>
      Rythme de hausse des salaires réels. Les pensions suivant les prix (pas les salaires), une productivité
      plus forte réduit les dépenses en part de PIB et améliore le solde. Faisceau COR&nbsp;: 0,7 à 1,3 %/an
      autour de 1,0 %.
    </>
  ),
  unemployment: (
    <>
      Part du potentiel de cotisants retirée du compte : les cotisants sont comptés × (1&nbsp;−&nbsp;u). Pour le
      scénario Pragmatique, le <em>chômage</em> est A+D ; B/C/E/F/G restent cependant pris en compte ici selon
      leur situation d'emploi et leurs heures travaillées. L'effet total A→G pondéré est ≈&nbsp;16,6&nbsp;% des
      actifs ; ce n'est donc pas un taux de chômage officiel. Le même effectif sans pondération donnerait 22,8&nbsp;%.
    </>
  ),
}

const RISK_HINTS: Record<string, React.ReactNode> = {
  realInterestRate: (
    <>
      Les déficits cumulés portent intérêt (et les réserves rapportent) : effet boule de neige sur le graphe «
      Solde cumulé ». Le solde annuel, comparable au COR, n'est pas modifié.
    </>
  ),
  workerExodus: (
    <>
      Émigration nette de jeunes actifs, retirée du solde migratoire : moins de cotisants aujourd'hui, moins
      de naissances demain. Tracée à part sur le graphe « Immigration ».
    </>
  ),
}

/**
 * Le contrôle segmenté « Clés en main / Sur mesure ». Deux boutons dans une rangée bordée plutôt que
 * `Tabs` : `toggle-group` n'est pas installé, et `Tabs` impliquerait des `TabsContent` + un focus
 * roving qu'on n'utilise pas. Même langage brutaliste que les onglets de vue, tricotés à la main.
 */
function ModeSwitch({
  mode,
  onPreset,
  onCustom,
}: {
  mode: ReformMode
  onPreset: () => void
  onCustom: () => void
}) {
  return (
    <div role="group" aria-label="Mode de réforme" className="flex border border-border">
      {(
        [
          ['preset', 'Clés en main', onPreset],
          ['custom', 'Sur mesure', onCustom],
        ] as const
      ).map(([value, label, handler]) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={mode === value ? 'default' : 'ghost'}
          aria-pressed={mode === value}
          className="flex-1 rounded-none"
          onClick={handler}
        >
          {label}
        </Button>
      ))}
    </div>
  )
}

/**
 * Le récapitulatif d'une réforme clés en main : uniquement les leviers qu'elle déplace, « avant →
 * après ». Des lignes plutôt que onze curseurs désactivés — un curseur posé sur sa valeur de
 * référence ne répond à rien, il ne peut pas montrer l'avant, et neuf curseurs à demi effacés dans
 * 280px se lisent « cassé » plutôt que « lecture seule ».
 */
function ReformRecap({ policy, basePolicy }: { policy: PolicyParams; basePolicy: PolicyParams }) {
  const rows = diffReformLevers(policy, basePolicy)
  if (rows.length === 0) {
    return (
      <p className="border-y border-border py-1.5 text-xs leading-snug text-muted-foreground">
        Cette réforme est le <strong className="font-medium">droit en vigueur</strong> : c'est la référence du
        modèle, elle ne déplace aucun levier.
      </p>
    )
  }
  return (
    <dl className="divide-y divide-border border-y border-border">
      {rows.map((r) => (
        <div key={r.key} className="flex flex-wrap items-baseline justify-between gap-x-2 py-1.5">
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className="text-xs font-medium tabular-nums">
            <span className="text-muted-foreground line-through decoration-1">{r.from}</span> → {r.to}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Le sort du calendrier de montée en charge, dit en une ligne. Deux faces seulement, dérivées de
 * `policy.schedule` — aucun état « origine » à tenir.
 */
function CalendarLine({
  policy,
  basePolicy,
  onRestoreCalendar,
}: {
  policy: PolicyParams
  basePolicy: PolicyParams
  onRestoreCalendar: () => void
}) {
  if (policy.schedule) {
    const summary = scheduleSummary(policy.schedule)
    return (
      <p className="text-xs leading-snug text-muted-foreground">
        Calendrier conservé{summary ? ` : ${summary}` : ' (montée en charge par génération)'}.
      </p>
    )
  }
  if (!basePolicy.schedule) return null
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      Calendrier abandonné : l'âge s'applique d'un coup à toutes les générations.{' '}
      <Button
        type="button"
        variant="link"
        size="xs"
        className="h-auto px-0 text-xs"
        onClick={onRestoreCalendar}
      >
        Revenir à la montée en charge du droit en vigueur
      </Button>
    </p>
  )
}

export function Levers({
  scenarioId,
  policy,
  basePolicy,
  horizon,
  reformKey,
  reformMode,
  reformName,
  presets,
  savedReforms,
  canSaveReforms,
  hypothesisChangedCount,
  onScenario,
  onPolicy,
  onHypothesis,
  onReform,
  onCustomMode,
  onPresetMode,
  onHorizon,
  onResetHypotheses,
  onResetReform,
  onRestoreCalendar,
  onReformName,
  onSaveReform,
  onDeleteReform,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState('')
  const reformChangedCount = diffReformLevers(policy, basePolicy).length
  const selected = presets[reformKey]
  // Ne jamais laisser le Select pointer un item qu'il ne rend pas : une clé `custom:` reçue d'un
  // autre appareil, ou une réforme qu'on vient de supprimer.
  const pickerValue = selected ? reformKey : ''
  const calendarDropped = !sameSchedule(policy.schedule, basePolicy.schedule)

  const leverSlider = (spec: (typeof REFORM_LEVER_SPECS)[number]) => (
    <Slider
      key={spec.key}
      label={spec.label}
      value={policy[spec.key] ?? 0}
      min={spec.min}
      max={spec.max}
      step={spec.step}
      fmt={spec.fmt}
      edit={spec.edit}
      onChange={(v) => onPolicy({ [spec.key]: v })}
      hint={REFORM_HINTS[spec.key]}
    />
  )

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
              {/* children override the selected item's label → on y colle l'état « modifié ».
                  Seules les HYPOTHÈSES comptent ici : une réforme sélectionnée ne salit pas le
                  jeu d'hypothèses, elle vit dans sa propre carte. */}
              <SelectValue>
                {SCENARIO_LABELS[scenarioId]}
                {hypothesisChangedCount > 0 && ' — modifié'}
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
          <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
            {SCENARIO_DESCRIPTIONS[scenarioId]}
          </p>
        </label>
        {hypothesisChangedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={onResetHypotheses}
          >
            Réinitialiser les hypothèses · {hypothesisChangedCount} modifiée
            {hypothesisChangedCount > 1 ? 's' : ''}
          </Button>
        )}
        <Slider
          label="Horizon"
          value={horizon}
          min={2030}
          max={2100}
          fmt={(v) => String(v)}
          // Seul curseur sans `LeverSpec` (ce n'est pas un levier de politique) : bornes et unité
          // de saisie à la main, sur place.
          edit={{ scale: 1, unit: 'année', decimals: 0 }}
          onChange={onHorizon}
        />
      </Card>

      {/* Carte 2 — les hypothèses, curseurs de plein droit. Chaque scénario n'est qu'un jeu de
          positions ici : les anciennes variantes INSEE (fécondité ±, migration ±, productivité
          COR ±) sont exactement ces curseurs déplacés. */}
      <Card className="gap-4 p-4">
        <Title>Hypothèses</Title>
        {HYPOTHESIS_LEVER_SPECS.map((spec) => (
          <Slider
            key={spec.key}
            label={spec.label}
            value={policy[spec.key] ?? 0}
            min={spec.min}
            max={spec.max}
            step={spec.step}
            fmt={spec.fmt}
            edit={spec.edit}
            onChange={(v) => onHypothesis({ [spec.key]: v })}
            hint={HYPOTHESIS_HINTS[spec.key]}
          />
        ))}
      </Card>

      {/* Carte 3 — les leviers de réforme, qui recalculent le solde à hypothèses données.
          Deux chemins, jamais mêlés : appliquer une réforme toute faite (récapitulatif en lecture
          seule, aucun curseur à interpréter) ou en composer une sur mesure aux curseurs. */}
      <Card className="gap-4 p-4">
        <Title>Leviers de réforme</Title>
        <ModeSwitch mode={reformMode} onPreset={onPresetMode} onCustom={onCustomMode} />

        {reformMode === 'preset' ? (
          <>
            <label className="block">
              <span className="text-sm text-muted-foreground">Réforme clés en main</span>
              <Select value={pickerValue} onValueChange={onReform}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Choisir une proposition…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Réformes de référence</SelectLabel>
                    {Object.entries(REFORM_PRESETS).map(([key, r]) => (
                      <SelectItem key={key} value={key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                  {savedReforms.length > 0 && (
                    <>
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Mes réformes</SelectLabel>
                        {savedReforms.map((r) => (
                          <SelectItem key={r.key} value={r.key}>
                            {r.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </>
                  )}
                </SelectContent>
              </Select>
              {selected && (
                <>
                  <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{selected.source}</p>
                  {/* Une loi monte en charge : le récapitulatif montre la cible, le calendrier dit
                      comment on y arrive. */}
                  {selected.schedule && scheduleSummary(selected.schedule) && (
                    <p className="mt-1 text-xs leading-snug font-medium">
                      Calendrier : {scheduleSummary(selected.schedule)}
                    </p>
                  )}
                </>
              )}
            </label>

            {selected ? (
              <>
                <ReformRecap policy={policy} basePolicy={basePolicy} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={onCustomMode}
                >
                  Partir de cette réforme →
                </Button>
              </>
            ) : (
              <p className="text-xs leading-snug text-muted-foreground">
                Choisissez une réforme pour voir ce qu'elle change, ou passez en{' '}
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-xs"
                  onClick={onCustomMode}
                >
                  sur mesure
                </Button>{' '}
                pour composer la vôtre.
              </p>
            )}
            <Hint>
              Une réforme clés en main est appliquée <strong>seule</strong> : ses leviers remplacent ceux déjà
              réglés, jamais ne s'y ajoutent — sinon le chiffrage affiché ne serait plus celui de la réforme
              qui porte son nom. Les hypothèses (fécondité, migration…) ne sont pas touchées.
            </Hint>
          </>
        ) : (
          <>
            {reformChangedCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={onResetReform}
              >
                Réinitialiser les leviers de réforme · {reformChangedCount} modifié
                {reformChangedCount > 1 ? 's' : ''}
              </Button>
            )}
            {REFORM_LEVER_SPECS.filter((s) => !s.advanced).map(leverSlider)}
            <CalendarLine policy={policy} basePolicy={basePolicy} onRestoreCalendar={onRestoreCalendar} />

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium select-none">
                <span className="inline-block transition-transform group-open:rotate-90">▸</span>
                Leviers avancés
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                {/* La règle d'indexation est un Select, pas un curseur : elle n'a donc pas de
                    `LeverSpec` et se glisse à la main juste avant la sous-indexation, son voisin
                    naturel (les deux parlent de la revalorisation des pensions). */}
                {REFORM_LEVER_SPECS.filter((s) => s.advanced).map((spec) =>
                  spec.key === 'underIndexation' ? (
                    <div key="indexation-block" className="flex flex-col gap-4">
                      <label className="block">
                        <span className="text-sm text-muted-foreground">Règle d'indexation</span>
                        <Select
                          value={policy.indexation}
                          onValueChange={(v) => onPolicy({ indexation: v as Indexation })}
                        >
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
                      {leverSlider(spec)}
                    </div>
                  ) : (
                    leverSlider(spec)
                  ),
                )}
              </div>
            </details>

            {/* Enregistrer sa réforme. Le calendrier n'en fait pas partie : une réforme sur mesure
                est une proposition (un delta plat), pas une loi (un calendrier par génération). */}
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {calendarDropped && policy.schedule && (
                <p className="text-xs leading-snug text-muted-foreground">
                  Le calendrier de montée en charge n'est pas enregistré : une réforme sur mesure est un delta
                  plat.
                </p>
              )}
              <label className="block">
                <span className="text-sm text-muted-foreground">Nom de ma réforme</span>
                <Input
                  className="mt-1"
                  value={reformName}
                  maxLength={MAX_NAME_LENGTH}
                  placeholder="Ma réforme"
                  disabled={!canSaveReforms}
                  onChange={(e) => onReformName(e.target.value)}
                />
              </label>
              {canSaveReforms ? (
                <Button
                  type="button"
                  size="sm"
                  className="w-full text-xs"
                  disabled={!reformName.trim() || reformChangedCount === 0}
                  onClick={() => onSaveReform(reformName)}
                >
                  Enregistrer
                </Button>
              ) : (
                <p className="text-xs leading-snug text-muted-foreground">
                  Enregistrement indisponible dans ce navigateur.
                </p>
              )}
              {reformChangedCount === 0 && canSaveReforms && (
                <p className="text-xs leading-snug text-muted-foreground">
                  Déplacez au moins un levier : une réforme identique à la référence n'aurait rien à dire.
                </p>
              )}

              {savedReforms.length > 0 && (
                <div className="mt-1">
                  <div className="text-xs text-muted-foreground">Mes réformes ({savedReforms.length})</div>
                  <ul className="mt-1 divide-y divide-border border-y border-border">
                    {savedReforms.map((r) => (
                      <li key={r.key} className="flex items-center justify-between gap-2 py-1">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                          title={`Appliquer « ${r.name} »`}
                          onClick={() => onReform(r.key)}
                        >
                          {r.name}
                        </button>
                        {confirmDelete === r.key ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="xs"
                            onClick={() => {
                              onDeleteReform(r.key)
                              setConfirmDelete('')
                            }}
                          >
                            Confirmer
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Supprimer « ${r.name} »`}
                            title={`Supprimer « ${r.name} »`}
                            onClick={() => setConfirmDelete(r.key)}
                          >
                            ×
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      {/* Carte 4 — risques macro propres au Pragmatique : finances publiques + fuite des actifs.
          Masquée pour les scénarios INSEE/COR, qui restent figés sur la référence. */}
      {scenarioId === 'pragmatique' && (
        <Card className="gap-4 p-4">
          <Title>Contexte & risques</Title>
          <p className="-mt-1 text-xs leading-snug text-muted-foreground">
            Spécifiques au scénario Pragmatique : les scénarios INSEE/COR n'en tiennent pas compte.
          </p>
          {RISK_LEVER_SPECS.map((spec) => (
            <Slider
              key={spec.key}
              label={spec.label}
              value={policy[spec.key] ?? 0}
              min={spec.min}
              max={spec.max}
              step={spec.step}
              fmt={spec.fmt}
              onChange={(v) => onHypothesis({ [spec.key]: v })}
              hint={RISK_HINTS[spec.key]}
            />
          ))}
        </Card>
      )}
    </>
  )
}

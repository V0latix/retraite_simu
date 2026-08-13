// Taxonomie des leviers + application d'une réforme clés en main.
//
// « Quelle carte de la sidebar possède quel levier » est une taxonomie PRODUIT, pas un contrat
// moteur : elle vit donc ici, à côté de REFORM_PRESETS, et non dans `src/engine/types.ts` qui reste
// framework-free et sans notion d'UI. Pur, sans React, sans JSX — `src/lib/share.ts` l'importe.
import { formatAge, scheduleSummary, type ReformPreset } from './reforms'
import { clamp } from '../lib/clamp'
import { parseFrNumber } from '../lib/format'
import type { Indexation, PolicyAnchor, PolicyParams } from '../engine/types'

/**
 * Les leviers que porte la carte « Leviers de réforme » — et EUX SEULS. Appliquer une réforme clés
 * en main est un REMPLACEMENT PROPRE de cette liste : tout ce qui n'y est pas lui est étranger.
 * `indexation` (string) en fait partie mais se traite à part ; `schedule` (tableau) aussi, mais il
 * est dérivé de la réforme, jamais réglé au curseur.
 */
export const REFORM_LEVER_KEYS = [
  'legalAge',
  'requiredQuarters',
  'contributionRate',
  'legalAgeLEShare',
  'underIndexation',
  'underIndexationYears',
  'pensionCap',
  'additionalResourcesPct',
  'frrFlowPct',
  'earlyRetirementShare',
] as const

/** Carte « Hypothèses » — un scénario n'est qu'un jeu de positions ici (SCENARIO_PRESETS). */
export const HYPOTHESIS_LEVER_KEYS = ['tfr', 'netMigration', 'productivity', 'unemployment'] as const

/** Carte « Contexte & risques » (scénario Pragmatique uniquement). */
export const RISK_LEVER_KEYS = ['realInterestRate', 'workerExodus'] as const

export type ReformLeverKey = (typeof REFORM_LEVER_KEYS)[number]
export type HypothesisLeverKey = (typeof HYPOTHESIS_LEVER_KEYS)[number]
export type RiskLeverKey = (typeof RISK_LEVER_KEYS)[number]

/** Quel côté de la carte « Leviers de réforme » est ouvert. */
export type ReformMode = 'preset' | 'custom'

export const INDEXATION_LABELS: Record<Indexation, string> = {
  prices: 'Prix',
  wages: 'Salaires',
  mix: 'Mixte',
}

/**
 * Spec d'un curseur de réforme. Source unique pour DEUX rendus : le curseur en mode sur mesure et
 * la ligne « avant → après » du récapitulatif en mode clés en main. Un seul `fmt` par levier, donc
 * les deux ne peuvent pas dire la même valeur de deux façons.
 * Les `hint` pédagogiques restent dans `Levers.tsx` : c'est du JSX, ça n'a rien à faire ici.
 */
/**
 * Comment la valeur se tape à la main, le champ de saisie derrière la valeur affichée.
 * `fmt` ne peut pas servir ici : il produit du texte de lecture, pas un nombre saisissable
 * (« aucun », « 64 ans 3 mois », « −50 000/an », espaces insécables), et beaucoup de leviers sont
 * stockés en fraction. D'où cette seconde description, minimale : `v * scale` est le nombre montré
 * dans le champ, et ce qu'on y tape repasse au modèle par une division.
 */
export interface EditSpec {
  /** Facteur modèle → saisie. 100 pour les taux stockés en fraction, 1 sinon. */
  scale: number
  /** Suffixe posé à droite du champ : l'unité dans laquelle on TAPE, pas celle de `fmt`. */
  unit: string
  /** Décimales à l'affichage du champ. La valeur saisie, elle, n'est pas arrondie. */
  decimals: number
}

/**
 * Le socle commun aux trois cartes de curseurs. `edit` est obligatoire : c'est ce qui rend
 * « chaque curseur est saisissable au clavier » décidable, dans le même esprit que les trois
 * listes closes de clés ci-dessus.
 */
interface SliderSpecBase {
  label: string
  min: number
  max: number
  step: number
  fmt: (v: number) => string
  edit: EditSpec
}

/** Bruit flottant en moins : sans ça un 27,3 % tapé s'écrirait `0.27300000000000002` dans l'URL. */
const round10 = (v: number) => Math.round(v * 1e10) / 1e10

/**
 * Valeur du modèle → texte du champ. Ni séparateur de milliers (on y tape, on n'y lit pas) ni
 * zéros terminaux : on veut « 64,25 » et « 64 », jamais « 64,00 ».
 */
export function toInput(v: number, edit: EditSpec): string {
  return String(Number(round10(v * edit.scale).toFixed(edit.decimals))).replace('.', ',')
}

/**
 * Texte du champ → valeur du modèle, ou `null` si ce n'est pas un nombre (l'appelant garde alors
 * la valeur courante). On clampe aux bornes mais on ne cale PAS sur le pas : pouvoir viser entre
 * deux crans est tout l'intérêt de la saisie. Le seul arrondi est celui de la granularité déclarée
 * (`decimals`), ce qui garde entiers ceux qui doivent l'être — un trimestre, un migrant, une année.
 */
export function fromInput(s: string, spec: { min: number; max: number; edit: EditSpec }): number | null {
  const n = parseFrNumber(s)
  if (n === null) return null
  return round10(clamp(Number(n.toFixed(spec.edit.decimals)) / spec.edit.scale, spec.min, spec.max))
}

export interface LeverSpec extends SliderSpecBase {
  key: ReformLeverKey
  /** Libellé court pour le récapitulatif (sidebar de 280px). Absent ⇒ `label`. */
  short?: string
  /** Replié dans le `<details>` « Leviers avancés » : seuls âge légal et cotisation restent visibles. */
  advanced?: boolean
}

const pct1 = (v: number) => `${(v * 100).toFixed(1).replace('.', ',')} %`

export const REFORM_LEVER_SPECS: readonly LeverSpec[] = [
  {
    key: 'legalAge',
    label: 'Âge légal de départ',
    short: 'Âge légal',
    min: 60,
    max: 70,
    step: 0.25,
    fmt: formatAge,
    edit: { scale: 1, unit: 'ans', decimals: 2 },
  },
  {
    key: 'contributionRate',
    label: 'Taux de cotisation',
    short: 'Cotisation',
    min: 0.2,
    max: 0.4,
    step: 0.005,
    fmt: (v) => `${(v * 100).toFixed(1).replace('.', ',')} %`,
    edit: { scale: 100, unit: '%', decimals: 2 },
  },
  {
    key: 'legalAgeLEShare',
    label: "Âge légal indexé sur l'espérance de vie",
    short: 'Âge indexé sur l’EV',
    min: 0,
    max: 1,
    step: 0.05,
    fmt: (v) => (v === 0 ? 'désactivé' : `${Math.round(v * 100)} %`),
    edit: { scale: 100, unit: '%', decimals: 0 },
    advanced: true,
  },
  {
    key: 'requiredQuarters',
    label: 'Durée requise',
    min: 160,
    max: 188,
    step: 1,
    fmt: (v) => `${v} trim.`,
    edit: { scale: 1, unit: 'trim.', decimals: 0 },
    advanced: true,
  },
  {
    key: 'pensionCap',
    label: 'Plafonnement des pensions',
    short: 'Plafonnement',
    min: 0,
    max: 6000,
    step: 100,
    fmt: (v) => (v === 0 ? 'aucun' : `${v.toLocaleString('fr-FR')} €/mois`),
    edit: { scale: 1, unit: '€/mois', decimals: 0 },
    advanced: true,
  },
  {
    key: 'underIndexation',
    label: 'Sous-indexation des pensions',
    short: 'Sous-indexation',
    min: 0,
    max: 0.015,
    step: 0.0025,
    fmt: (v) => (v === 0 ? 'aucune' : `−${(v * 100).toFixed(2).replace('.', ',')} pt/an`),
    // Se tape en POSITIF, comme le curseur qui va de 0 vers le haut : le « − » de `fmt` est le sens
    // du levier (« sous-indexation »), pas le signe de la valeur stockée.
    edit: { scale: 100, unit: 'pt/an', decimals: 2 },
    advanced: true,
  },
  {
    key: 'underIndexationYears',
    label: 'Durée de la sous-indexation',
    short: 'Durée sous-indexation',
    min: 0,
    max: 10,
    step: 1,
    fmt: (v) => (v === 0 ? 'aucune' : `${v} ans`),
    edit: { scale: 1, unit: 'ans', decimals: 0 },
    advanced: true,
  },
  {
    key: 'additionalResourcesPct',
    label: 'Recettes nouvelles (retraités / CSG)',
    short: 'Recettes nouvelles',
    min: 0,
    max: 0.02,
    step: 0.0025,
    fmt: (v) => (v === 0 ? 'aucune' : `+${(v * 100).toFixed(2).replace('.', ',')} pt PIB`),
    edit: { scale: 100, unit: 'pt PIB', decimals: 2 },
    advanced: true,
  },
  {
    key: 'frrFlowPct',
    label: 'Abondement du FRR (réserves)',
    short: 'Abondement FRR',
    min: 0,
    max: 0.01,
    step: 0.001,
    fmt: (v) => (v === 0 ? 'aucun' : `+${(v * 100).toFixed(1).replace('.', ',')} pt PIB/an`),
    edit: { scale: 100, unit: 'pt PIB/an', decimals: 2 },
    advanced: true,
  },
  {
    key: 'earlyRetirementShare',
    label: 'Départs anticipés (carrières longues)',
    short: 'Départs anticipés',
    min: 0,
    max: 0.3,
    step: 0.05,
    fmt: (v) => (v === 0 ? 'aucun' : `${Math.round(v * 100)} %`),
    edit: { scale: 100, unit: '%', decimals: 0 },
    advanced: true,
  },
]

/** Specs des hypothèses et des risques — mêmes bornes qu'avant, pour les cartes voisines. */
export const HYPOTHESIS_LEVER_SPECS: readonly (SliderSpecBase & { key: HypothesisLeverKey })[] = [
  {
    key: 'tfr',
    label: 'Fécondité',
    min: 1.2,
    max: 2.2,
    step: 0.05,
    fmt: (v) => `${v.toFixed(2).replace('.', ',')} enf./f.`,
    edit: { scale: 1, unit: 'enf./f.', decimals: 2 },
  },
  {
    key: 'netMigration',
    label: 'Solde migratoire',
    min: 0,
    max: 250000,
    step: 5000,
    fmt: (v) => `+${Math.round(v / 1000)} 000/an`,
    edit: { scale: 1, unit: '/an', decimals: 0 },
  },
  {
    key: 'productivity',
    label: 'Croissance de la productivité',
    min: 0.004,
    max: 0.02,
    step: 0.001,
    fmt: (v) => `${(v * 100).toFixed(1).replace('.', ',')} %/an`,
    edit: { scale: 100, unit: '%/an', decimals: 2 },
  },
  {
    key: 'unemployment',
    label: 'Effet sur les cotisants',
    min: 0.045,
    max: 0.25,
    step: 0.005,
    fmt: pct1,
    edit: { scale: 100, unit: '%', decimals: 2 },
  },
]

export const RISK_LEVER_SPECS: readonly (SliderSpecBase & { key: RiskLeverKey })[] = [
  {
    key: 'realInterestRate',
    label: "Taux d'intérêt sur la dette",
    min: 0,
    max: 0.04,
    step: 0.001,
    fmt: pct1,
    edit: { scale: 100, unit: '%', decimals: 2 },
  },
  {
    key: 'workerExodus',
    label: 'Exode des jeunes actifs (25-40 ans)',
    min: 0,
    max: 100000,
    step: 5000,
    fmt: (v) => (v === 0 ? 'aucun' : `−${Math.round(v / 1000)} 000/an`),
    // Positif à la saisie, comme le curseur : le « − » de `fmt` dit le sens (un exode), pas le signe.
    edit: { scale: 1, unit: '/an', decimals: 0 },
  },
]

const SPEC_BY_KEY: Record<ReformLeverKey, LeverSpec> = Object.fromEntries(
  REFORM_LEVER_SPECS.map((s) => [s.key, s]),
) as Record<ReformLeverKey, LeverSpec>

export function reformLeverSpec(key: ReformLeverKey): LeverSpec {
  return SPEC_BY_KEY[key]
}

/** Les leviers de réforme de la référence, prêts à écraser ceux de l'utilisateur. */
export function reformDefaults(base: PolicyParams): Partial<PolicyParams> {
  const out: Partial<PolicyParams> = { indexation: base.indexation }
  for (const k of REFORM_LEVER_KEYS) out[k] = base[k]
  return out
}

/** Le pendant pour les cartes Scénario et Contexte & risques : `schedule` n'en fait pas partie,
 *  donc réinitialiser les hypothèses ne ressuscite pas un calendrier que l'utilisateur a abandonné. */
export function hypothesisDefaults(base: PolicyParams): Partial<PolicyParams> {
  const out: Partial<PolicyParams> = {}
  for (const k of [...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS]) out[k] = base[k]
  return out
}

/**
 * Appliquer une réforme clés en main = REMPLACER, jamais empiler. On repart des leviers de réforme
 * de la référence, PUIS on applique le delta du preset. Sans ce reset, « Réforme 2023 » choisie
 * après un essai de plafonnement chiffrerait « réforme 2023 + plafond » alors qu'elle en porte le
 * nom — et le KPI « impact de vos leviers » mentirait sur ce qu'il désigne.
 *
 * Les hypothèses (tfr, netMigration, productivity, unemployment) et les risques (realInterestRate,
 * workerExodus) de `policy` sont conservés tels quels : ils appartiennent aux cartes Scénario et
 * Contexte & risques, une réforme ne les déplace pas.
 */
export function applyReform(policy: PolicyParams, base: PolicyParams, preset: ReformPreset): PolicyParams {
  const flatAge = preset.delta.legalAge !== undefined || preset.delta.requiredQuarters !== undefined
  return {
    ...policy,
    ...reformDefaults(base),
    ...preset.delta,
    // Le calendrier suit l'âge, en trois cas :
    //  · le preset apporte le sien (une loi) → il gagne ;
    //  · il pose un âge ou une durée À PLAT sans calendrier (une proposition) → on abandonne celui
    //    du droit en vigueur, sinon le calendrier avalerait silencieusement le levier (même règle
    //    que `buildHypotheses`, loader.ts, et que `setP`, App.tsx) ;
    //  · il ne touche NI l'âge NI la durée (une recette, une sous-indexation) → le droit en vigueur
    //    reste en place. C'est le point qui manquait : `schedule: preset.schedule` inconditionnel
    //    abolissait la montée en charge 2023 et appliquait 64 ans dès 2025 à des générations encore
    //    à 62-63 ans, chiffrant « abattement + réforme 2023 accélérée ».
    schedule: preset.schedule ?? (flatAge ? undefined : base.schedule),
  }
}

/** Une ligne du récapitulatif « avant → après ». */
export interface LeverDiff {
  key: ReformLeverKey | 'indexation' | 'schedule'
  label: string
  from: string
  to: string
}

/**
 * Deux calendriers sont le même s'ils DISENT la même chose : `REFORM_PRESETS['reforme-2023']
 * .schedule` et `DEFAULT_POLICY.schedule` sont deux littéraux distincts au contenu identique
 * (validation.test.ts les compare avec `toEqual`, pas `toBe`). Comparer les références ferait
 * apparaître une ligne « Calendrier » fantôme sur le droit en vigueur.
 */
export function sameSchedule(a?: PolicyAnchor[], b?: PolicyAnchor[]): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

function scheduleCell(s: PolicyAnchor[] | undefined): string {
  if (!s) return 'aucun (application immédiate)'
  const age = scheduleSummary(s)
  if (age) return age
  // Âge plat : seule la durée requise monte (cas « avant 2023 », loi Touraine).
  const withQ = s.filter((a) => a.requiredQuarters != null)
  if (withQ.length >= 2) {
    const [first, last] = [withQ[0], withQ[withQ.length - 1]]
    if (first.requiredQuarters !== last.requiredQuarters) {
      return `montée en charge de la durée requise (${first.requiredQuarters} → ${last.requiredQuarters} trim.)`
    }
  }
  return 'montée en charge par génération'
}

/**
 * Le récapitulatif en lecture seule : uniquement les leviers que la réforme déplace VRAIMENT,
 * « avant → après ». C'est aussi le compteur du bouton de réinitialisation de la carte. Une seule
 * dérivation, deux usages — donc pas de récap qui contredise son compteur.
 */
export function diffReformLevers(policy: PolicyParams, base: PolicyParams): LeverDiff[] {
  const out: LeverDiff[] = []
  for (const s of REFORM_LEVER_SPECS) {
    const to = policy[s.key] ?? 0
    const from = base[s.key] ?? 0
    if (to !== from)
      out.push({
        key: s.key,
        label: s.short ?? s.label,
        from: s.fmt(from),
        to: s.fmt(to),
      })
  }
  if (policy.indexation !== base.indexation) {
    out.push({
      key: 'indexation',
      label: 'Indexation',
      from: INDEXATION_LABELS[base.indexation],
      to: INDEXATION_LABELS[policy.indexation],
    })
  }
  if (!sameSchedule(policy.schedule, base.schedule)) {
    out.push({
      key: 'schedule',
      label: 'Calendrier',
      from: scheduleCell(base.schedule),
      to: scheduleCell(policy.schedule),
    })
  }
  return out
}

/**
 * Le delta enregistrable d'une réforme sur mesure : les mêmes écarts, en valeurs. **Jamais de
 * `schedule`** — une réforme sur mesure est une proposition (un delta plat), pas une loi (un
 * calendrier), cf. l'invariant « a law is a calendar keyed by GÉNÉRATION » du CLAUDE.md.
 *
 * Omettre les leviers non déviants fait disparaître un piège : une réforme forkée dont le curseur
 * d'âge est resté à 64 n'enregistre pas `legalAge: 64`, donc la ré-appliquer prend la branche
 * « ni l'âge ni la durée » d'`applyReform` et conserve la montée en charge du droit en vigueur.
 */
export function extractReformDelta(policy: PolicyParams, base: PolicyParams): Partial<PolicyParams> {
  const out: Partial<PolicyParams> = {}
  for (const k of REFORM_LEVER_KEYS) {
    if ((policy[k] ?? 0) !== (base[k] ?? 0)) out[k] = policy[k]
  }
  if (policy.indexation !== base.indexation) out.indexation = policy.indexation
  return out
}

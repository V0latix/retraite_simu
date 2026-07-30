// URL state sharing — native, zero-dependency (ponytail).
import { DEFAULT_POLICY } from '../data/loader'
import {
  HYPOTHESIS_LEVER_KEYS,
  REFORM_LEVER_KEYS,
  RISK_LEVER_KEYS,
  applyReform,
  diffReformLevers,
  type ReformMode,
} from '../data/reformLevers'
import { REFORM_PRESETS } from '../data/reforms'
import { SCENARIO_PRESETS } from '../data/scenarioPresets'
import { SCENARIO_IDS, type ScenarioId } from '../data/schema'
import { CUSTOM_KEY_PREFIX, normalizeName } from './customReforms'
import type { Indexation, PolicyParams } from '../engine/types'

export type View = 'macro' | 'micro' | 'comparaison' | 'stochastique'

export interface AppState {
  view: View
  scenarioId: ScenarioId
  horizon: number
  policy: PolicyParams
  /** Réforme sélectionnée ('' = aucune). Une clé de REFORM_PRESETS, ou `custom:xxxx` — une réforme
   *  enregistrée, qui peut être inconnue de CET appareil (c'est App, avec le store local, qui
   *  tranche). Le calendrier étant un tableau, il ne tient pas dans les params : on le reconstruit
   *  ici via `applyReform`, exactement comme le fait un clic. */
  reformKey: string
  /** Quel côté de la carte « Leviers de réforme » est ouvert. État de vue, pas d'état de modèle :
   *  « je n'ai encore rien choisi » et « je règle à la main » sont deux situations différentes. */
  reformMode: ReformMode
  /** Nom porté par le lien (`rn`) : le seul morceau d'une réforme enregistrée qui ne tient pas déjà
   *  dans les params numériques, donc le seul à devoir voyager séparément. */
  reformName?: string
}

const VIEWS: View[] = ['macro', 'micro', 'comparaison', 'stochastique']
const INDEXATIONS: Indexation[] = ['prices', 'wages', 'mix']
/** Champs numériques de `PolicyParams`, encodés par leur nom. `indexation` (string) se traite à
 *  part, `schedule` (tableau) se reconstruit. Dérivé de la taxonomie des cartes : un levier ajouté
 *  à une carte atterrit dans l'URL sans qu'on ait à y penser. */
const POLICY_NUM_KEYS = [...REFORM_LEVER_KEYS, ...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS] as const

/** How many levers the user moved away from the scenario's own baseline (drives the KPI). */
export function countChangedLevers(policy: PolicyParams, base: PolicyParams): number {
  let n = policy.indexation !== base.indexation ? 1 : 0
  for (const k of POLICY_NUM_KEYS) if ((policy[k] ?? 0) !== (base[k] ?? 0)) n++
  return n
}

/** Les seules déviations que porte la carte Scénario (+ Contexte & risques) : c'est ce compteur qui
 *  a le droit de faire dire « — modifié » au sélecteur de scénario. Choisir « Retour à 60 ans » ne
 *  déplace aucune hypothèse et ne doit donc pas le salir. */
export function countChangedHypotheses(policy: PolicyParams, base: PolicyParams): number {
  let n = 0
  for (const k of [...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS]) {
    if ((policy[k] ?? 0) !== (base[k] ?? 0)) n++
  }
  return n
}

export function encodeState(s: AppState): string {
  const p = new URLSearchParams()
  p.set('v', s.view)
  p.set('s', s.scenarioId)
  p.set('h', String(s.horizon))
  if (s.reformKey) p.set('r', s.reformKey)
  if (s.reformMode === 'custom') p.set('m', 'c')
  if (s.reformName) p.set('rn', s.reformName)
  // Le sort du calendrier, en un bit. Hors preset intégré les deux seuls calendriers possibles sont
  // celui du droit en vigueur et aucun : `cal=0` dit « abandonné ». Sans lui, bouger le seul curseur
  // de cotisation puis recharger l'URL que l'app vient d'écrire changeait le solde 2025-2031 —
  // `setP` gardait le calendrier, `decodeState` ne savait pas le redire.
  if (!REFORM_PRESETS[s.reformKey] && s.policy.schedule === undefined) p.set('cal', '0')
  p.set('idx', s.policy.indexation)
  for (const k of POLICY_NUM_KEYS) {
    const v = s.policy[k]
    if (v != null) p.set(k, String(v))
  }
  return p.toString()
}

export function decodeState(p: URLSearchParams): AppState {
  const num = (key: string, fallback: number): number => {
    const n = Number(p.get(key))
    return p.has(key) && Number.isFinite(n) ? n : fallback
  }
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = p.get(key) as T | null
    return v != null && allowed.includes(v) ? v : fallback
  }
  // Le scénario positionne les curseurs (§ SCENARIO_PRESETS), la réforme applique ses leviers et son
  // calendrier par-dessus via `applyReform` — la MÊME fonction que le clic, pour qu'un lien et un
  // clic ne puissent plus diverger. Les params explicites gagnent ensuite sur les deux.
  const scenarioId = oneOf('s', SCENARIO_IDS, 'central')
  const base: PolicyParams = { ...DEFAULT_POLICY, ...SCENARIO_PRESETS[scenarioId] }
  const raw = p.get('r') ?? ''
  const builtin = REFORM_PRESETS[raw]
  // Une clé `custom:` est conservée telle quelle : rien à appliquer de toute façon, les params
  // numériques SONT la vérité. C'est App qui dira si cet appareil connaît cette réforme.
  const reformKey = builtin || raw.startsWith(CUSTOM_KEY_PREFIX) ? raw : ''
  const policy: PolicyParams = {
    ...(builtin
      ? applyReform(base, base, builtin)
      : { ...base, schedule: p.get('cal') === '0' ? undefined : base.schedule }),
    indexation: oneOf('idx', INDEXATIONS, DEFAULT_POLICY.indexation),
  }
  for (const k of POLICY_NUM_KEYS) {
    if (p.has(k)) {
      const n = Number(p.get(k))
      if (Number.isFinite(n)) policy[k] = n
    }
  }
  const reformMode: ReformMode = builtin
    ? 'preset'
    : p.get('m') === 'c' || reformKey
      ? 'custom'
      : // Repli pour les liens frappés avant l'existence de `m` : des leviers déviants sans `r` ni `m`
        // décrivent forcément un réglage manuel. Ouvrir sur « Clés en main » afficherait un sélecteur
        // vide devant une courbe personnalisée, ce qui se lit comme un bug.
        diffReformLevers(policy, base).length > 0
        ? 'custom'
        : 'preset'
  const reformName = normalizeName(p.get('rn') ?? '')
  return {
    view: oneOf('v', VIEWS, 'macro'),
    scenarioId,
    horizon: num('h', 2070),
    policy,
    reformKey,
    reformMode,
    ...(reformName ? { reformName } : {}),
  }
}

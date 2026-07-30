// Réformes sur mesure enregistrées sur l'appareil. Premier (et seul) usage de localStorage du
// projet : il n'y a pas de backend, une réforme maison n'a donc pas d'autre endroit où vivre.
//
// Trois règles, parce qu'un store local est une entrée non fiable comme une autre :
//  · aucun accès à l'import (le module est importé par des tests Node, où localStorage n'existe pas) ;
//  · rien ne jette jamais — Safari en navigation privée jette sur `setItem`, le quota aussi ;
//  · tout ce qui sort du store est revalidé et borné : un localStorage édité à la main ne doit pas
//    pouvoir sortir le moteur de ses plages, ni ressusciter un calendrier (§ delta plat).
import { clamp } from './clamp'
import { REFORM_LEVER_KEYS, reformLeverSpec } from '../data/reformLevers'
import type { ReformPreset } from '../data/reforms'
import type { Indexation, PolicyParams } from '../engine/types'

/** Préfixe des clés locales. Aucune des clés de REFORM_PRESETS ne contient ':' (garde-fou testé),
 *  donc une réforme enregistrée ne peut pas masquer « Réforme 2023 ». */
export const CUSTOM_KEY_PREFIX = 'custom:'
const STORAGE_KEY = 'retraite_simu.customReforms'
const SCHEMA_VERSION = 1
export const MAX_CUSTOM_REFORMS = 20
export const MAX_NAME_LENGTH = 60

const INDEXATIONS: Indexation[] = ['prices', 'wages', 'mix']

export interface CustomReform {
  /** `custom:xxxx` — c'est cet identifiant qui voyage dans l'URL (`r=`). */
  key: string
  name: string
  /** Delta plat, restreint à REFORM_LEVER_KEYS ∪ {indexation}. Jamais de `schedule`. */
  delta: Partial<PolicyParams>
  savedAt: number
}

interface StoreFile {
  version: number
  reforms: CustomReform[]
}

/** Accesseur PARESSEUX : `globalThis.localStorage` jette dans certains contextes, et n'existe pas
 *  sous Node. C'est aussi ce qui rend le module testable en stubbant le global. */
function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function isStorageAvailable(): boolean {
  return storage() !== null
}

/** Nom affichable : espaces repliés, borné. Vide ⇒ chaîne vide (l'appelant refuse d'enregistrer). */
export function normalizeName(raw: string): string {
  // Les caractères de contrôle partent d'abord : ils viennent de l'URL (`rn=`) ou d'un localStorage
  // édité à la main. Écrits en \u pour que le fichier reste lisible dans un éditeur.
  return (
    raw
      // oxlint-disable-next-line no-control-regex -- c'est le but : on assainit une entrée non fiable
      .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_NAME_LENGTH)
  )
}

/** Ne garde que des leviers de réforme finis et dans leurs bornes. Jette tout le reste — dont
 *  `schedule`, qu'une réforme sur mesure ne porte pas. */
export function sanitizeDelta(raw: unknown): Partial<PolicyParams> {
  if (typeof raw !== 'object' || raw === null) return {}
  const src = raw as Record<string, unknown>
  const out: Partial<PolicyParams> = {}
  for (const k of REFORM_LEVER_KEYS) {
    const v = src[k]
    if (typeof v !== 'number' || !Number.isFinite(v)) continue
    const spec = reformLeverSpec(k)
    out[k] = clamp(v, spec.min, spec.max)
  }
  if (typeof src.indexation === 'string' && INDEXATIONS.includes(src.indexation as Indexation)) {
    out.indexation = src.indexation as Indexation
  }
  return out
}

function sanitizeEntry(raw: unknown): CustomReform | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.key !== 'string' || !r.key.startsWith(CUSTOM_KEY_PREFIX)) return null
  const name = typeof r.name === 'string' ? normalizeName(r.name) : ''
  if (!name) return null
  const savedAt = typeof r.savedAt === 'number' && Number.isFinite(r.savedAt) ? r.savedAt : 0
  return { key: r.key, name, delta: sanitizeDelta(r.delta), savedAt }
}

export function loadCustomReforms(): CustomReform[] {
  const s = storage()
  if (!s) return []
  let parsed: unknown
  try {
    const raw = s.getItem(STORAGE_KEY)
    if (!raw) return []
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const file = parsed as Partial<StoreFile>
  if (file.version !== SCHEMA_VERSION || !Array.isArray(file.reforms)) return []
  // Une entrée corrompue est jetée seule : perdre les 19 autres pour une virgule serait pire.
  return file.reforms.map(sanitizeEntry).filter((r): r is CustomReform => r !== null)
}

function write(reforms: CustomReform[]): CustomReform[] {
  const s = storage()
  // On renvoie la liste voulue même si l'écriture échoue (quota, navigation privée) : la session
  // reste cohérente, seule la persistance manque.
  if (s) {
    try {
      s.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: SCHEMA_VERSION,
          reforms,
        } satisfies StoreFile),
      )
    } catch {
      /* quota / navigation privée — silencieux à dessein */
    }
  }
  return reforms
}

function newKey(): string {
  return `${CUSTOM_KEY_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Enregistre (ou met à jour) une réforme sur mesure et renvoie la liste résultante.
 * Réenregistrer un nom déjà pris **écrase l'entrée en conservant sa clé** : c'est le workflow
 * d'édition, et les liens déjà partagés continuent de la désigner.
 */
export function saveCustomReform(name: string, delta: Partial<PolicyParams>): CustomReform[] {
  const clean = normalizeName(name)
  if (!clean) return loadCustomReforms()
  const list = loadCustomReforms()
  const entry: CustomReform = {
    key: list.find((r) => r.name === clean)?.key ?? newKey(),
    name: clean,
    delta: sanitizeDelta(delta),
    savedAt: Date.now(),
  }
  const next = [...list.filter((r) => r.key !== entry.key), entry]
  return write(next.slice(Math.max(0, next.length - MAX_CUSTOM_REFORMS)))
}

export function deleteCustomReform(key: string): CustomReform[] {
  return write(loadCustomReforms().filter((r) => r.key !== key))
}

const savedOn = (ms: number) =>
  ms > 0
    ? new Date(ms).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null

/** Une réforme enregistrée se comporte exactement comme un preset : même canal, même récap. */
export function toReformPreset(r: CustomReform): ReformPreset {
  const on = savedOn(r.savedAt)
  return {
    label: r.name,
    source:
      `Réforme sur mesure${on ? `, enregistrée le ${on}` : ''} sur cet appareil. Elle n'existe que ` +
      'pour vous, mais le lien de partage emporte ses réglages.',
    delta: r.delta,
  }
}

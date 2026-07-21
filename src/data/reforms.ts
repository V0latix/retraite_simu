import { DEFAULT_POLICY } from './loader'
import type { PolicyParams } from '../engine/types'

// « Réformes clés en main » — chaque proposition du débat 2025 est un delta de PolicyParams,
// exactement comme un slider (même canal onPolicy). Aucune mécanique moteur nouvelle : le solde
// se recalcule via project(). La source (parti/rapport) est affichée sous le sélecteur.
// ponytail: donnée pure, zéro branche moteur.
export interface ReformPreset {
  label: string
  source: string
  delta: Partial<PolicyParams>
}

export const REFORM_PRESETS: Record<string, ReformPreset> = {
  'retour-62': {
    label: 'Retour à 62 ans',
    source: 'PS — abrogation du recul à 64 ans (réforme 2023).',
    delta: { legalAge: 62 },
  },
  'retour-60': {
    label: 'Retour à 60 ans',
    source: 'NFP / LFI — retraite à 60 ans à taux plein.',
    delta: { legalAge: 60 },
  },
  'suspension-2023': {
    label: 'Suspension de la réforme 2023',
    source:
      'Actualité 2025 — âge légal figé à 62 ans. Approximation : le moteur applique 62 à plat (pas de fenêtre 2023-2028).',
    delta: { legalAge: 62 },
  },
  'annee-blanche': {
    label: 'Année blanche (gel des pensions)',
    source:
      'Piste d’équilibrage — pensions gelées ~1 an. En euros constants, ≈ −2 pt (inflation) sur la revalorisation.',
    delta: { underIndexation: 0.02, underIndexationYears: 1 },
  },
  'sous-indexation': {
    label: 'Sous-indexation des pensions',
    source: 'Piste d’équilibrage récurrente — pensions « prix −1 pt/an » pendant 5 ans.',
    delta: { underIndexation: 0.01, underIndexationYears: 5 },
  },
  'plus-cotisation': {
    label: '+2 pts de cotisation',
    source: 'Levier de recette — hausse du taux de cotisation retraite de 2 points.',
    delta: { contributionRate: DEFAULT_POLICY.contributionRate + 0.02 },
  },
}

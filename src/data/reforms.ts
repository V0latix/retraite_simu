import { DEFAULT_POLICY } from './loader'
import type { PolicyAnchor, PolicyParams } from '../engine/types'

// « Réformes clés en main » — chaque proposition du débat 2025 est un delta de PolicyParams,
// exactement comme un slider (même canal onPolicy). Aucune mécanique moteur nouvelle : le solde
// se recalcule via project(). La source (parti/rapport) est affichée sous le sélecteur.
// ponytail: donnée pure, zéro branche moteur.
//
// Un texte de loi, lui, monte en charge par générations : `schedule` porte ce calendrier, exprimé
// par année de liquidation (les ancres sont interpolées linéairement par le moteur). `delta` reste
// l'état final — il positionne les curseurs et sert de repli quand l'utilisateur casse le calendrier.
export interface ReformPreset {
  label: string
  source: string
  delta: Partial<PolicyParams>
  schedule?: PolicyAnchor[]
}

export const REFORM_PRESETS: Record<string, ReformPreset> = {
  'avant-2023': {
    label: 'Avant la réforme 2023 (loi Touraine)',
    source:
      'Contrefactuel — droit applicable avant le 1ᵉʳ septembre 2023 : âge légal 62 ans, durée requise ' +
      'montant d’un trimestre toutes les trois générations (loi Touraine du 20 janvier 2014), 172 trimestres ' +
      'à la génération 1973. C’est la référence pour lire l’effet de la réforme 2023 : l’écart entre ce ' +
      'scénario et le droit en vigueur vaut ≈ 14 Md€ par an à l’horizon 2030, dans la fourchette des ' +
      'chiffrages publiés (10 Md€ Cour des comptes, 17,7 Md€ étude d’impact).',
    delta: { legalAge: 62, requiredQuarters: 172 },
    schedule: [
      { year: 2025, legalAge: 62, requiredQuarters: 168 }, // gén. 1963
      { year: 2029, legalAge: 62, requiredQuarters: 170 }, // gén. 1967
      { year: 2035, legalAge: 62, requiredQuarters: 172 }, // gén. 1973, cible Touraine
    ],
  },
  'reforme-2023': {
    label: 'Réforme 2023 (loi du 14 avril 2023) — droit en vigueur',
    source:
      'Loi n° 2023-270 du 14 avril 2023 — âge légal 62 → 64 ans par paliers de +3 mois par génération ' +
      '(gén. sept. 1961 → 1968, cible atteinte en 2032), et accélération Touraine : 172 trimestres dès la ' +
      'génération 1965 au lieu de 1973. C’est la référence du modèle : la projection COR de juin 2025 sur ' +
      'laquelle il est calé suppose déjà cette loi appliquée, montée en charge comprise — la remettre en ' +
      'calendrier ici la compterait deux fois.',
    delta: { legalAge: 64, requiredQuarters: 172 },
    // ponytail: pas de `schedule` — la montée en charge 2023-2032 est déjà dans le calage COR
    // (corReference.json = droit en vigueur). Le calendrier ne sert qu'aux écarts À ce droit.
  },
  'suspension-2026': {
    label: 'Suspension de la réforme (LFSS 2026)',
    source:
      'Loi n° 2025-1403 du 30 décembre 2025 (LFSS 2026), art. 105 — âge légal figé à 62 ans 9 mois pour ' +
      'les pensions prenant effet à partir du 1ᵉʳ septembre 2026 ; 64 ans repoussé à la génération 1969. ' +
      'La fenêtre de gel se referme au 1ᵉʳ janvier 2028 : le modèle retient la lettre du texte (gel, puis ' +
      'reprise du calendrier et retour à 64 ans en 2033), l’après-2028 restant une variable politique ouverte. ' +
      'Le curseur affiche 64 ans, la cible d’arrivée ; c’est le calendrier qui porte le creux. Le modèle chiffre ' +
      'le gel à ≈ 7 Md€ en 2027, au-dessus de l’estimation gouvernementale (1,8 Md€) : il compte l’effet sur ' +
      'tout le stock de 62-64 ans, là où le chiffrage budgétaire ne retient que les liquidations décalées.',
    delta: { legalAge: 64, requiredQuarters: 172 },
    schedule: [
      // 2025 = la référence : le gel ne s'applique qu'aux pensions prenant effet à partir du
      // 01/09/2026. Sans cette ancre, l'interpolation clamperait le creux jusqu'en 2025.
      { year: 2025, legalAge: 64, requiredQuarters: 172 },
      { year: 2026, legalAge: 62.75, requiredQuarters: 170 },
      { year: 2028, legalAge: 62.75, requiredQuarters: 171 }, // fin du gel
      { year: 2029, legalAge: 63.25, requiredQuarters: 172 },
      { year: 2033, legalAge: 64, requiredQuarters: 172 }, // gén. 1969
    ],
  },
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

/** « 62 ans 9 mois » — l'âge légal se lit en années et trimestres, jamais en décimales. */
export function formatAge(age: number): string {
  const years = Math.floor(age)
  const months = Math.round((age - years) * 12)
  return months === 0 ? `${years} ans` : `${years} ans ${months} mois`
}

/**
 * Résumé lisible d'un calendrier : « 62 ans 9 mois en 2026 → 64 ans en 2033 ».
 * On part du point le plus bas, pas de la première ancre : une suspension commence et finit à
 * la cible, son creux est au milieu — la lire par ses extrémités ne dirait rien.
 */
export function scheduleSummary(schedule: PolicyAnchor[]): string | null {
  const withAge = schedule.filter((a) => a.legalAge != null)
  if (withAge.length < 2) return null
  const last = withAge[withAge.length - 1]
  const low = withAge.reduce((lo, a) => (a.legalAge! < lo.legalAge! ? a : lo), withAge[0])
  if (low.legalAge === last.legalAge) return null // âge plat : rien à étaler
  return `${formatAge(low.legalAge!)} en ${low.year} → ${formatAge(last.legalAge!)} en ${last.year}`
}

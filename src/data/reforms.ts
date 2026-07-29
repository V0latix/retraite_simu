import { DEFAULT_POLICY } from './loader'
import type { PolicyAnchor, PolicyParams } from '../engine/types'

// « Réformes clés en main » — chaque proposition du débat 2025 est un delta de PolicyParams,
// exactement comme un slider (même canal onPolicy). Aucune mécanique moteur nouvelle : le solde
// se recalcule via project(). La source (parti/rapport) est affichée sous le sélecteur.
// ponytail: donnée pure, zéro branche moteur.
//
// Un texte de loi, lui, monte en charge par générations : `schedule` porte ce calendrier, exprimé
// par ANNÉE DE NAISSANCE — c'est ainsi que les lois retraite sont écrites, et c'est ainsi que le
// moteur le résout (voir HypothesisSet.cohortPolicy). Les ancres sont interpolées linéairement.
// `delta` reste l'état final — il positionne les curseurs et sert de repli quand l'utilisateur
// casse le calendrier en bougeant le curseur d'âge.
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
    // Âge plat à 62 ans ; seule la durée requise monte, d'un trimestre toutes les trois
    // générations. ponytail: 6 ancres au lieu des 16 générations — l'interpolation décale d'un
    // trimestre au plus, invisible après l'élasticité quartersAgeShare (0,125 an/trimestre).
    schedule: [
      { generation: 1958, legalAge: 62, requiredQuarters: 167 },
      { generation: 1961, legalAge: 62, requiredQuarters: 168 },
      { generation: 1964, legalAge: 62, requiredQuarters: 169 },
      { generation: 1967, legalAge: 62, requiredQuarters: 170 },
      { generation: 1970, legalAge: 62, requiredQuarters: 171 },
      { generation: 1973, legalAge: 62, requiredQuarters: 172 }, // cible Touraine
    ],
  },
  'reforme-2023': {
    label: 'Réforme 2023 (loi du 14 avril 2023) — droit en vigueur',
    source:
      'Loi n° 2023-270 du 14 avril 2023 — âge légal 62 → 64 ans par paliers de +3 mois par génération ' +
      '(gén. sept. 1961 → 1968, cible atteinte en 2032), et accélération Touraine : 172 trimestres dès la ' +
      'génération 1965 au lieu de 1973. C’est la référence du modèle — la projection COR de juin 2025 sur ' +
      'laquelle il est calé suppose cette loi appliquée, montée en charge comprise. Le calendrier ci-dessous ' +
      'est donc celui du droit en vigueur : c’est lui que le calage COR absorbe, et c’est de lui que les ' +
      'autres propositions s’écartent.',
    delta: { legalAge: 64, requiredQuarters: 172 },
    // Le calendrier légal, génération par génération. Il est aussi celui de DEFAULT_POLICY : la
    // calibration COR (buildCorCalibration) est construite dessus, donc la référence reste calée
    // — ce qui change, c'est que 2025-2031 n'applique plus 64 ans à des générations encore à 62-63.
    schedule: [
      { generation: 1960, legalAge: 62, requiredQuarters: 167 },
      { generation: 1961, legalAge: 62.25, requiredQuarters: 169 }, // né à partir du 1ᵉʳ septembre
      { generation: 1962, legalAge: 62.5, requiredQuarters: 169 },
      { generation: 1963, legalAge: 62.75, requiredQuarters: 170 },
      { generation: 1964, legalAge: 63, requiredQuarters: 171 },
      { generation: 1965, legalAge: 63.25, requiredQuarters: 172 }, // accélération Touraine : cible atteinte
      { generation: 1968, legalAge: 64, requiredQuarters: 172 }, // cible d'âge, liquidations à partir de 2032
    ],
  },
  'suspension-2026': {
    label: 'Suspension de la réforme (LFSS 2026)',
    source:
      'Loi n° 2025-1403 du 30 décembre 2025 (LFSS 2026), art. 105 — âge légal figé à 62 ans 9 mois pour ' +
      'les pensions prenant effet à partir du 1ᵉʳ septembre 2026 ; 64 ans repoussé à la génération 1969. ' +
      'La fenêtre de gel se referme au 1ᵉʳ janvier 2028 : le modèle retient la lettre du texte (gel des ' +
      'générations 1964-1965, puis reprise du calendrier et 64 ans à la génération 1969), l’après-2028 ' +
      'restant une variable politique ouverte. Le curseur affiche 64 ans, la cible d’arrivée ; c’est le ' +
      'calendrier qui porte le creux. Le gel ne coûte que sur les générations décalées, pas sur tout le ' +
      'stock des 62-64 ans : ce sont elles seules qui le portent, comme dans le chiffrage budgétaire.',
    delta: { legalAge: 64, requiredQuarters: 172 },
    // Écart au droit en vigueur : identique à `reforme-2023` jusqu'à la génération 1963, gel à
    // 62 ans 9 mois pour 1964-1965 (pensions prenant effet du 01/09/2026 au 31/12/2027),
    // puis reprise jusqu'à 64 ans à la génération 1969.
    schedule: [
      { generation: 1960, legalAge: 62, requiredQuarters: 167 },
      { generation: 1961, legalAge: 62.25, requiredQuarters: 169 },
      { generation: 1962, legalAge: 62.5, requiredQuarters: 169 },
      { generation: 1963, legalAge: 62.75, requiredQuarters: 170 },
      { generation: 1964, legalAge: 62.75, requiredQuarters: 170 }, // gel
      { generation: 1965, legalAge: 62.75, requiredQuarters: 171 }, // gel
      { generation: 1969, legalAge: 64, requiredQuarters: 172 }, // reprise, cible
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
  'age-indexe-ev': {
    label: 'Âge légal indexé sur l’espérance de vie',
    source:
      'Piste récurrente du COR et du rapport Blanchard-Tirole (2021), déjà en vigueur au Danemark, ' +
      'en Italie, aux Pays-Bas et au Portugal : l’âge légal suit les deux tiers des gains d’espérance ' +
      'de vie, de sorte que le partage entre années travaillées et années de retraite reste stable. ' +
      'Part de 64 ans en 2025 ; le levier ne connaît que les gains d’EV depuis cette année-là, jamais ' +
      'de recul si l’espérance de vie stagne.',
    delta: { legalAge: 64, requiredQuarters: 172, legalAgeLEShare: 0.66 },
  },
  'abattement-10': {
    label: 'Suppression de l’abattement fiscal de 10 % sur les pensions',
    source:
      'Conseil des prélèvements obligatoires et débat du PLF 2026 : les retraités bénéficient d’un ' +
      'abattement de 10 % sur leurs pensions, créé en 1978 par analogie avec les frais professionnels ' +
      'des actifs — qu’ils n’ont plus. Sa suppression rapporterait ≈ 4,5 Md€, soit ≈ 0,16 pt de PIB. ' +
      'Recette pure : elle ne touche ni l’âge ni le montant des pensions, seulement leur imposition.',
    delta: { additionalResourcesPct: 0.0016 },
  },
  'plafond-pension': {
    label: 'Plafonnement des pensions les plus élevées',
    source:
      'Piste d’équilibrage par le haut de la distribution : écrêtement des pensions brutes au-dessus ' +
      'de 4 000 €/mois. Le chiffrage repose sur la distribution des pensions par décile (DREES, saisie ' +
      'à la main et approximative — voir pensionDistribution.json) appliquée à la pension moyenne ' +
      'projetée : c’est un ordre de grandeur, pas un chiffrage d’étude d’impact. Le plafond est en ' +
      'euros constants, donc il mord de plus en plus à mesure que les pensions dérivent avec le noria.',
    delta: { pensionCap: 4000 },
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
 * Résumé lisible d'un calendrier : « 62 ans (gén. 1960) → 64 ans (gén. 1968) ».
 * Première ancre → dernière : indexé par génération, un calendrier de retraite est monotone
 * (un gel est un palier, pas un creux), donc ses extrémités le décrivent entièrement.
 */
export function scheduleSummary(schedule: PolicyAnchor[]): string | null {
  const withAge = schedule.filter((a) => a.legalAge != null)
  if (withAge.length < 2) return null
  const first = withAge[0]
  const last = withAge[withAge.length - 1]
  if (first.legalAge === last.legalAge) return null // âge plat : rien à étaler
  return `${formatAge(first.legalAge!)} (gén. ${first.generation}) → ${formatAge(last.legalAge!)} (gén. ${last.generation})`
}

// A scenario is a set of slider positions, nothing more.
//
// Same pattern as REFORM_PRESETS (reforms.ts): picking one pushes a Partial<PolicyParams> into
// the sliders, where the user can see it and move it. The INSEE variants (fécondité ±,
// migration ±, productivité COR ±) used to be separate scenarios; each was a single hypothesis
// moved, so they are now just positions on the corresponding slider.
import type { PolicyParams } from '../engine/types'
import { ACTIVITY_RATE } from './loader'
import historicalJson from './historical.json'
import historicalPyramidJson from './historicalPyramid.json'
import type { HistoricalData, HistoricalPyramid, ScenarioId } from './schema'

const JOBSEEKER_BASE_YEAR = 2025

/**
 * Part de chaque catégorie France Travail qui NE cotise PAS — parce qu'être inscrit et être
 * sans emploi sont deux choses différentes. Le poids est la fraction d'un temps plein
 * (151,67 h/mois) que la catégorie ne travaille pas, mesurée sur les heures effectivement
 * déclarées (Dares–France Travail STMT, onglet « DEFM cat BC_heures travaillées »,
 * moyenne des 4 derniers trimestres au 2026T2) :
 *   B  35,6 h/mois → 23,5 % d'un temps plein → ne cotise pas à 76,5 %
 *   C 139,2 h/mois → 91,8 % d'un temps plein → ne cotise pas à  8,2 % (53 % de C font 151 h+)
 * A, D, F et G sont sans emploi → 1. E est « en emploi » par définition (contrats aidés,
 * créateurs d'entreprise) → 0.
 *
 * ponytail: poids figés au 2026T2, ils bougent lentement. Si l'activité réduite se déforme,
 * les recalculer depuis l'onglet heures plutôt que d'ajouter un bloc de données pour deux
 * constantes.
 */
export const JOBSEEKER_WEIGHTS = { a: 1, b: 0.765, c: 0.082, d: 1, e: 0, f: 1, g: 1 } as const

/**
 * Le chômage que le scénario affiche séparément : A (sans emploi, en recherche) + D (sans
 * emploi, momentanément dispensés de recherche). C'est un « chômage administratif élargi »,
 * pas le chômage BIT : D comprend notamment la formation et la maladie.
 *
 * B, C et E restent dans le calcul des retraites avec leur pondération de cotisation ; F et G
 * aussi, mais relèvent de l'accompagnement social / de l'orientation RSA, pas de ce libellé
 * chômage A+D.
 */
export const JOBSEEKER_UNEMPLOYMENT_CATEGORIES = ['a', 'd'] as const

/**
 * Taux de non-emploi du scénario Pragmatique : les inscrits à France Travail pondérés par
 * JOBSEEKER_WEIGHTS, rapportés à la population active DU MODÈLE (Σ pop × τ_act ≈ 33 M en
 * 2025) — le même dénominateur que le taux de chômage BIT qu'il remplace, et surtout la
 * base exacte à laquelle `project()` applique ce taux. Diviser par les 18-64 ans (39,6 M)
 * perdrait 17 % de l'effet entre le calcul et l'application.
 *
 * Calculé, jamais recopié : le nombre magique se périme dès la publication trimestrielle
 * suivante. Moyenne des 4 derniers trimestres — les séries publiant F et G sont brutes
 * (non CVS-CJO), quatre trimestres neutralisent la saisonnalité sans rien modéliser.
 */
export function jobseekerRate(): number {
  const j = (historicalJson as unknown as HistoricalData).jobseekers
  const n = j.periods.length
  const from = Math.max(0, n - 4)
  const weighted = weigh(j, from, n)
  return weighted / (n - from) / activePopulation(JOBSEEKER_BASE_YEAR)
}

/**
 * Taux de chômage administratif élargi A+D, rapporté à la même population active du modèle.
 * Il sert à nommer proprement le chômage dans l'interface ; il ne remplace pas le taux pondéré
 * de non-cotisation utilisé par le calcul des retraites (`jobseekerRate`).
 */
export function jobseekerUnemploymentRate(): number {
  const j = (historicalJson as unknown as HistoricalData).jobseekers
  const n = j.periods.length
  const from = Math.max(0, n - 4)
  return count(j, from, n, JOBSEEKER_UNEMPLOYMENT_CATEGORIES) / (n - from) / activePopulation(JOBSEEKER_BASE_YEAR)
}

/**
 * La même mesure, mais année par année : la contrepartie OBSERVÉE de l'hypothèse ci-dessus, celle
 * que le graphe chômage affiche à la place du taux BIT quand le Pragmatique est sélectionné.
 * Années civiles complètes seulement (4 trimestres publiés) et couvertes par la pyramide observée,
 * soit 1996-2025 : le dénominateur suit la population active de CHAQUE année, pas celle de 2025.
 *
 * La série n'est pas homogène : F et G naissent en janvier 2025 et ajoutent ≈ 3,5 pts d'un coup
 * (12,7 % en 2024 → 16,4 % en 2025). C'est un changement de périmètre, pas du marché du travail.
 */
export function jobseekerRateByYear(): { years: number[]; rate: number[] } {
  return jobseekerRateByYearForCategories(Object.keys(JOBSEEKER_WEIGHTS) as (keyof typeof JOBSEEKER_WEIGHTS)[], true)
}

/** Contrepartie historique annuelle du chômage administratif élargi A+D. */
export function jobseekerUnemploymentRateByYear(): { years: number[]; rate: number[] } {
  return jobseekerRateByYearForCategories(JOBSEEKER_UNEMPLOYMENT_CATEGORIES, false)
}

function jobseekerRateByYearForCategories(
  categories: readonly (keyof typeof JOBSEEKER_WEIGHTS)[],
  weighted: boolean,
): { years: number[]; rate: number[] } {
  const j = (historicalJson as unknown as HistoricalData).jobseekers
  const pyramidYears = (historicalPyramidJson as unknown as HistoricalPyramid).years
  const years: number[] = []
  const rate: number[] = []
  for (let i = 0; i + 4 <= j.periods.length; i += 4) {
    const year = Number(j.periods[i].slice(0, 4))
    // Année incomplète (série qui ne démarrerait pas sur un T1) ou hors pyramide observée : sautée.
    if (j.periods.slice(i, i + 4).some((p) => Number(p.slice(0, 4)) !== year)) continue
    if (!pyramidYears.includes(year)) continue
    years.push(year)
    const numerator = weighted ? weigh(j, i, i + 4) : count(j, i, i + 4, categories)
    rate.push(numerator / 4 / activePopulation(year))
  }
  return { years, rate }
}

/** Inscrits pondérés par JOBSEEKER_WEIGHTS, cumulés sur les trimestres [from, to[. */
function weigh(j: HistoricalData['jobseekers'], from: number, to: number): number {
  return (Object.keys(JOBSEEKER_WEIGHTS) as (keyof typeof JOBSEEKER_WEIGHTS)[]).reduce(
    (sum, k) => sum + JOBSEEKER_WEIGHTS[k] * j[k].slice(from, to).reduce((s, v) => s + v, 0),
    0,
  )
}

/** Effectifs bruts cumulés sur les trimestres [from, to[, pour un sous-ensemble de catégories. */
function count(
  j: HistoricalData['jobseekers'],
  from: number,
  to: number,
  categories: readonly (keyof typeof JOBSEEKER_WEIGHTS)[],
): number {
  return categories.reduce((sum, k) => sum + j[k].slice(from, to).reduce((s, v) => s + v, 0), 0)
}

/** Population active DU MODÈLE une année observée — le dénominateur de tout taux de chômage ici. */
function activePopulation(year: number): number {
  const p = historicalPyramidJson as unknown as HistoricalPyramid
  const yi = p.years.indexOf(year)
  let active = 0
  // ponytail: âge légal figé à 64 pour la borne, l'écart par génération est du 2e ordre ici.
  for (let a = 15; a <= 64; a++) active += (p.H[yi][a] + p.F[yi][a]) * ACTIVITY_RATE(a, 64)
  return active
}

/** INSEE central « Projections de population 2021-2070 » — measured off central.json. */
const CENTRAL = {
  tfr: 1.8,
  netMigration: 70_000,
  productivity: 0.01, // COR juin 2025 central growth band
  unemployment: 0.07,
  realInterestRate: 0,
  workerExodus: 0,
} satisfies Partial<PolicyParams>

export const SCENARIO_PRESETS: Record<ScenarioId, Partial<PolicyParams>> = {
  central: CENTRAL,
  pragmatique: {
    ...CENTRAL,
    // Observed trends instead of INSEE's hypotheses: fécondité 1,45 (INSEE, en baisse depuis
    // 1,53 en 2025), solde migratoire +176 000/an (Bilan démographique 2025, moyenne 2023-2025
    // hors pic Ukraine), et l'effet sur les cotisations mesuré sur les inscrits à France Travail
    // pondérés par leurs heures travaillées (≈16,6 % des actifs) plutôt que par le BIT (7,4 %) —
    // voir JOBSEEKER_WEIGHTS et jobseekerRate().
    tfr: 1.45,
    netMigration: 176_000,
    unemployment: jobseekerRate(),
    // Risques macro portés par ce seul scénario : taux OAT 10 ans nominal (effet boule de neige
    // sur le solde cumulé) et émigration nette de jeunes actifs 25-40 ans.
    realInterestRate: 0.033,
    workerExodus: 30_000,
  },
  'choc-recession': CENTRAL, // le choc lui-même est dans la donnée (buildChocRecession)
}

export const SCENARIO_DESCRIPTIONS: Record<ScenarioId, string> = {
  central:
    'Scénario de référence de l’INSEE (et du COR) : 1,8 enfant par femme, solde migratoire +70 000/an, productivité +1,0 %/an. Les curseurs ci-dessous partent de ces valeurs — bougez-en un pour fabriquer votre propre variante.',
  pragmatique:
    'Les mêmes projections, mais calées sur les tendances réellement observées : fécondité 1,45 (vs 1,8), solde migratoire +176 000/an (vs +70 000), et surtout l’effet sur les cotisations des inscrits à France Travail — catégories A à G pondérées par les heures qu’elles travaillent déjà, soit ≈ 16,6 % des actifs. Le chômage est affiché séparément en A+D (« chômage administratif élargi ») ; B/C/E/F/G restent pris en compte dans les cotisations selon leur situation. Seul scénario à intégrer aussi les risques macro — intérêt sur la dette et exode des jeunes actifs, réglables plus bas.',
  'choc-recession':
    'Hypothèses centrales, plus un choc conjoncturel ponctuel : le chômage monte de 7 % à ~10 % entre 2027 et 2028 puis revient à 7 % en 2030. Les chômeurs ne cotisent pas → creux transitoire du solde, résorbé après la crise.',
}

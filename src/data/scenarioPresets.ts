// A scenario is a set of slider positions, nothing more.
//
// Same pattern as REFORM_PRESETS (reforms.ts): picking one pushes a Partial<PolicyParams> into
// the sliders, where the user can see it and move it. The INSEE variants (fécondité ±,
// migration ±, productivité COR ±) used to be separate scenarios; each was a single hypothesis
// moved, so they are now just positions on the corresponding slider.
import type { PolicyParams } from '../engine/types'
import historicalJson from './historical.json'
import historicalPyramidJson from './historicalPyramid.json'
import type { HistoricalData, HistoricalPyramid, ScenarioId } from './schema'

const JOBSEEKER_BASE_YEAR = 2025

/**
 * Taux de « non-emploi » du scénario Pragmatique : tous les inscrits à France Travail
 * (catégories A → G) rapportés aux 18-64 ans. Une mesure bien plus large que le chômage BIT
 * (7,4 % en 2024), parce que l'inscription compte aussi l'activité réduite (B, C), les
 * dispensés de recherche (D, E) et, depuis la loi plein emploi de janvier 2025, les
 * allocataires du RSA orientés ou en attente d'orientation (F, G).
 *
 * Calculé, jamais recopié : le nombre magique se périme dès la publication trimestrielle
 * suivante. Moyenne des 4 derniers trimestres — les séries publiant F et G sont brutes
 * (non CVS-CJO), quatre trimestres neutralisent la saisonnalité sans rien modéliser.
 * ponytail: dénominateur 18-64 figé, l'âge légal bouge par génération et l'écart est du 2e ordre.
 */
export function jobseekerRate(): number {
  const j = (historicalJson as unknown as HistoricalData).jobseekers
  const n = j.periods.length
  const from = Math.max(0, n - 4)
  const total = ([j.a, j.b, j.c, j.d, j.e, j.f, j.g] as number[][]).reduce(
    (sum, cat) => sum + cat.slice(from).reduce((s, v) => s + v, 0),
    0,
  )
  const p = historicalPyramidJson as unknown as HistoricalPyramid
  const yi = p.years.indexOf(JOBSEEKER_BASE_YEAR)
  let pop = 0
  for (let a = 18; a <= 64; a++) pop += p.H[yi][a] + p.F[yi][a]
  return total / (n - from) / pop
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
    // hors pic Ukraine), et le chômage mesuré par l'inscription à France Travail (A→G, ≈19 %)
    // plutôt que par le BIT (7,4 %) — voir jobseekerRate().
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
    'Les mêmes projections, mais calées sur les tendances réellement observées : fécondité 1,45 (vs 1,8), solde migratoire +176 000/an (vs +70 000), et surtout un chômage mesuré par l’inscription à France Travail — toutes catégories A à G, ≈ 19 % des 18-64 ans — au lieu du taux BIT retenu par le COR (7 %). Seul scénario à intégrer aussi les risques macro — intérêt sur la dette et exode des jeunes actifs, réglables plus bas.',
  'choc-recession':
    'Hypothèses centrales, plus un choc conjoncturel ponctuel : le chômage monte de 7 % à ~10 % entre 2027 et 2028 puis revient à 7 % en 2030. Les chômeurs ne cotisent pas → creux transitoire du solde, résorbé après la crise.',
}

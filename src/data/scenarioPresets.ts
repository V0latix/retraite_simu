// A scenario is a set of slider positions, nothing more.
//
// Same pattern as REFORM_PRESETS (reforms.ts): picking one pushes a Partial<PolicyParams> into
// the sliders, where the user can see it and move it. The INSEE variants (fécondité ±,
// migration ±, productivité COR ±) used to be separate scenarios; each was a single hypothesis
// moved, so they are now just positions on the corresponding slider.
import type { PolicyParams } from '../engine/types'
import type { ScenarioId } from './schema'

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
    // hors pic Ukraine), chômage 7,4 % (BIT, moyenne annuelle 2024).
    tfr: 1.45,
    netMigration: 176_000,
    unemployment: 0.074,
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
    'Les mêmes projections, mais calées sur les tendances réellement observées : fécondité 1,45 (vs 1,8), solde migratoire +176 000/an (vs +70 000), chômage 7,4 % (vs 7 %). Seul scénario à intégrer aussi les risques macro — intérêt sur la dette et exode des jeunes actifs, réglables plus bas.',
  'choc-recession':
    'Hypothèses centrales, plus un choc conjoncturel ponctuel : le chômage monte de 7 % à ~10 % entre 2027 et 2028 puis revient à 7 % en 2030. Les chômeurs ne cotisent pas → creux transitoire du solde, résorbé après la crise.',
}

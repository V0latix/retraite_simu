import type { ScenarioData } from './schema'

// « Pragmatique » scenario — the INSEE *central* scenario re-targeted onto France's
// actually-observed demographic trends instead of INSEE's projection hypotheses:
//   - Fertility: 1,53 in 2025 (last observed, INSEE France métropolitaine) declining
//     linearly to 1,45 by 2040, then held — vs INSEE's flat 1,8.
//   - Net migration: +176 000/an — INSEE Bilan démographique 2025 (moyenne 2023-2025,
//     hors pic Ukraine 2022) — vs INSEE's +70 000/an.
//   - Unemployment: 7,4 % — INSEE taux de chômage BIT, moyenne annuelle 2024 (dernier
//     observé) — vs the model's flat 7 %. Unemployed are active but don't contribute, so
//     a higher rate means fewer contributors (contributors × (1 − u) in project.ts).
// Mortality is left at the central scenario's values (out of scope).
//
// Only the yearly totals (TFR, net migration) are rescaled; the age/sex profiles are
// preserved. The whole chain (demography → finance → pensions) then recomputes through
// project() with no engine change — a scenario is data, not a branch.

const TFR_2025 = 1.53
const TFR_2040 = 1.45
const NET_MIGRATION = 176_000
const UNEMPLOYMENT = 0.074 // taux de chômage BIT observé, moyenne annuelle 2024 (INSEE)

/**
 * Risk overlay carried by the Pragmatique scenario (applied as policy levers, adjustable in
 * the UI). The basic INSEE/COR scenarios keep these at 0 so they stay pinned to the reference.
 *  - realInterestRate 3,3 % : taux OAT 10 ans nominal, SANS retrancher l'inflation (cohérent
 *    avec un modèle qui n'indexe pas les pensions sur l'inflation) — effet boule de neige sur
 *    le solde cumulé.
 *  - workerExodus 30 000/an : émigration nette de jeunes actifs 25-40 ans (surcouche de risque ;
 *    le solde migratoire français observé reste positif). Visible sur le graphe migration.
 */
export const PRAGMATIQUE_RISK = { realInterestRate: 0.033, workerExodus: 30_000 }

/** Target total fertility rate: hold 1,53 to 2025, decline to 1,45 by 2040, then flat. */
function targetTFR(year: number): number {
  if (year <= 2025) return TFR_2025
  if (year >= 2040) return TFR_2040
  return TFR_2025 + (TFR_2040 - TFR_2025) * ((year - 2025) / (2040 - 2025))
}

const sum = (a: readonly number[]) => a.reduce((s, v) => s + v, 0)

/** Derive the Pragmatique scenario from the INSEE central one (see header). Pure. */
export function buildPragmatique(central: ScenarioData): ScenarioData {
  const fertility = central.fertility.map((row, i) => {
    const base = sum(row) // central TFR that year (~1,8)
    const k = base > 0 ? targetTFR(central.years[i]) / base : 0
    return row.map((v) => v * k)
  })

  const scaleSex = (mat: number[][]): number[][] =>
    mat.map((row, i) => {
      const net = sum(central.migration.H[i]) + sum(central.migration.F[i]) // ~70 000
      const k = net !== 0 ? NET_MIGRATION / net : 0
      return row.map((v) => v * k)
    })

  return {
    ...central,
    meta: { ...central.meta, scenario: 'pragmatique' },
    fertility,
    migration: { H: scaleSex(central.migration.H), F: scaleSex(central.migration.F) },
    unemploymentTarget: UNEMPLOYMENT,
    // mortality unchanged
  }
}

// « Scénarios COR par productivité » — central demography, only the long-run real productivity
// growth changes, matching the COR June 2025 growth band (0,7 / 1,0 / 1,3 %/an). The central
// scenario already sits at 1,0 %, so only the low and high ends are added here. See §2 du TODO.
const COR_PROD_BASSE = 0.007
const COR_PROD_HAUTE = 0.013

export const buildCorProdBasse = (c: ScenarioData): ScenarioData => ({
  ...c,
  meta: { ...c.meta, scenario: 'cor-productivite-basse' },
  productivity: COR_PROD_BASSE,
})

export const buildCorProdHaute = (c: ScenarioData): ScenarioData => ({
  ...c,
  meta: { ...c.meta, scenario: 'cor-productivite-haute' },
  productivity: COR_PROD_HAUTE,
})

// « Choc conjoncturel » — central demography with a one-off unemployment spike: +3 pts (peak
// height set in the loader) rising from 2027, peaking 2028, back to base by 2030. Shows the
// short-term sensitivity of the balance (fewer contributors during the recession).
export const buildChocRecession = (c: ScenarioData): ScenarioData => ({
  ...c,
  meta: { ...c.meta, scenario: 'choc-recession' },
  unemploymentShock: { from: 2027, peak: 2028, to: 2030 },
})

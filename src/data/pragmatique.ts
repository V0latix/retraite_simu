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

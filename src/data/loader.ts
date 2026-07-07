// Builds engine inputs from the real INSEE JSON (replaces the old seed.ts).
import { OMEGA, type HypothesisSet, type PolicyParams, type PopulationState, type Sex } from '../engine/types'
import type { BeyondDataPolicy, InitialPyramid, ScenarioData } from './schema'
import params from './systemParams.json'

export const BASE_YEAR = params.baseYear

export const DEFAULT_POLICY: PolicyParams = {
  legalAge: params.policy.legalAge,
  requiredQuarters: params.policy.requiredQuarters,
  contributionRate: params.policy.contributionRate,
  indexation: params.policy.indexation as PolicyParams['indexation'],
}

/** Economic seeds + COR calibration passed into project() (kept in data). */
export const ECON_INIT = {
  avgAnnualWage: params.init.avgAnnualWage,
  avgAnnualPension: params.init.avgAnnualPension,
  priceInflation: params.economy.priceInflation,
  pensionDriftShare: params.calibration.pensionDriftShare,
  depensesShareBase: params.calibration.depensesShareBase,
  soldeShareBase: params.calibration.soldeShareBase,
  resources2070Share: params.calibration.resources2070Share,
}

export function buildInitialState(pyr: InitialPyramid): PopulationState {
  const H = new Float64Array(OMEGA + 1)
  const F = new Float64Array(OMEGA + 1)
  for (let a = 0; a <= OMEGA; a++) {
    H[a] = pyr.H[a] ?? 0
    F[a] = pyr.F[a] ?? 0
  }
  return { year: pyr.meta.year, H, F }
}

/**
 * Resolve a value from a [yearIndex][age] matrix at an arbitrary year, applying
 * the extrapolation policy for years past the last published one (§7).
 */
function atYear(matrix: number[][], years: number[], year: number, age: number, beyond: BeyondDataPolicy): number {
  const first = years[0]
  const last = years[years.length - 1]
  if (year <= first) return matrix[0][age]
  if (year <= last) return matrix[year - first][age] // years are contiguous 1-year steps
  // Beyond the data:
  const lastVal = matrix[last - first][age]
  if (beyond === 'hold') return lastVal
  const prevVal = matrix[last - first - 1][age]
  const slope = lastVal - prevVal
  if (beyond === 'trend') return Math.max(0, lastVal + slope * (year - last))
  // 'converge': ease the recent slope out to zero over ~30 years, then hold.
  const span = 30
  const k = Math.min(1, (year - last) / span)
  return Math.max(0, lastVal + slope * (year - last) * (1 - k))
}

/** Central deterministic scenario from real data; reform levers override policy. */
export function buildHypotheses(
  data: ScenarioData,
  policy: Partial<PolicyParams> = {},
  beyond: BeyondDataPolicy = 'hold',
): HypothesisSet {
  const merged: PolicyParams = { ...DEFAULT_POLICY, ...policy }
  const { years } = data
  return {
    fertility: (y, age) => (age < 15 || age > 50 ? 0 : atYear(data.fertility, years, y, age, beyond)),
    mortality: (y, age, sex: Sex) => atYear(data.mortality[sex], years, y, Math.min(age, OMEGA), beyond),
    migration: (y, age, sex: Sex) => (y < BASE_YEAR ? 0 : atYear(data.migration[sex], years, y, age, beyond)),
    productivity: () => params.economy.productivity,
    unemployment: () => params.economy.unemployment,
    // Activity rate: COR-style hypothesis, ramps down toward the legal age.
    activityRate: (_y, age, legalAge) => {
      if (age < 20) return 0.25
      if (age >= legalAge) return 0
      if (age >= legalAge - 5) return 0.55
      return 0.9
    },
    policy: () => merged,
  }
}

// Builds engine inputs from the real INSEE JSON (replaces the old seed.ts).
import { OMEGA, type HypothesisSet, type PolicyParams, type PopulationState, type Sex } from '../engine/types'
import { type EconInit, project } from '../engine/project'
import type { BeyondDataPolicy, CorReference, HistoricalData, HistoricalPyramid, InitialPyramid, ReferenceIndicators, ScenarioData } from './schema'
import params from './systemParams.json'
import corReferenceJson from './corReference.json'
import referenceIndicatorsJson from './referenceIndicators.json'
import centralScenario from './scenarios/central.json'
import initialPyramidJson from './initialPyramid.json'
import historicalJson from './historical.json'
import historicalPyramidJson from './historicalPyramid.json'

export const BASE_YEAR = params.baseYear
const CAL_END = 2070 // last year the COR reference publishes; calibration holds beyond it

/** Observed series (COR + INSEE). Everything before LAST_OBSERVED_YEAR is measured, not modelled. */
export const historical = historicalJson as HistoricalData
export const historicalPyramid = historicalPyramidJson as HistoricalPyramid
export const LAST_OBSERVED_YEAR = historical.lastObserved

/** Published DREES/COR reference indicators (context/validation, §4). */
export const referenceIndicators = referenceIndicatorsJson as ReferenceIndicators

export const DEFAULT_POLICY: PolicyParams = {
  legalAge: params.policy.legalAge,
  requiredQuarters: params.policy.requiredQuarters,
  contributionRate: params.policy.contributionRate,
  indexation: params.policy.indexation as PolicyParams['indexation'],
  productivity: params.economy.productivity,
  realInterestRate: 0, // basic scenarios stay clean; the Pragmatique risk overlay sets these
  workerExodus: 0,
}

/** Economic seeds + base-year COR anchors (kept in data). Calibration is layered on below. */
const ECON_SEEDS: EconInit = {
  avgAnnualWage: params.init.avgAnnualWage,
  avgAnnualPension: params.init.avgAnnualPension,
  priceInflation: params.economy.priceInflation,
  pensionDriftShare: params.calibration.pensionDriftShare,
  quartersAgeShare: params.calibration.quartersAgeShare,
  quartersRef: params.policy.requiredQuarters,
  depensesShareBase: params.calibration.depensesShareBase,
  soldeShareBase: params.calibration.soldeShareBase,
  resources2070Share: params.calibration.resources2070Share,
}

/**
 * Per-year COR EEC calibration. We run the CENTRAL scenario once with the raw taper, then
 * derive, at each year, the benefit multiplier and the other-resources share that make the
 * central trajectory reproduce the COR EEC reference (dépenses + ressources → solde) at
 * every horizon — interpolating between the reference's anchor years. Every scenario and
 * reform lever reuses this same calibration, so they deviate from COR through their own
 * demography and contributions rather than being pinned to it.
 */
function buildCorCalibration(): EconInit['calibration'] {
  const ref = corReferenceJson as CorReference
  const pts = [...ref.points].sort((a, b) => a.year - b.year)
  const interp = (year: number, field: 'depensesPctGdp' | 'ressourcesPctGdp') => {
    if (year <= pts[0].year) return pts[0][field]
    if (year >= pts[pts.length - 1].year) return pts[pts.length - 1][field]
    for (let i = 0; i < pts.length - 1; i++) {
      if (year >= pts[i].year && year <= pts[i + 1].year) {
        const t = (year - pts[i].year) / (pts[i + 1].year - pts[i].year)
        return pts[i][field] + t * (pts[i + 1][field] - pts[i][field])
      }
    }
    return pts[pts.length - 1][field]
  }

  const rawCentral = project(
    buildInitialState(initialPyramidJson as InitialPyramid),
    buildHypotheses(centralScenario as unknown as ScenarioData),
    CAL_END,
    ECON_SEEDS,
  )
  const depMul: number[] = []
  const otherResPct: number[] = []
  for (const r of rawCentral) {
    depMul.push(interp(r.year, 'depensesPctGdp') / r.depensesPctGdp)
    otherResPct.push(interp(r.year, 'ressourcesPctGdp') - r.contributions / r.gdp)
  }
  return { baseYear: BASE_YEAR, depMul, otherResPct }
}

export const ECON_INIT: EconInit = { ...ECON_SEEDS, calibration: buildCorCalibration() }

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

/** +3 pts absolute peak of the one-off recession shock (flagged: illustrative, not calibrated). */
const SHOCK_PEAK = 0.03

/** Base unemployment plus an optional triangular shock: 0 outside [from,to], ramping linearly
 *  up to +SHOCK_PEAK at `peak`, back to base by `to`. Pure function of the year. */
function unemploymentFn(base: number, shock?: { from: number; peak: number; to: number }): (year: number) => number {
  if (!shock) return () => base
  const { from, peak, to } = shock
  return (year: number) => {
    if (year <= from || year >= to) return base
    const t = year < peak ? (year - from) / (peak - from) : (to - year) / (to - peak)
    return base + SHOCK_PEAK * t
  }
}

/** Central deterministic scenario from real data; reform levers override policy. */
export function buildHypotheses(
  data: ScenarioData,
  policy: Partial<PolicyParams> = {},
  beyond: BeyondDataPolicy = 'hold',
): HypothesisSet {
  const merged: PolicyParams = { ...DEFAULT_POLICY, ...policy }
  const { years } = data
  // « Exode des actifs » lever: net emigration of workerExodus persons/year, spread
  // uniformly over ages 25-40 (16 ages) and both sexes — 32 equal slices.
  const exodusPerSlice = (merged.workerExodus ?? 0) / 32
  const exodus = (age: number) => (age >= 25 && age <= 40 ? exodusPerSlice : 0)
  return {
    fertility: (y, age) => (age < 15 || age > 50 ? 0 : atYear(data.fertility, years, y, age, beyond)),
    mortality: (y, age, sex: Sex) => atYear(data.mortality[sex], years, y, Math.min(age, OMEGA), beyond),
    migration: (y, age, sex: Sex) => (y < BASE_YEAR ? 0 : atYear(data.migration[sex], years, y, age, beyond) - exodus(age)),
    // Scenario-intrinsic productivity (COR growth band) wins over the shared policy lever, so
    // the spread survives ComparisonView's single shared policy; other scenarios keep the lever.
    productivity: () => data.productivity ?? merged.productivity ?? params.economy.productivity,
    unemployment: unemploymentFn(merged.unemployment ?? data.unemploymentTarget ?? params.economy.unemployment, data.unemploymentShock),
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

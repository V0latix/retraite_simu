// The single projection entry point (cahier des charges §3, §6.1).
// Signature is identical in deterministic and stochastic mode:
//   project(state0, hypothesisSet, horizon) => TimeSeries
import { dependencyDemographic, stepDemography } from './demography'
import { OMEGA, type HypothesisSet, type PopulationState, type TimeSeries } from './types'

// ponytail: economy + pension-system math lives inline here for Phase 1/2.
// Split into economy.ts / pensionSystem.ts when the finance block grows past a screenful.

/**
 * Absolute money seeds + COR calibration — supplied from data (systemParams.json),
 * not hard-coded. Everything runs in constant (real, base-year) euros.
 */
export interface EconInit {
  avgAnnualWage: number
  avgAnnualPension: number
  priceInflation: number
  // Calibration to the COR reference (see corReference.json).
  depensesShareBase: number // pension mass / GDP at the base year (≈ 0.139)
  soldeShareBase: number // solde / GDP at the base year (≈ -0.001)
  resources2070Share: number // total resources / GDP target by 2070 (≈ 0.128)
  pensionDriftShare: number // noria drift of avg pension as a share of productivity
  /**
   * Optional per-year COR calibration (built in loader.ts from corReference.json).
   * When present, it pins the CENTRAL scenario's dépenses and resources to the COR EEC
   * trajectory at every horizon (not just the endpoints), so the reference solde tracks
   * COR across 2025-2070. Other scenarios and reform levers keep the same calibration and
   * deviate from it through their own demography/contributions — sensitivity is preserved.
   * `depMul` scales benefits; `otherResPct` replaces the linear resource taper. Indexed by
   * `year - baseYear`, clamped past the last entry.
   */
  calibration?: { baseYear: number; depMul: number[]; otherResPct: number[] }
}
const DEFAULT_ECON: EconInit = {
  avgAnnualWage: 40000,
  avgAnnualPension: 16800,
  priceInflation: 0.018,
  depensesShareBase: 0.139,
  soldeShareBase: -0.001,
  resources2070Share: 0.128,
  pensionDriftShare: 0.22,
}

function countByAge(state: PopulationState, lo: number, hi: number): number {
  let sum = 0
  for (let a = lo; a <= hi; a++) sum += state.H[a] + state.F[a]
  return sum
}

/** Retirees = everyone at/above the effective retirement age (≈ legal age in v1). */
function retirees(state: PopulationState, retireAge: number): number {
  return countByAge(state, Math.min(retireAge, OMEGA), OMEGA)
}

/** Occupied active population: Σ P(a)·τ_act(a)·(1-u), ages 15..legalAge. */
function contributors(state: PopulationState, h: HypothesisSet, year: number, legalAge: number): number {
  const u = h.unemployment(year)
  let active = 0
  for (let a = 15; a < legalAge && a <= OMEGA; a++) {
    const pop = state.H[a] + state.F[a]
    active += pop * h.activityRate(year, a, legalAge)
  }
  return active * (1 - u)
}

export function project(
  state0: PopulationState,
  h: HypothesisSet,
  horizon: number,
  econ: EconInit = DEFAULT_ECON,
): TimeSeries {
  const series: TimeSeries = []
  const baseYear = state0.year
  let state = state0
  let avgWage = econ.avgAnnualWage
  let avgPension = econ.avgAnnualPension // constant (real) euros
  let cumulativeDebt = 0

  // COR-anchored base-year constants (fixed on the first iteration).
  const resourcesShareBase = econ.depensesShareBase + econ.soldeShareBase // ≈ 0.138
  let gdpBase = 0
  let laborShare = 0
  let tShareBase = 0 // other-resources (T) share of GDP at the base year

  for (let year = baseYear; year <= horizon; year++) {
    const p = h.policy(year)

    // Economy (§4.2) — real wage grows with productivity.
    if (year > baseYear) avgWage *= 1 + h.productivity(year)
    const contrib = contributors(state, h, year, p.legalAge)
    const wageBill = contrib * avgWage
    const contributions = wageBill * p.contributionRate

    // Average pension real growth = max(indexation of the stock, noria drift).
    // Indexation: prices → flat, wages → g, mix → g/2. Noria: new retirees enter
    // with higher (wage-based) pensions, lifting the average even under price
    // indexation — without this, dépenses/PIB collapse (§4.3).
    if (year > baseYear) {
      const g = h.productivity(year)
      const idx = p.indexation === 'wages' ? g : p.indexation === 'mix' ? g / 2 : 0
      avgPension *= 1 + Math.max(idx, econ.pensionDriftShare * g)
    }
    const nRetirees = retirees(state, p.legalAge)
    let benefits = nRetirees * avgPension

    // Total fertility rate = sum of age-specific fertility over childbearing ages.
    // A display output (fertility chart); it does not feed the projection.
    let tfr = 0
    for (let a = 15; a <= 50; a++) tfr += h.fertility(year, a)

    // Net migration = solde migratoire this year, all ages and sexes. Display output.
    let netMigration = 0
    for (let a = 0; a <= OMEGA; a++) netMigration += h.migration(year, a, 'H') + h.migration(year, a, 'F')

    // Anchor GDP and shares to COR at the base year (from raw benefits — the
    // calibration multiplier is 1 at the base year, so this is unaffected).
    if (year === baseYear) {
      gdpBase = benefits / econ.depensesShareBase // pins pension mass to ~13.9% GDP
      laborShare = wageBill / gdpBase
      tShareBase = resourcesShareBase - contributions / gdpBase
    }
    const gdp = wageBill / laborShare

    // Other resources: either the per-year COR calibration (central tracks COR EEC at
    // every horizon) or, when no calibration is supplied, a linear taper to the COR 2070
    // target. Contributions stay lever-sensitive on top in both cases, so raising the
    // contribution rate improves the solde.
    let otherResources: number
    if (econ.calibration) {
      const cal = econ.calibration
      const i = Math.min(Math.max(year - cal.baseYear, 0), cal.depMul.length - 1)
      benefits *= cal.depMul[i]
      otherResources = cal.otherResPct[i] * gdp
    } else {
      const frac = Math.min(1, Math.max(0, (year - baseYear) / (2070 - baseYear)))
      const tShare = tShareBase - (resourcesShareBase - econ.resources2070Share) * frac
      otherResources = tShare * gdp
    }
    const resources = contributions + otherResources
    const balance = resources - benefits
    // Cumulated balance snowballs at the real interest rate: debt costs it, reserves earn
    // it (symmetric). Interest affects ONLY this cumul — the annual solde stays untouched,
    // so the COR calibration and the soldePctGdp comparison remain valid.
    cumulativeDebt = cumulativeDebt * (1 + (p.realInterestRate ?? 0)) - balance

    series.push({
      year,
      pyramid: { H: Array.from(state.H), F: Array.from(state.F) },
      dependencyDemographic: dependencyDemographic(state),
      dependencySystem: contrib > 0 ? nRetirees / contrib : 0,
      tfr,
      netMigration,
      unemployment: h.unemployment(year),
      contributors: contrib,
      retirees: nRetirees,
      avgWage,
      wageBill,
      contributions,
      benefits,
      balance,
      cumulativeDebt,
      gdp,
      depensesPctGdp: benefits / gdp,
      resourcesPctGdp: resources / gdp,
      soldePctGdp: balance / gdp,
    })

    if (year < horizon) state = stepDemography(state, h)
  }

  return series
}

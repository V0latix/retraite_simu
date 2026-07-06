// The single projection entry point (cahier des charges §3, §6.1).
// Signature is identical in deterministic and stochastic mode:
//   project(state0, hypothesisSet, horizon) => TimeSeries
import { dependencyDemographic, stepDemography } from './demography'
import { OMEGA, type HypothesisSet, type PopulationState, type TimeSeries, type YearResult } from './types'

// ponytail: economy + pension-system math lives inline here for Phase 1/2.
// Split into economy.ts / pensionSystem.ts when the finance block grows past a screenful.

const AVG_PENSION_0 = 16800 // €/yr, DREES order of magnitude — seed, refine in Phase 0
const AVG_WAGE_0 = 40000 // €/yr gross avg — seed
const OTHER_RESOURCES = 0 // T(t): transfers, ignored in v1

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

export function project(state0: PopulationState, h: HypothesisSet, horizon: number): TimeSeries {
  const series: TimeSeries = []
  let state = state0
  let avgWage = AVG_WAGE_0
  let avgPension = AVG_PENSION_0
  let cumulativeDebt = 0
  const r = 0.01 // discount rate for debt accumulation

  for (let year = state.year; year <= horizon; year++) {
    const p = h.policy(year)

    // Economy (§4.2)
    if (year > state0.year) avgWage *= 1 + h.productivity(year)
    const contrib = contributors(state, h, year, p.legalAge)
    const wageBill = contrib * avgWage
    const contributions = wageBill * p.contributionRate

    // System (§4.3)
    if (year > state0.year) {
      const g = h.productivity(year)
      const infl = 0.018 // price index seed
      const idx = p.indexation === 'wages' ? g : p.indexation === 'mix' ? (g + infl) / 2 : infl
      avgPension *= 1 + idx
    }
    const nRetirees = retirees(state, p.legalAge)
    const benefits = nRetirees * avgPension
    const balance = contributions + OTHER_RESOURCES - benefits
    cumulativeDebt = cumulativeDebt * (1 + r) - balance

    const result: YearResult = {
      year,
      pyramid: { H: Array.from(state.H), F: Array.from(state.F) },
      dependencyDemographic: dependencyDemographic(state),
      dependencySystem: contrib > 0 ? nRetirees / contrib : 0,
      contributors: contrib,
      retirees: nRetirees,
      avgWage,
      wageBill,
      contributions,
      benefits,
      balance,
      cumulativeDebt,
    }
    series.push(result)

    if (year < horizon) state = stepDemography(state, h)
  }

  return series
}

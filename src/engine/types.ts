// Core engine types. Kept framework-free (no React) per cahier des charges §9.3.

export type Sex = 'H' | 'F'

export const OMEGA = 105 // max age tracked
export const SEXES: Sex[] = ['H', 'F']

/** Population by age [0..OMEGA] and sex. state[sex][age] = headcount. */
export interface PopulationState {
  year: number
  H: Float64Array // length OMEGA + 1
  F: Float64Array // length OMEGA + 1
}

export type Indexation = 'prices' | 'wages' | 'mix'

/** Reform levers, as a function of time (cahier des charges §4.4 / §6.1). */
export interface PolicyParams {
  legalAge: number
  requiredQuarters: number
  contributionRate: number
  indexation: Indexation
  targetReplacementRate?: number
}

/**
 * A scenario = a bundle of hypothesis trajectories (§6.1).
 * Same shape in deterministic and stochastic mode — only the source differs.
 */
export interface HypothesisSet {
  fertility: (year: number, age: number) => number // rate, age in [15,50]
  mortality: (year: number, age: number, sex: Sex) => number // qx
  migration: (year: number, age: number, sex: Sex) => number // net headcount
  productivity: (year: number) => number // g
  unemployment: (year: number) => number // u
  activityRate: (year: number, age: number, legalAge: number) => number // τ_act
  policy: (year: number) => PolicyParams
}

/** One year of macro outputs. */
export interface YearResult {
  year: number
  pyramid: { H: number[]; F: number[] } // headcount by age
  dependencyDemographic: number // 65+ / [20-64]
  dependencySystem: number // retirees / contributors
  contributors: number
  retirees: number
  avgWage: number
  wageBill: number
  contributions: number
  benefits: number
  balance: number // S(t) = C + T - D, constant euros
  cumulativeDebt: number
  gdp: number
  depensesPctGdp: number // D / GDP
  resourcesPctGdp: number // (C + T) / GDP
  soldePctGdp: number // S / GDP — COR's unit
}

export type TimeSeries = YearResult[]

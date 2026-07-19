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
  /** Real productivity growth per year (= real wage growth). Economic hypothesis
   *  exposed alongside the reform levers; drives wages, GDP and contributions. */
  productivity?: number
  /** Real interest rate applied to the cumulated balance (debt costs it, reserves earn it).
   *  Affects ONLY cumulativeDebt — the annual solde stays COR-comparable. Fraction. */
  realInterestRate?: number
  /** Net emigration of young actives (ages 25-40), persons/year, subtracted from the
   *  scenario's migration — today's contributors and tomorrow's parents both leave. */
  workerExodus?: number
  /** Sub-indexation of pensions: points/year subtracted from the pension revaluation
   *  (0.01 = pensions grow 1 pt slower than the base rule). ≥ inflation ⇒ real freeze. */
  underIndexation?: number
  /** Number of years, from BASE_YEAR, over which `underIndexation` applies. */
  underIndexationYears?: number
  /** Share (0-1) of life-expectancy gains since BASE_YEAR converted into extra working
   *  years: effective legal age = legalAge + share × max(0, ΔLE). 0 ⇒ age stays fixed. */
  legalAgeLEShare?: number
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
  lifeExpectancyAtBirth: number // e0, période, unisexe (qx du scénario)
  lifeExpectancyAt65: number // e65 = durée de retraite espérée
  tfr: number // indicateur conjoncturel de fécondité (Σ fertility, ages 15-50)
  netMigration: number // solde migratoire (Σ migration, tous âges et sexes)
  unemployment: number // taux de chômage retenu (fraction) — les chômeurs ne cotisent pas
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

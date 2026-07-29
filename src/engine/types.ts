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

/**
 * One anchor of a reform calendar, keyed by **année de naissance**, not by year of liquidation:
 * c'est ainsi que la loi est écrite (2023 : 62 → 64 ans, +3 mois par génération, gén. sept. 1961
 * → 1968). Le moteur résout l'âge légal génération par génération (voir `HypothesisSet.cohortPolicy`),
 * ce qui rend le calendrier « collant » : qui a liquidé à 62 ans 9 mois le reste ensuite.
 * Serializable on purpose — it crosses postMessage, so no functions here.
 */
export interface PolicyAnchor {
  generation: number
  legalAge?: number
  requiredQuarters?: number
}

/** Reform levers, as a function of time (cahier des charges §4.4 / §6.1). */
export interface PolicyParams {
  /** Effective legal age, in years. Fractional: 0.25 = 3 months (the unit real French
   *  reforms move in — 62,75 = « 62 ans 9 mois »). */
  legalAge: number
  requiredQuarters: number
  contributionRate: number
  indexation: Indexation
  /** Real productivity growth per year (= real wage growth). Economic hypothesis
   *  exposed alongside the reform levers; drives wages, GDP and contributions. */
  productivity?: number
  /** Target total fertility rate (children per woman). Rescales the scenario's age-specific
   *  fertility rates to hit it, profile preserved. Absent ⇒ the scenario's own trajectory. */
  tfr?: number
  /** Target net migration, persons/year. Rescales the scenario's age/sex migration profiles
   *  to hit it. Absent ⇒ the scenario's own trajectory. Applied before `workerExodus`. */
  netMigration?: number
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
  /** Macro override of the flat unemployment rate (fraction). When set, wins over the
   *  scenario's unemploymentTarget; absent ⇒ scenario/systemParams default. */
  unemployment?: number
  /** Additional revenue as a share of GDP, added on top of contributions + calibrated
   *  other-resources (models a CSG hike on pensions / « mise à contribution des retraités »).
   *  Absent ⇒ 0 ⇒ reference trajectory unchanged. */
  additionalResourcesPct?: number
  /** FRR endowment (« abondement »): reserves set aside each year, as a share of GDP.
   *  Positive ⇒ builds reserves ⇒ improves the cumulated position. Like realInterestRate it
   *  touches ONLY the cumul, never the annual (COR-comparable) solde. Absent ⇒ 0. */
  frrFlowPct?: number
  /** Share (0-1) of the [60, legalAge) band retiring early (carrières longues, §3.2): they
   *  move from contributors to retirees. Absent ⇒ 0 ⇒ uniform exit age (reference unchanged). */
  earlyRetirementShare?: number
  /** Plafond de pension brute, en €/mois. L'écrêtement porte sur la part de la masse au-dessus
   *  du plafond, calculée sur la distribution par décile (`EconInit.pensionDeciles`).
   *  Absent ou 0 ⇒ aucun plafonnement ⇒ trajectoire de référence inchangée. */
  pensionCap?: number
  /** Reform calendar: a real law phases in by birth cohort (2023: +3 months per génération,
   *  gén. 1961 → 1968) instead of switching overnight. Anchors are keyed by génération,
   *  interpolated linearly, clamped outside their range, and override `legalAge` /
   *  `requiredQuarters` above. Absent ⇒ the flat value applies to every génération (status quo). */
  schedule?: PolicyAnchor[]
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
  /** Flat levers (cotisation, indexation, plafond…) — sans le calendrier, qui est générationnel. */
  policy: (year: number) => PolicyParams
  /** Âge légal et durée requise **de la génération g**, calendrier de la loi résolu. Sans
   *  calendrier, renvoie les mêmes paramètres plats pour toute génération. */
  cohortPolicy: (generation: number) => PolicyParams
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
  /** Pension brute moyenne, euros constants annuels. Avant le multiplicateur de calage COR
   *  (qui pilote la masse, pas le montant individuel), après écrêtement `pensionCap`. */
  avgPension: number
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

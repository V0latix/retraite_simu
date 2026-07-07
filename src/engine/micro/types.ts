// Micro (individual) pension types. Pure, framework-free (spec §5).

export type Status = 'non-cadre' | 'cadre'

/** A career: gross annual salary for each year worked. */
export interface Career {
  birthYear: number
  startYear: number // first year of work
  status: Status
  /** salaryByYear[i] = gross salary in year (startYear + i). */
  salaryByYear: number[]
}

/** Parametric inputs the UI collects; synthesizeCareer() turns them into a Career. */
export interface CareerParams {
  birthYear: number
  startYear: number
  startSalary: number // gross annual salary at career start
  annualGrowth: number // real salary growth per year (e.g. 0.015)
  status: Status
  partTimeFactor: number // 1 = full time, 0.8 = 80% etc.
  retirementAge: number // desired age at liquidation
}

/**
 * Macro context consumed by the micro calc (spec §5.4). Trajectories are indexed
 * by calendar year; everything here is derived from the selected macro scenario.
 */
export interface MicroContext {
  legalAge: number
  requiredQuarters: number
  passByYear: (year: number) => number
  pointValueByYear: (year: number) => number // AGIRC-ARRCO value of service V(t)
  salaireRefByYear: (year: number) => number // point purchase price SR(t)
  /** Coefficient to revalue a salary from `fromYear` to the liquidation year. */
  revalCoef: (fromYear: number, toYear: number) => number
}

export interface PensionBreakdown {
  liquidationYear: number
  retirementAge: number
  quartersWorked: number
  rate: number // taux de liquidation (after décote/surcote)
  sam: number // salaire annuel moyen (25 best, capped, revalued)
  points: number // AGIRC-ARRCO points
  pRG: number // régime général annual pension
  pComp: number // complémentaire annual pension
  total: number // €/yr
  lastSalary: number
  replacementRate: number // total / lastSalary
  totalContributions: number // retirement contributions paid over the career (employer+employee)
  employeeContributions: number // employee share of that total
  contributionsByYear: { year: number; salary: number; contribution: number; employee: number; cumulative: number }[]
}

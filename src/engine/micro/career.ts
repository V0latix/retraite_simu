// Build a year-by-year career from parametric inputs (spec §5.1).
import type { Career, CareerParams } from './types'

export function synthesizeCareer(p: CareerParams): Career {
  const endYear = p.birthYear + p.retirementAge - 1 // last year worked
  const years = Math.max(0, endYear - p.startYear + 1)
  const salaryByYear: number[] = []
  for (let i = 0; i < years; i++) {
    salaryByYear.push(p.startSalary * Math.pow(1 + p.annualGrowth, i) * p.partTimeFactor)
  }
  return {
    birthYear: p.birthYear,
    startYear: p.startYear,
    status: p.status,
    salaryByYear,
    longCareer: p.longCareer,
  }
}

/** Prefill presets (start salary in 2025 €, indicative). */
export const PRESETS: Record<string, CareerParams> = {
  smic: {
    birthYear: 1985,
    startYear: 2005,
    startSalary: 21000,
    annualGrowth: 0.008,
    status: 'non-cadre',
    partTimeFactor: 1,
    retirementAge: 64,
  },
  median: {
    birthYear: 1985,
    startYear: 2007,
    startSalary: 26000,
    annualGrowth: 0.015,
    status: 'non-cadre',
    partTimeFactor: 1,
    retirementAge: 64,
  },
  cadre: {
    birthYear: 1985,
    startYear: 2009,
    startSalary: 34000,
    annualGrowth: 0.025,
    status: 'cadre',
    partTimeFactor: 1,
    retirementAge: 64,
  },
  'carriere-longue': {
    birthYear: 1985,
    startYear: 2003, // début à ~18 ans
    startSalary: 21000,
    annualGrowth: 0.01,
    status: 'non-cadre',
    partTimeFactor: 1,
    retirementAge: 60, // départ anticipé carrières longues, taux plein maintenu
    longCareer: true,
  },
}

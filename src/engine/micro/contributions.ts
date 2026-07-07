// Retirement contributions paid over a career (spec §5, data layer §8).
// Total = employer + employee, tiered on the PASS. Constant (real) euros.
import params from '../../data/pensionParams.json'
import type { Career } from './types'

const c = params.contributions

export interface ContribYear {
  year: number
  salary: number
  contribution: number // total (employer + employee) this year
  employee: number // employee share this year
  cumulative: number // running total (employer + employee)
}
export interface ContribResult {
  byYear: ContribYear[]
  total: number
  employeeTotal: number
}

/** Tiered total contribution for one year's salary given that year's PASS. */
function tierAmounts(salary: number, pass: number) {
  const t1 = Math.min(salary, pass)
  const t2 = Math.min(Math.max(salary - pass, 0), (c.ceilingPass - 1) * pass)
  return {
    total: t1 * c.rateT1 + t2 * c.rateT2,
    employee: t1 * c.employeeShareT1 + t2 * c.employeeShareT2,
  }
}

export function computeContributions(career: Career, passByYear: (year: number) => number): ContribResult {
  const byYear: ContribYear[] = []
  let cumulative = 0
  let employeeTotal = 0
  career.salaryByYear.forEach((salary, i) => {
    const year = career.startYear + i
    const { total, employee } = tierAmounts(salary, passByYear(year))
    cumulative += total
    employeeTotal += employee
    byYear.push({ year, salary, contribution: total, employee, cumulative })
  })
  return { byYear, total: cumulative, employeeTotal }
}

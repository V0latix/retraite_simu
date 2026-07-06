// AGIRC-ARRCO complémentaire — régime en points (spec §5.3).
import params from '../../data/pensionParams.json'
import type { Career, MicroContext } from './types'

const aa = params.agircArrco

export interface ComplResult {
  points: number
  pComp: number
}

export function computeComplementaire(career: Career, ctx: MicroContext, liquidationYear: number): ComplResult {
  // Points acquired each year = contribution / purchase price (salaire de référence).
  let points = 0
  career.salaryByYear.forEach((w, i) => {
    const year = career.startYear + i
    const contribution = w * aa.acquisitionRate
    points += contribution / ctx.salaireRefByYear(year)
  })
  // Pension = points × value of service at liquidation × solidarity coefficient.
  const pComp = points * ctx.pointValueByYear(liquidationYear) * aa.solidarityMalus
  return { points, pComp }
}

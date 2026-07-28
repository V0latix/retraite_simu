// Total pension = RG + complémentaire, plus the replacement rate (spec §5.3/§5.4).
import { computeComplementaire } from './agircArrco'
import { computeContributions } from './contributions'
import { computeRG } from './regimeGeneral'
import type { Career, MicroContext, PensionBreakdown } from './types'

export function computePension(career: Career, ctx: MicroContext): PensionBreakdown {
  const retirementAge = career.startYear + career.salaryByYear.length - career.birthYear
  const liquidationYear = career.birthYear + retirementAge

  const rg = computeRG(career, ctx, liquidationYear)
  const comp = computeComplementaire(career, ctx, liquidationYear)
  const contrib = computeContributions(career, ctx.passByYear)
  const total = rg.pRG + comp.pComp
  const lastSalary = career.salaryByYear[career.salaryByYear.length - 1] ?? 0

  return {
    liquidationYear,
    retirementAge,
    quartersWorked: rg.quarters,
    rate: rg.rate,
    sam: rg.sam,
    points: comp.points,
    pRG: rg.pRG,
    micoApplied: rg.micoApplied,
    belowLegalAge: retirementAge < ctx.legalAge && !career.longCareer,
    legalAgeAtLiquidation: ctx.legalAge,
    pComp: comp.pComp,
    total,
    lastSalary,
    replacementRate: lastSalary > 0 ? total / lastSalary : 0,
    totalContributions: contrib.total,
    employeeContributions: contrib.employeeTotal,
    contributionsByYear: contrib.byYear,
    lifeExpectancyAtRetirement: ctx.lifeExpectancy(retirementAge, liquidationYear),
  }
}

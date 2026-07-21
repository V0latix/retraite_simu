// Régime général (CNAV) pension (spec §5.2).
import params from '../../data/pensionParams.json'
import type { Career, MicroContext } from './types'

const rg = params.regimeGeneral

export interface RGResult {
  sam: number
  rate: number
  quarters: number
  pRG: number
  micoApplied: boolean
}

/** 4 quarters per year worked (simplified — real rules key quarters off earnings). */
export function quartersWorked(career: Career): number {
  return career.salaryByYear.filter((s) => s > 0).length * 4
}

export function computeRG(career: Career, ctx: MicroContext, liquidationYear: number): RGResult {
  // SAM: each year's salary capped at that year's PASS, revalued to liquidation,
  // then the mean of the 25 best.
  const revalued = career.salaryByYear.map((w, i) => {
    const year = career.startYear + i
    const capped = Math.min(w, ctx.passByYear(year))
    return capped * ctx.revalCoef(year, liquidationYear)
  })
  const best = revalued.sort((a, b) => b - a).slice(0, rg.samWindow)
  const sam = best.length ? best.reduce((s, v) => s + v, 0) / best.length : 0

  // Rate: décote for missing quarters, surcote for excess (spec §5.2). Carrières longues
  // (§3.2) keep the taux plein at the early age despite missing quarters (longCareer flag).
  const quarters = quartersWorked(career)
  const rawMissing = Math.max(0, ctx.requiredQuarters - quarters)
  const missing = career.longCareer ? 0 : rawMissing
  const excess = Math.max(0, quarters - ctx.requiredQuarters)
  let rate = rg.fullRate
  if (missing > 0) rate = rg.fullRate * (1 - rg.decotePerQuarter * Math.min(missing, rg.maxDecoteQuarters))
  else if (excess > 0) rate = rg.fullRate * (1 + rg.surcotePerQuarter * excess)

  // Proratisation on the required duration.
  const prorata = Math.min(quarters / ctx.requiredQuarters, 1)
  let pRG = sam * rate * prorata

  // MICO (§3.5): the base pension is floored to the minimum contributif, itself proratised by
  // insurance duration. Real rule applies only at taux plein (no décote) — ponytail: we gate on
  // `missing === 0` and ignore the durée d'assurance tous régimes / plafond écrêtement.
  const mico = rg.mico.montantAnnuel * prorata
  const micoApplied = missing === 0 && pRG < mico
  if (micoApplied) pRG = mico

  return { sam, rate, quarters, pRG, micoApplied }
}

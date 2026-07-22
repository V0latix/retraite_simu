// Macro → micro bridge (spec §5.4): derive PASS(t), point value V(t), SR(t) and
// the revaluation coefficient from the selected macro scenario. The point value
// growth reacts to that scenario's system dependency, so a demographically worse
// scenario mechanically lowers the complémentaire.
import { OMEGA, type Sex, type TimeSeries } from '../types'
import type { MicroContext } from './types'
import params from '../../data/pensionParams.json'
import system from '../../data/systemParams.json'

const BASE = params.baseYear
const g = system.economy.productivity // real wage growth (productivity)

/** Period life expectancy at an exact age, unisex average, from the scenario qx. */
export function periodLifeExpectancy(mortality: (year: number, age: number, sex: Sex) => number, age: number, year: number): number {
  let surv = 1
  let e = 0.5 // half-year mid-period correction
  for (let a = age; a < OMEGA; a++) {
    const q = (mortality(year, a, 'H') + mortality(year, a, 'F')) / 2
    surv *= 1 - q
    e += surv
  }
  return e
}

// The whole micro calc runs in CONSTANT (real, base-year) euros. That keeps
// inflation out of it: pensions are revalued on prices, so in real terms
// revaluation is neutral (revalCoef = 1) and PASS/SR grow only in real terms
// (productivity). Point value in real terms is flat unless demography bites.

/** Build a per-scenario context from that scenario's macro TimeSeries. */
export function buildMicroContext(
  macroSeries: TimeSeries,
  mortality: (year: number, age: number, sex: Sex) => number,
  legalAge: number,
  requiredQuarters: number,
): MicroContext {
  const depByYear = new Map(macroSeries.map((r) => [r.year, r.dependencySystem]))
  const depBase = macroSeries[0]?.dependencySystem ?? 0
  const k = params.coupling.couplingSensitivity

  const passAt = (year: number) => params.regimeGeneral.passBase * Math.pow(1 + g, year - BASE)

  // Observed AGIRC-ARRCO series (real, base-2025 €): use the real historical point value and
  // salaire de référence for years we have data (2019→lastHistYear=BASE), model only beyond.
  // Anchored at BASE = last history year so projected behaviour is unchanged.
  const hist = params.agircArrco.historyReal2025
  const histPV = new Map(hist.map((h) => [h.year, h.pointValue]))
  const histSR = new Map(hist.map((h) => [h.year, h.salaireReference]))
  const firstHist = hist[0].year
  const lastHist = hist[hist.length - 1].year

  // Salaire de référence: real observed value where known, else productivity extrapolation.
  const srAt = (year: number) => {
    if (year <= firstHist) return histSR.get(firstHist)!
    if (year <= lastHist) return histSR.get(year)!
    return histSR.get(lastHist)! * Math.pow(1 + g, year - lastHist)
  }

  // Real point value: observed years use the real historical value; beyond, price indexation
  // is flat in real terms minus a haircut proportional to how far system dependency sits above
  // its base level.
  const pointValueAt = (year: number) => {
    if (year <= firstHist) return histPV.get(firstHist)!
    if (year <= lastHist) return histPV.get(year)!
    let v = histPV.get(lastHist)!
    for (let y = lastHist + 1; y <= year; y++) {
      const dep = depByYear.get(y) ?? depBase
      const idx = Math.max(-0.05, -k * (dep - depBase))
      v *= 1 + idx
    }
    return v
  }

  return {
    legalAge,
    requiredQuarters,
    passByYear: passAt,
    pointValueByYear: pointValueAt,
    salaireRefByYear: srAt,
    // Real euros throughout → revaluation is neutral.
    revalCoef: () => 1,
    lifeExpectancy: (age, year) => periodLifeExpectancy(mortality, age, year),
  }
}

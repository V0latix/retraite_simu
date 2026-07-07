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
function periodLifeExpectancy(mortality: (year: number, age: number, sex: Sex) => number, age: number, year: number): number {
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
  const srAt = (year: number) => params.agircArrco.salaireReference * Math.pow(1 + g, year - BASE)

  // Real point value: price indexation is flat in real terms (0), minus a haircut
  // proportional to how far system dependency sits above its base level.
  const pointValueAt = (year: number) => {
    let v = params.agircArrco.pointValue
    for (let y = BASE + 1; y <= year; y++) {
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

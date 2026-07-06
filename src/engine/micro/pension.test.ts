import { describe, expect, it } from 'vitest'
import central from '../../data/scenarios/central.json'
import fertilityLow from '../../data/scenarios/fertility-low.json'
import initialPyramid from '../../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../../data/loader'
import type { InitialPyramid, ScenarioData } from '../../data/schema'
import { project } from '../project'
import { PRESETS, synthesizeCareer } from './career'
import { buildMicroContext } from './coupling'
import { computePension } from './pension'
import { computeRG } from './regimeGeneral'
import type { Career, MicroContext } from './types'

const pyr = initialPyramid as InitialPyramid

// Flat synthetic context for pure RG unit tests.
const flatCtx: MicroContext = {
  legalAge: 64,
  requiredQuarters: 172,
  passByYear: () => 47100,
  pointValueByYear: () => 1.4386,
  salaireRefByYear: () => 20.191,
  revalCoef: () => 1,
}

const career = (startYear: number, nYears: number, salary: number): Career => ({
  birthYear: 1985,
  startYear,
  status: 'non-cadre',
  salaryByYear: Array(nYears).fill(salary),
})

describe('career synthesis', () => {
  it('length matches career span and grows with time', () => {
    const c = synthesizeCareer(PRESETS.median)
    expect(c.salaryByYear.length).toBe(PRESETS.median.birthYear + PRESETS.median.retirementAge - PRESETS.median.startYear)
    expect(c.salaryByYear.at(-1)!).toBeGreaterThan(c.salaryByYear[0])
  })
})

describe('régime général', () => {
  it('SAM caps each year at the PASS and averages the 25 best', () => {
    const { sam } = computeRG(career(2000, 43, 60000), flatCtx, 2043)
    expect(sam).toBeCloseTo(47100, -1) // capped at PASS, revalCoef=1
  })

  it('full 172 quarters → full rate 0.50', () => {
    const { rate, quarters } = computeRG(career(2000, 43, 30000), flatCtx, 2043)
    expect(quarters).toBe(172)
    expect(rate).toBeCloseTo(0.5, 5)
  })

  it('décote reduces the rate, surcote raises it', () => {
    const short = computeRG(career(2010, 30, 30000), flatCtx, 2040) // 120 < 172 quarters
    const long = computeRG(career(1998, 46, 30000), flatCtx, 2044) // 184 > 172 quarters
    expect(short.rate).toBeLessThan(0.5)
    expect(long.rate).toBeGreaterThan(0.5)
  })

  it('proratisation reduces pension for short careers', () => {
    const short = computeRG(career(2015, 20, 30000), flatCtx, 2035)
    // 80 quarters / 172 → prorata ~0.465, plus décote
    expect(short.pRG).toBeLessThan(30000 * 0.5 * 0.5)
  })
})

describe('macro → micro coupling (§5.4)', () => {
  const ctxFor = (data: ScenarioData) => {
    const series = project(buildInitialState(pyr), buildHypotheses(data), 2075, ECON_INIT)
    return buildMicroContext(series, 64, 172)
  }
  // A younger cohort liquidates later (2064), where scenarios have diverged.
  const young = synthesizeCareer({ ...PRESETS.median, birthYear: 2000, startYear: 2022 })

  it('the same career yields a different complémentaire per scenario', () => {
    const pCentral = computePension(young, ctxFor(central as unknown as ScenarioData))
    const pLow = computePension(young, ctxFor(fertilityLow as unknown as ScenarioData))
    expect(pLow.pComp).not.toBeCloseTo(pCentral.pComp, 0)
    // Lower fertility → higher dependency → lower complémentaire.
    expect(pLow.pComp).toBeLessThan(pCentral.pComp)
  })

  it('replacement rate lands in a plausible band', () => {
    for (const preset of Object.values(PRESETS)) {
      const p = computePension(synthesizeCareer(preset), ctxFor(central as unknown as ScenarioData))
      expect(p.replacementRate).toBeGreaterThan(0.3)
      expect(p.replacementRate).toBeLessThan(0.9)
    }
  })
})

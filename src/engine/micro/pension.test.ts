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
  lifeExpectancy: () => 23,
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

  it('MICO (§3.5) floors a low full-rate pension to the minimum', () => {
    const low = computeRG(career(2000, 43, 10000), flatCtx, 2043) // 172 quarters, taux plein
    expect(low.micoApplied).toBe(true)
    expect(low.pRG).toBeCloseTo(8970, 0) // floored (raw = 10000·0.5·1 = 5000)
    const normal = computeRG(career(2000, 43, 30000), flatCtx, 2043)
    expect(normal.micoApplied).toBe(false) // 15000 > MICO
  })

  it('MICO does not apply when the rate carries a décote (missing quarters)', () => {
    const short = computeRG(career(2015, 20, 10000), flatCtx, 2035) // 80 quarters → décote
    expect(short.micoApplied).toBe(false)
    expect(short.pRG).toBeLessThan(8970)
  })

  it('carrières longues (§3.2) keep the taux plein despite missing quarters', () => {
    const c = career(2003, 40, 25000) // 160 < 172 quarters → décote normally
    expect(computeRG(c, flatCtx, 2043).rate).toBeLessThan(0.5)
    expect(computeRG({ ...c, longCareer: true }, flatCtx, 2043).rate).toBeCloseTo(0.5, 5)
  })
})

describe('macro → micro coupling (§5.4)', () => {
  const ctxFor = (data: ScenarioData) => {
    const h = buildHypotheses(data)
    const series = project(buildInitialState(pyr), h, 2075, ECON_INIT)
    return buildMicroContext(series, h.mortality, 64, 172)
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

  it('career contributions accumulate and split employee/total correctly', () => {
    const p = computePension(synthesizeCareer(PRESETS.median), ctxFor(central as unknown as ScenarioData))
    expect(p.totalContributions).toBeGreaterThan(0)
    expect(p.employeeContributions).toBeGreaterThan(0)
    expect(p.employeeContributions).toBeLessThan(p.totalContributions) // total includes employer
    // cumulative is monotonically non-decreasing and ends at the total
    const cum = p.contributionsByYear.map((y) => y.cumulative)
    for (let i = 1; i < cum.length; i++) expect(cum[i]).toBeGreaterThanOrEqual(cum[i - 1])
    expect(cum.at(-1)).toBeCloseTo(p.totalContributions, 0)
  })

  it('a high salary above the PASS is taxed on both tiers', () => {
    const p = computePension(synthesizeCareer(PRESETS.cadre), ctxFor(central as unknown as ScenarioData))
    // cadre earns above the PASS → per-year contribution exceeds what T1 alone would give.
    const yr = p.contributionsByYear.at(-1)!
    expect(yr.contribution).toBeGreaterThan(0)
    expect(yr.contribution / yr.salary).toBeGreaterThan(0.26) // blended tier rate
  })

  it('replacement rate lands in a plausible band', () => {
    for (const preset of Object.values(PRESETS)) {
      const p = computePension(synthesizeCareer(preset), ctxFor(central as unknown as ScenarioData))
      expect(p.replacementRate).toBeGreaterThan(0.3)
      expect(p.replacementRate).toBeLessThan(0.9)
    }
  })
})

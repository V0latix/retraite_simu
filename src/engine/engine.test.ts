import { describe, expect, it } from 'vitest'
import central from '../data/scenarios/central.json'
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import type { InitialPyramid, ScenarioData } from '../data/schema'
import { stepDemography } from './demography'
import { project } from './project'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const state0 = () => buildInitialState(pyr)

describe('demography', () => {
  it('keeps population non-negative and finite each year', () => {
    const h = buildHypotheses(data)
    let state = state0()
    for (let i = 0; i < 45; i++) {
      state = stepDemography(state, h)
      for (let a = 0; a < state.H.length; a++) {
        expect(state.H[a]).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(state.H[a])).toBe(true)
      }
    }
  })
})

describe('project', () => {
  it('returns one result per year with a finite balance', () => {
    const series = project(state0(), buildHypotheses(data), 2070, ECON_INIT)
    expect(series).toHaveLength(2070 - pyr.meta.year + 1)
    for (const r of series) expect(Number.isFinite(r.balance)).toBe(true)
  })

  it('raising the legal age lowers the number of retirees', () => {
    const base = project(state0(), buildHypotheses(data, { legalAge: 62 }), 2040, ECON_INIT)
    const reform = project(state0(), buildHypotheses(data, { legalAge: 67 }), 2040, ECON_INIT)
    const y = base.length - 1
    expect(reform[y].retirees).toBeLessThan(base[y].retirees)
  })

  it('interest snowballs the cumulated debt but never touches the annual solde', () => {
    const noRate = project(state0(), buildHypotheses(data, { realInterestRate: 0 }), 2070, ECON_INIT)
    const withRate = project(state0(), buildHypotheses(data, { realInterestRate: 0.02 }), 2070, ECON_INIT)
    const y = noRate.length - 1
    // Deficits dominate → the cumul is negative; interest makes it strictly worse.
    expect(withRate[y].cumulativeDebt).toBeGreaterThan(noRate[y].cumulativeDebt)
    // The annual solde is identical: interest affects ONLY the cumul (COR-comparable).
    for (let i = 0; i < noRate.length; i++) expect(withRate[i].balance).toBe(noRate[i].balance)
  })

  it('worker exodus removes 25-40s: netMigration drops by the lever, solde 2050 degrades', () => {
    const base = project(state0(), buildHypotheses(data, { workerExodus: 0 }), 2050, ECON_INIT)
    const exodus = project(state0(), buildHypotheses(data, { workerExodus: 50000 }), 2050, ECON_INIT)
    const y = base.length - 1
    expect(exodus[y].netMigration).toBeCloseTo(base[y].netMigration - 50000, 0)
    expect(exodus[y].soldePctGdp).toBeLessThan(base[y].soldePctGdp)
    expect(exodus[y].contributors).toBeLessThan(base[y].contributors)
  })
})

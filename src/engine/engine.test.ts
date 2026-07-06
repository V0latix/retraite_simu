import { describe, expect, it } from 'vitest'
import { buildHypotheses, buildInitialState } from '../data/seed'
import { stepDemography, totalPopulation } from './demography'
import { project } from './project'

describe('demography', () => {
  it('keeps population non-negative and finite each year', () => {
    const h = buildHypotheses()
    let state = buildInitialState(2025)
    for (let i = 0; i < 50; i++) {
      state = stepDemography(state, h)
      for (let a = 0; a < state.H.length; a++) {
        expect(state.H[a]).toBeGreaterThanOrEqual(0)
        expect(state.F[a]).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(state.H[a])).toBe(true)
      }
    }
  })

  it('total population stays in a plausible band (no explosion/collapse)', () => {
    const h = buildHypotheses()
    let state = buildInitialState(2025)
    const start = totalPopulation(state)
    for (let i = 0; i < 45; i++) state = stepDemography(state, h)
    const end = totalPopulation(state)
    // Wide band: this only guards against runaway/collapse. The parametric seed
    // pyramid is young-heavy, so realistic totals wait on Phase 0 INSEE data.
    expect(end).toBeGreaterThan(start * 0.5)
    expect(end).toBeLessThan(start * 2)
  })
})

describe('project', () => {
  it('returns one result per year with a finite balance', () => {
    const series = project(buildInitialState(2025), buildHypotheses(), 2070)
    expect(series).toHaveLength(2070 - 2025 + 1)
    for (const r of series) expect(Number.isFinite(r.balance)).toBe(true)
  })

  it('raising the legal age lowers the number of retirees', () => {
    const base = project(buildInitialState(2025), buildHypotheses({ legalAge: 62 }), 2040)
    const reform = project(buildInitialState(2025), buildHypotheses({ legalAge: 67 }), 2040)
    const y = base.length - 1
    expect(reform[y].retirees).toBeLessThan(base[y].retirees)
  })
})

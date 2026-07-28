import { describe, expect, it } from 'vitest'
import central from '../../data/scenarios/central.json'
import initialPyramid from '../../data/initialPyramid.json'
import leeCarter from '../../data/leeCarter.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../../data/loader'
import type { InitialPyramid, LeeCarterFit, ScenarioData } from '../../data/schema'
import { project } from '../project'
import { runStochastic, type FanMetric } from './fanchart'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const fit = leeCarter as LeeCarterFit
const opts = { draws: 120, horizon: 2070, policy: {}, seed: 42 }
const run = () => runStochastic(buildInitialState(pyr), data, fit, ECON_INIT, opts)

describe('Lee-Carter fit', () => {
  it('β sums to 1 and κ drifts down (mortality improved)', () => {
    for (const sex of ['H', 'F'] as const) {
      expect(fit[sex].beta.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2)
      expect(fit[sex].drift).toBeLessThan(0)
      expect(fit[sex].sigma).toBeGreaterThan(0)
    }
  })
})

describe('fan chart', () => {
  const metrics: FanMetric[] = ['solde', 'dependency', 'share65']

  it('percentiles are ordered every year and metric', () => {
    const fan = run()
    for (const m of metrics) {
      for (const b of fan[m]) {
        expect(b.p5).toBeLessThanOrEqual(b.p25)
        expect(b.p25).toBeLessThanOrEqual(b.p50)
        expect(b.p50).toBeLessThanOrEqual(b.p75)
        expect(b.p75).toBeLessThanOrEqual(b.p95)
      }
    }
  })

  it('median tracks the deterministic central', () => {
    const fan = run()
    const det = project(buildInitialState(pyr), buildHypotheses(data), 2070, ECON_INIT)
    const detLast = det.at(-1)!
    const solde = fan.solde.at(-1)!
    expect(solde.p50).toBeCloseTo(detLast.soldePctGdp, 2)
  })

  it('uncertainty widens with the horizon', () => {
    const fan = run()
    const width = (b: { p5: number; p95: number }) => b.p95 - b.p5
    const early = fan.share65.find((b) => b.year === 2030)!
    const late = fan.share65.find((b) => b.year === 2070)!
    expect(width(late)).toBeGreaterThan(width(early))
  })

  it('is reproducible for a fixed seed', () => {
    expect(run().solde.at(-1)!.p50).toBe(run().solde.at(-1)!.p50)
  })
})

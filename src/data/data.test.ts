import { describe, expect, it } from 'vitest'
import { totalPopulation } from '../engine/demography'
import { project } from '../engine/project'
import { buildHypotheses, buildInitialState, ECON_INIT } from './loader'
import central from './scenarios/central.json'
import initialPyramid from './initialPyramid.json'
import type { InitialPyramid, ScenarioData } from './schema'

const data = central as unknown as ScenarioData
const pyr = initialPyramid as InitialPyramid

describe('INSEE data integrity', () => {
  it('initial pyramid sums to ~68M (INSEE 2025)', () => {
    const total = totalPopulation(buildInitialState(pyr))
    expect(total).toBeGreaterThan(66e6)
    expect(total).toBeLessThan(69e6)
  })

  it('qx is a probability, increasing with age', () => {
    const h = buildHypotheses(data)
    for (const sex of ['H', 'F'] as const) {
      expect(h.mortality(2025, 40, sex)).toBeGreaterThan(0)
      expect(h.mortality(2025, 40, sex)).toBeLessThan(1)
      expect(h.mortality(2025, 80, sex)).toBeGreaterThan(h.mortality(2025, 40, sex))
    }
  })

  it('mortality improves over time (qx 2070 < qx 2025)', () => {
    const h = buildHypotheses(data)
    expect(h.mortality(2070, 60, 'H')).toBeLessThan(h.mortality(2025, 60, 'H'))
  })

  it('fertility is zero outside 15-50 and peaks near 30', () => {
    const h = buildHypotheses(data)
    expect(h.fertility(2025, 12)).toBe(0)
    expect(h.fertility(2025, 55)).toBe(0)
    expect(h.fertility(2025, 30)).toBeGreaterThan(h.fertility(2025, 18))
  })

  it('extrapolation past 2070: hold freezes, values stay finite', () => {
    const h = buildHypotheses(data, {}, 'hold')
    expect(h.mortality(2100, 60, 'H')).toBe(h.mortality(2070, 60, 'H'))
    const trend = buildHypotheses(data, {}, 'trend')
    expect(Number.isFinite(trend.mortality(2100, 60, 'H'))).toBe(true)
  })
})

describe('calibration vs INSEE central', () => {
  it('reproduces INSEE 2070 total population within tolerance (~68.1M)', () => {
    const series = project(buildInitialState(pyr), buildHypotheses(data), 2070, ECON_INIT)
    const total2070 = totalPopulation({
      year: 2070,
      H: Float64Array.from(series.at(-1)!.pyramid.H),
      F: Float64Array.from(series.at(-1)!.pyramid.F),
    })
    // INSEE central: 68.1M on 1 Jan 2070. Our cohort-component from the INSEE
    // 2025 pyramid with INSEE qx/fertility/migration should land close.
    expect(total2070 / 1e6).toBeGreaterThan(65)
    expect(total2070 / 1e6).toBeLessThan(71)
  })

  it('population ages: 65+ share rises from 2025 to 2070', () => {
    const series = project(buildInitialState(pyr), buildHypotheses(data), 2070, ECON_INIT)
    const share65 = (r: (typeof series)[number]) => {
      let old = 0
      let tot = 0
      for (let a = 0; a <= 105; a++) {
        const n = r.pyramid.H[a] + r.pyramid.F[a]
        tot += n
        if (a >= 65) old += n
      }
      return old / tot
    }
    expect(share65(series.at(-1)!)).toBeGreaterThan(share65(series[0]))
  })
})

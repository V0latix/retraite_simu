import { describe, expect, it } from 'vitest'
import central from '../data/scenarios/central.json'
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import corRef from '../data/corReference.json'
import type { InitialPyramid, ScenarioData } from '../data/schema'
import { project } from './project'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const series = () => project(buildInitialState(pyr), buildHypotheses(data), 2070, ECON_INIT)
const at = (s: ReturnType<typeof series>, y: number) => s.find((r) => r.year === y)!

describe('COR calibration', () => {
  // Base year is anchored to the COR *EEC* convention (effort de l'État constant):
  // dépenses ~13.9% PIB, solde ~-0.48% PIB (~-8.7 Md€ in 2025), not the ~0 of the EPR headline.
  it('base year is pinned to the COR EEC reference (dépenses ~13.9%, solde ~-0.48%)', () => {
    const r = at(series(), 2025)
    expect(r.depensesPctGdp).toBeCloseTo(0.139, 3)
    expect(r.soldePctGdp).toBeCloseTo(-0.0048, 3)
    expect(r.gdp).toBeGreaterThan(0)
  })

  // The central scenario is calibrated to track COR EEC at EVERY horizon, not just the
  // endpoints — this pins the mid-century, which the raw taper used to overshoot to ~-2.5%.
  it('central tracks the COR EEC solde across all horizons', () => {
    const s = series()
    const corSolde: Record<number, number> = { 2030: -0.0047, 2040: -0.0076, 2050: -0.0107, 2060: -0.0116, 2070: -0.0139 }
    for (const [y, target] of Object.entries(corSolde)) {
      expect(at(s, Number(y)).soldePctGdp).toBeCloseTo(target, 3)
    }
  })

  it('central dépenses stay near the COR ~14% band (no mid-century overshoot)', () => {
    for (const y of [2030, 2040, 2050, 2060, 2070]) {
      const d = at(series(), y).depensesPctGdp
      expect(d).toBeGreaterThan(0.135)
      expect(d).toBeLessThan(0.145)
    }
  })

  it('every year has finite % of GDP fields', () => {
    for (const r of series()) {
      expect(Number.isFinite(r.soldePctGdp)).toBe(true)
      expect(Number.isFinite(r.depensesPctGdp)).toBe(true)
      expect(r.gdp).toBeGreaterThan(0)
    }
  })

  it('raising the contribution rate improves the long-run solde', () => {
    const base = project(buildInitialState(pyr), buildHypotheses(data, { contributionRate: 0.28 }), 2070, ECON_INIT)
    const higher = project(buildInitialState(pyr), buildHypotheses(data, { contributionRate: 0.33 }), 2070, ECON_INIT)
    expect(at(higher, 2070).soldePctGdp).toBeGreaterThan(at(base, 2070).soldePctGdp)
  })

  it('higher productivity growth improves the long-run solde', () => {
    const low = project(buildInitialState(pyr), buildHypotheses(data, { productivity: 0.006 }), 2070, ECON_INIT)
    const high = project(buildInitialState(pyr), buildHypotheses(data, { productivity: 0.016 }), 2070, ECON_INIT)
    expect(at(high, 2070).soldePctGdp).toBeGreaterThan(at(low, 2070).soldePctGdp)
  })

  it('COR reference file is well-formed', () => {
    expect(corRef.points.length).toBeGreaterThanOrEqual(5)
    expect(corRef.points.at(-1)!.year).toBe(2070)
  })
})

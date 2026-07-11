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

  it('2070 solde is in a broad band around COR (-1.4% PIB)', () => {
    const r = at(series(), 2070)
    expect(r.soldePctGdp).toBeGreaterThan(-0.02)
    expect(r.soldePctGdp).toBeLessThan(-0.005)
    expect(r.depensesPctGdp).toBeGreaterThan(0.13)
    expect(r.depensesPctGdp).toBeLessThan(0.16)
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

  it('COR reference file is well-formed', () => {
    expect(corRef.points.length).toBeGreaterThanOrEqual(5)
    expect(corRef.points.at(-1)!.year).toBe(2070)
  })
})

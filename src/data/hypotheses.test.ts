import { describe, expect, it } from 'vitest'
import central from './scenarios/central.json'
import type { ScenarioData } from './schema'
import { applyHypotheses } from './hypotheses'

const data = central as unknown as ScenarioData
const idx = (year: number) => data.years.indexOf(year)
const tfr = (s: ScenarioData, y: number) => s.fertility[idx(y)].reduce((a, b) => a + b, 0)
const netMig = (s: ScenarioData, y: number) =>
  s.migration.H[idx(y)].reduce((a, b) => a + b, 0) + s.migration.F[idx(y)].reduce((a, b) => a + b, 0)

describe('applyHypotheses', () => {
  it('re-targets fertility onto the slider value, every year', () => {
    const out = applyHypotheses(data, { tfr: 1.45 })
    for (const y of [2025, 2040, 2070]) expect(tfr(out, y)).toBeCloseTo(1.45, 6)
    expect(tfr(out, 2025)).toBeLessThan(tfr(data, 2025)) // central sits at 1,8
  })

  it('re-targets net migration onto the slider value, every year', () => {
    const out = applyHypotheses(data, { netMigration: 176_000 })
    for (const y of [2025, 2040, 2070]) expect(netMig(out, y)).toBeCloseTo(176_000, 3)
    expect(netMig(out, 2030)).toBeGreaterThan(netMig(data, 2030)) // central sits at +70 000
  })

  it('rescales the level only — age/sex profiles and mortality are untouched', () => {
    const out = applyHypotheses(data, { tfr: 1.45, netMigration: 176_000 })
    expect(out.years).toEqual(data.years)
    expect(out.mortality).toEqual(data.mortality)
    // Same shape: every age keeps its share of the total (to floating-point noise).
    const share = (row: number[]) => {
      const s = row.reduce((a, b) => a + b, 0)
      return row.map((v) => v / s)
    }
    const sameShape = (a: number[], b: number[]) =>
      share(a).forEach((v, i) => expect(v).toBeCloseTo(share(b)[i], 12))
    sameShape(out.fertility[0], data.fertility[0])
    sameShape(out.migration.H[0], data.migration.H[0])
    // H/F split preserved too (one factor shared by both sexes).
    const hShare = (s: ScenarioData) => s.migration.H[0].reduce((a, b) => a + b, 0) / netMig(s, s.years[0])
    expect(hShare(out)).toBeCloseTo(hShare(data), 12)
  })

  it('is the identity when no hypothesis is set (scenario keeps its own trajectory)', () => {
    const out = applyHypotheses(data, { legalAge: 62 })
    expect(out.fertility).toBe(data.fertility)
    expect(out.migration).toBe(data.migration)
  })
})

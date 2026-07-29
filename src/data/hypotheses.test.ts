import { describe, expect, it } from 'vitest'
import central from './scenarios/central.json'
import type { ScenarioData } from './schema'
import { applyHypotheses } from './hypotheses'
import { formatAge, REFORM_PRESETS, scheduleSummary } from './reforms'

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

describe('reform template presentation', () => {
  it('formats a fractional age in years and months', () => {
    expect(formatAge(64)).toBe('64 ans')
    expect(formatAge(62.75)).toBe('62 ans 9 mois')
    expect(formatAge(63.25)).toBe('63 ans 3 mois')
  })

  it('summarises a calendar, and stays silent when there is nothing to phase in', () => {
    expect(scheduleSummary(REFORM_PRESETS['suspension-2026'].schedule!)).toBe(
      '62 ans 9 mois en 2026 → 64 ans en 2033',
    )
    expect(scheduleSummary(REFORM_PRESETS['avant-2023'].schedule!)).toBeNull() // âge plat, seule la durée bouge
  })

  it('every template is a valid policy delta, calendars sorted and in range', () => {
    for (const [key, r] of Object.entries(REFORM_PRESETS)) {
      expect(r.label, key).toBeTruthy()
      expect(r.source, key).toBeTruthy()
      for (const a of r.schedule ?? []) {
        expect(a.year, key).toBeGreaterThanOrEqual(2025)
        if (a.legalAge != null) expect(a.legalAge, key).toBeGreaterThanOrEqual(60)
        if (a.legalAge != null) expect(a.legalAge, key).toBeLessThanOrEqual(70)
      }
      const years = (r.schedule ?? []).map((a) => a.year)
      expect(years, key).toEqual([...years].sort((x, y) => x - y))
    }
  })
})

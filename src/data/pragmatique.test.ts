import { describe, expect, it } from 'vitest'
import central from './scenarios/central.json'
import type { ScenarioData } from './schema'
import { buildPragmatique } from './pragmatique'

const data = central as unknown as ScenarioData
const prag = buildPragmatique(data)
const idx = (year: number) => prag.years.indexOf(year)
const tfr = (s: ScenarioData, y: number) => s.fertility[idx(y)].reduce((a, b) => a + b, 0)
const netMig = (s: ScenarioData, y: number) =>
  s.migration.H[idx(y)].reduce((a, b) => a + b, 0) + s.migration.F[idx(y)].reduce((a, b) => a + b, 0)

describe('buildPragmatique', () => {
  it('re-targets fertility on the observed trend: 1,53 (2025) → 1,45 (2040), then flat', () => {
    expect(tfr(prag, 2025)).toBeCloseTo(1.53, 2)
    expect(tfr(prag, 2040)).toBeCloseTo(1.45, 2)
    expect(tfr(prag, 2070)).toBeCloseTo(1.45, 2)
    // Below the central 1,8 at every horizon.
    expect(tfr(prag, 2025)).toBeLessThan(tfr(data, 2025))
  })

  it('re-targets net migration to the observed ~+176 000/an', () => {
    for (const y of [2025, 2040, 2070]) expect(netMig(prag, y)).toBeCloseTo(176000, -2) // ±~50
    // Well above the central +70 000.
    expect(netMig(prag, 2030)).toBeGreaterThan(netMig(data, 2030))
  })

  it('preserves the age/sex profiles and leaves mortality untouched', () => {
    expect(prag.years).toEqual(data.years)
    expect(prag.ages).toEqual(data.ages)
    expect(prag.mortality).toEqual(data.mortality)
    // Fertility peak age is unchanged (only the level is rescaled).
    const peak = (s: ScenarioData) => s.fertility[0].indexOf(Math.max(...s.fertility[0]))
    expect(peak(prag)).toBe(peak(data))
  })
})

import { describe, expect, it } from 'vitest'
import { mergeObservedProjected, toRows } from './observed'

const obs = [
  { year: 2022, v: 1 },
  { year: 2023, v: 2 },
  { year: 2024, v: 3 },
]
const proj = [
  { year: 2025, v: 10 },
  { year: 2026, v: 11 },
]

describe('mergeObservedProjected', () => {
  it('splits observed and projected on the join year', () => {
    const rows = mergeObservedProjected(obs, proj, ['v'], 2024)
    expect(rows.map((r) => r.year)).toEqual([2022, 2023, 2024, 2025, 2026])

    expect(rows.map((r) => r.obs_v)).toEqual([1, 2, 3, null, null])
    // The join year carries the observed value into the projected field so the
    // solid and dashed segments meet instead of leaving a gap.
    expect(rows.map((r) => r.proj_v)).toEqual([null, null, 3, 10, 11])
  })

  it('prefers a real projected value at the join year when the model supplies one', () => {
    const rows = mergeObservedProjected(obs, [{ year: 2024, v: 99 }, ...proj], ['v'], 2024)
    expect(rows.find((r) => r.year === 2024)?.proj_v).toBe(99)
    expect(rows.find((r) => r.year === 2024)?.obs_v).toBe(3)
  })

  it('keeps holes as null rather than bridging them', () => {
    const rows = mergeObservedProjected([{ year: 2023, v: null }, { year: 2024, v: 3 }], proj, ['v'], 2024)
    expect(rows.find((r) => r.year === 2023)?.obs_v).toBeNull()
  })

  it('anchors the projection on the last real observed year when the frontier itself is a hole', () => {
    // Retirees lag a year: the value at the join year (2024) is null, the last real
    // point is 2023 — the dashed line must start there so it meets the solid line.
    const rows = mergeObservedProjected(
      [{ year: 2023, v: 5 }, { year: 2024, v: null }],
      [{ year: 2025, v: 10 }],
      ['v'],
      2024,
    )
    expect(rows.map((r) => r.year)).toEqual([2023, 2024, 2025])
    expect(rows.map((r) => r.obs_v)).toEqual([5, null, null])
    // Anchor at 2023 carries the observed value into the projected field; 2025 is the model.
    expect(rows.map((r) => r.proj_v)).toEqual([5, null, 10])
  })

  it('handles several keys at once', () => {
    const rows = mergeObservedProjected(
      [{ year: 2024, a: 1, b: 2 }],
      [{ year: 2025, a: 3, b: 4 }],
      ['a', 'b'],
      2024,
    )
    expect(rows[1]).toEqual({ year: 2025, obs_a: null, proj_a: 3, obs_b: null, proj_b: 4 })
  })
})

describe('toRows', () => {
  it('zips parallel arrays into year-keyed rows, missing values as null', () => {
    expect(toRows([2023, 2024], { a: [1, null], b: [2, 3] })).toEqual([
      { year: 2023, a: 1, b: 2 },
      { year: 2024, a: null, b: 3 },
    ])
  })
})

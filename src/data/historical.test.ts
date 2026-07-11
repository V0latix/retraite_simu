import { describe, expect, it } from 'vitest'
import { historical, historicalPyramid, LAST_OBSERVED_YEAR } from './loader'

const strictlyIncreasing = (ys: readonly number[]) => ys.every((y, i) => i === 0 || y > ys[i - 1])

describe('historical.json', () => {
  const { finance, demography, anchors } = historical

  it('carries contiguous, strictly increasing years', () => {
    expect(strictlyIncreasing(finance.years)).toBe(true)
    expect(strictlyIncreasing(demography.years)).toBe(true)
    expect(finance.years[0]).toBe(2002)
    expect(LAST_OBSERVED_YEAR).toBe(finance.years.at(-1))
  })

  it('has no NaN and keeps every series aligned with its year axis', () => {
    for (const [key, arr] of Object.entries(finance)) {
      if (key === 'years') continue
      expect(arr).toHaveLength(finance.years.length)
      for (const v of arr as (number | null)[]) expect(v === null || Number.isFinite(v)).toBe(true)
    }
  })

  it('reproduces the balance the COR publishes for 2024 (−0,1 % PIB)', () => {
    const i = finance.years.indexOf(2024)
    expect(finance.soldePctGdp[i]).toBeCloseTo(-0.0006, 4)
    // Dépenses ≈ 13,9 % PIB, the anchor the finance block is calibrated against.
    expect(finance.depensesPctGdp[i]).toBeCloseTo(0.139, 2)
  })

  it('keeps solde = ressources − dépenses', () => {
    finance.years.forEach((_, i) => {
      const [d, r, s] = [finance.depensesPctGdp[i], finance.resourcesPctGdp[i], finance.soldePctGdp[i]]
      if (d == null || r == null || s == null) return
      expect(r - d).toBeCloseTo(s, 4)
    })
  })

  it('anchors the cumulative-balance chart on published reserves', () => {
    expect(anchors.reserves2024).toBeGreaterThan(0)
    expect(anchors.gdp2024).toBeGreaterThan(2000)
    expect(anchors.reservesPctGdp).toBeCloseTo(anchors.reserves2024 / anchors.gdp2024, 5)
  })

  it('carries the observed fertility série ending below the 1,8 INSEE assumption', () => {
    const { years, icf } = demography.fertility
    expect(years).toHaveLength(icf.length)
    expect(strictlyIncreasing(years)).toBe(true)
    expect(years.at(-1)).toBe(2025)
    expect(icf.at(-1)).toBeCloseTo(1.53, 2) // 2025, France métropolitaine (INSEE)
    expect(Math.max(...icf)).toBeLessThan(2.1) // stays below génération-renewal threshold
    for (const v of icf) expect(Number.isFinite(v)).toBe(true)
  })

  it('shows the 65+ share rising over the observed period', () => {
    const { values } = demography.share65
    expect(values[0]).toBeGreaterThan(0.1)
    expect(values.at(-1)).toBeGreaterThan(values[0])
    expect(values.at(-1)).toBeLessThan(0.3)
  })
})

describe('historicalPyramid.json', () => {
  const total = (i: number) =>
    historicalPyramid.H[i].reduce((s, v) => s + v, 0) + historicalPyramid.F[i].reduce((s, v) => s + v, 0)

  it('spans 1946 (création du régime général) to 2025 with no gap', () => {
    expect(historicalPyramid.years[0]).toBe(1946)
    expect(historicalPyramid.years.at(-1)).toBe(2025)
    expect(strictlyIncreasing(historicalPyramid.years)).toBe(true)
    expect(historicalPyramid.years).toHaveLength(2025 - 1946 + 1)
  })

  it('matches the population INSEE publishes for 2025', () => {
    const i = historicalPyramid.years.indexOf(2025)
    expect(total(i)).toBe(68_605_616) // POP3, France
    expect(historicalPyramid.champ['2025']).toBe('France')
  })

  it('labels the champ break at 1991 rather than splicing two populations', () => {
    expect(historicalPyramid.champ['1990']).toBe('France métropolitaine')
    expect(historicalPyramid.champ['1991']).toBe('France')
  })

  it('grows from ~40M in 1946, every age bucket non-negative', () => {
    expect(total(0)).toBeGreaterThan(3.9e7)
    expect(total(0)).toBeLessThan(4.1e7)
    for (const row of [...historicalPyramid.H, ...historicalPyramid.F]) {
      expect(row).toHaveLength(106) // ages 0..OMEGA
      for (const v of row) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

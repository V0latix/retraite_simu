import { describe, expect, it } from 'vitest'
import central from '../data/scenarios/central.json'
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import type { InitialPyramid, ScenarioData } from '../data/schema'
import { stepDemography } from './demography'
import { project } from './project'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const state0 = () => buildInitialState(pyr)

describe('demography', () => {
  it('keeps population non-negative and finite each year', () => {
    const h = buildHypotheses(data)
    let state = state0()
    for (let i = 0; i < 45; i++) {
      state = stepDemography(state, h)
      for (let a = 0; a < state.H.length; a++) {
        expect(state.H[a]).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(state.H[a])).toBe(true)
      }
    }
  })
})

describe('project', () => {
  it('returns one result per year with a finite balance', () => {
    const series = project(state0(), buildHypotheses(data), 2070, ECON_INIT)
    expect(series).toHaveLength(2070 - pyr.meta.year + 1)
    for (const r of series) expect(Number.isFinite(r.balance)).toBe(true)
  })

  it('raising the legal age lowers the number of retirees', () => {
    const base = project(state0(), buildHypotheses(data, { legalAge: 62 }), 2040, ECON_INIT)
    const reform = project(state0(), buildHypotheses(data, { legalAge: 67 }), 2040, ECON_INIT)
    const y = base.length - 1
    expect(reform[y].retirees).toBeLessThan(base[y].retirees)
  })

  it('raising required quarters pushes back the exit age: more contributors, fewer retirees', () => {
    const base = project(state0(), buildHypotheses(data, { requiredQuarters: 160 }), 2040, ECON_INIT)
    const reform = project(state0(), buildHypotheses(data, { requiredQuarters: 188 }), 2040, ECON_INIT)
    const y = base.length - 1
    expect(reform[y].retirees).toBeLessThan(base[y].retirees)
    expect(reform[y].contributors).toBeGreaterThan(base[y].contributors)
  })

  it('interest snowballs the cumulated debt but never touches the annual solde', () => {
    const noRate = project(state0(), buildHypotheses(data, { realInterestRate: 0 }), 2070, ECON_INIT)
    const withRate = project(state0(), buildHypotheses(data, { realInterestRate: 0.02 }), 2070, ECON_INIT)
    const y = noRate.length - 1
    // Deficits dominate → the cumul is negative; interest makes it strictly worse.
    expect(withRate[y].cumulativeDebt).toBeGreaterThan(noRate[y].cumulativeDebt)
    // The annual solde is identical: interest affects ONLY the cumul (COR-comparable).
    for (let i = 0; i < noRate.length; i++) expect(withRate[i].balance).toBe(noRate[i].balance)
  })

  it('worker exodus removes 25-40s: netMigration drops by the lever, solde 2050 degrades', () => {
    const base = project(state0(), buildHypotheses(data, { workerExodus: 0 }), 2050, ECON_INIT)
    const exodus = project(state0(), buildHypotheses(data, { workerExodus: 50000 }), 2050, ECON_INIT)
    const y = base.length - 1
    expect(exodus[y].netMigration).toBeCloseTo(base[y].netMigration - 50000, 0)
    expect(exodus[y].soldePctGdp).toBeLessThan(base[y].soldePctGdp)
    expect(exodus[y].contributors).toBeLessThan(base[y].contributors)
  })

  it('sub-indexation erodes pensions during the window and improves the solde', () => {
    const base = project(state0(), buildHypotheses(data), 2040, ECON_INIT)
    const under = project(
      state0(),
      buildHypotheses(data, { underIndexation: 0.01, underIndexationYears: 10 }),
      2040,
      ECON_INIT,
    )
    const y = base.length - 1
    // Same retirees (legalAge unchanged) ⇒ lower benefits means a lower average pension.
    expect(under[y].benefits).toBeLessThan(base[y].benefits)
    expect(under[y].soldePctGdp).toBeGreaterThan(base[y].soldePctGdp)
  })

  it('early retirement share (§3.2) adds retirees, removes contributors, degrades the solde', () => {
    const base = project(state0(), buildHypotheses(data, { earlyRetirementShare: 0 }), 2040, ECON_INIT)
    const early = project(state0(), buildHypotheses(data, { earlyRetirementShare: 0.2 }), 2040, ECON_INIT)
    const y = base.length - 1
    expect(early[y].retirees).toBeGreaterThan(base[y].retirees)
    expect(early[y].contributors).toBeLessThan(base[y].contributors)
    expect(early[y].soldePctGdp).toBeLessThan(base[y].soldePctGdp)
  })

  it('FRR endowment (§3.4) cuts the cumulated debt but never touches the annual solde', () => {
    const base = project(state0(), buildHypotheses(data, { frrFlowPct: 0 }), 2070, ECON_INIT)
    const frr = project(state0(), buildHypotheses(data, { frrFlowPct: 0.005 }), 2070, ECON_INIT)
    const y = base.length - 1
    // cumulativeDebt is positive-for-debt; reserves set aside reduce it (frr < base).
    expect(frr[y].cumulativeDebt).toBeLessThan(base[y].cumulativeDebt)
    for (let i = 0; i < base.length; i++) expect(frr[i].soldePctGdp).toBe(base[i].soldePctGdp)
  })

  it('additional resources (§3.3) lift the solde by ~the lever, resources unchanged elsewhere', () => {
    const base = project(state0(), buildHypotheses(data), 2050, ECON_INIT)
    const csg = project(state0(), buildHypotheses(data, { additionalResourcesPct: 0.01 }), 2050, ECON_INIT)
    const y = base.length - 1
    expect(csg[y].soldePctGdp - base[y].soldePctGdp).toBeCloseTo(0.01, 3)
    expect(csg[y].resourcesPctGdp - base[y].resourcesPctGdp).toBeCloseTo(0.01, 3)
    expect(csg[y].benefits).toBe(base[y].benefits) // spending untouched
  })

  it('legal age indexed on life expectancy lowers the number of retirees', () => {
    const base = project(state0(), buildHypotheses(data, { legalAgeLEShare: 0 }), 2070, ECON_INIT)
    const indexed = project(state0(), buildHypotheses(data, { legalAgeLEShare: 0.66 }), 2070, ECON_INIT)
    const y = base.length - 1
    expect(indexed[y].retirees).toBeLessThan(base[y].retirees)
  })
})

describe('fractional legal age + reform calendars', () => {
  // The COR calibration was fitted with an integer step at the exit age: the fractional
  // machinery MUST reduce to the old 0/1 behaviour at whole ages, or the whole macro block drifts.
  it('an integer legal age gives whole-cohort counts (calibration untouched)', () => {
    const s = project(state0(), buildHypotheses(data, { legalAge: 64 }), 2050, ECON_INIT)
    const y = s.length - 1
    const pyramid = s[y].pyramid
    let sixtyFourPlus = 0
    for (let a = 64; a < pyramid.H.length; a++) sixtyFourPlus += pyramid.H[a] + pyramid.F[a]
    expect(s[y].retirees).toBeCloseTo(sixtyFourPlus, 6)
  })

  it('a quarter-year step moves retirees a quarter of the boundary cohort', () => {
    const at63 = project(state0(), buildHypotheses(data, { legalAge: 63 }), 2040, ECON_INIT)
    const at6325 = project(state0(), buildHypotheses(data, { legalAge: 63.25 }), 2040, ECON_INIT)
    const at64 = project(state0(), buildHypotheses(data, { legalAge: 64 }), 2040, ECON_INIT)
    const y = at63.length - 1
    const cohort63 = at63[y].pyramid.H[63] + at63[y].pyramid.F[63]
    expect(at63[y].retirees - at6325[y].retirees).toBeCloseTo(0.25 * cohort63, 6)
    // Monotone all the way, and the solde improves as the age rises.
    expect(at6325[y].retirees).toBeGreaterThan(at64[y].retirees)
    expect(at6325[y].soldePctGdp).toBeGreaterThan(at63[y].soldePctGdp)
    expect(at64[y].soldePctGdp).toBeGreaterThan(at6325[y].soldePctGdp)
  })

  it('contributors and retirees still partition the boundary cohort', () => {
    const s = project(state0(), buildHypotheses(data, { legalAge: 62.75 }), 2030, ECON_INIT)
    const y = s.length - 1
    const pyr62 = s[y].pyramid
    let sixtyThreePlus = 0
    for (let a = 63; a < pyr62.H.length; a++) sixtyThreePlus += pyr62.H[a] + pyr62.F[a]
    const cohort62 = pyr62.H[62] + pyr62.F[62]
    expect(s[y].retirees).toBeCloseTo(sixtyThreePlus + 0.25 * cohort62, 6)
  })

  it('a reform calendar phases the age in instead of stepping it', () => {
    const flat = project(state0(), buildHypotheses(data, { legalAge: 64 }), 2040, ECON_INIT)
    const ramp = project(
      state0(),
      buildHypotheses(data, {
        legalAge: 64,
        schedule: [
          { year: 2025, legalAge: 62.75 },
          { year: 2032, legalAge: 64 },
        ],
      }),
      2040,
      ECON_INIT,
    )
    const at = (s: typeof flat, year: number) => s.find((r) => r.year === year)!
    // During the phase-in the ramp has more retirees; past the last anchor it is clamped
    // to the target and the two runs converge on the same exit age.
    expect(at(ramp, 2026).retirees).toBeGreaterThan(at(flat, 2026).retirees)
    expect(at(ramp, 2029).retirees).toBeGreaterThan(at(flat, 2029).retirees)
    expect(at(ramp, 2032).retirees).toBeCloseTo(at(flat, 2032).retirees, 6)
    expect(at(ramp, 2040).retirees).toBeCloseTo(at(flat, 2040).retirees, 6)
  })

  it('a calendar interpolates between anchors and clamps outside them', () => {
    const h = buildHypotheses(data, {
      legalAge: 64,
      requiredQuarters: 172,
      schedule: [
        { year: 2025, legalAge: 62, requiredQuarters: 168 },
        { year: 2035, legalAge: 64, requiredQuarters: 172 },
      ],
    })
    expect(h.policy(2020).legalAge).toBe(62) // clamped below
    expect(h.policy(2030).legalAge).toBe(63) // midpoint
    expect(h.policy(2050).legalAge).toBe(64) // clamped above
    expect(h.policy(2030).requiredQuarters).toBe(170)
    expect(Number.isInteger(h.policy(2028).requiredQuarters)).toBe(true)
    // Fields the calendar does not pin fall through to the flat policy.
    expect(h.policy(2030).contributionRate).toBe(h.policy(2050).contributionRate)
  })
})

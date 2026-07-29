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
  // These test the age *mechanism*, so they bypass the behavioural damping
  // (legalAgeEffectiveness, calibrated in validation.test.ts) and read the raw shift.
  const RAW = { ...ECON_INIT, legalAgeEffectiveness: 1 }

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
    const at63 = project(state0(), buildHypotheses(data, { legalAge: 63 }), 2040, RAW)
    const at6325 = project(state0(), buildHypotheses(data, { legalAge: 63.25 }), 2040, RAW)
    const at64 = project(state0(), buildHypotheses(data, { legalAge: 64 }), 2040, RAW)
    const y = at63.length - 1
    const cohort63 = at63[y].pyramid.H[63] + at63[y].pyramid.F[63]
    expect(at63[y].retirees - at6325[y].retirees).toBeCloseTo(0.25 * cohort63, 6)
    // Monotone all the way, and the solde improves as the age rises.
    expect(at6325[y].retirees).toBeGreaterThan(at64[y].retirees)
    expect(at6325[y].soldePctGdp).toBeGreaterThan(at63[y].soldePctGdp)
    expect(at64[y].soldePctGdp).toBeGreaterThan(at6325[y].soldePctGdp)
  })

  it('contributors and retirees still partition the boundary cohort', () => {
    const s = project(state0(), buildHypotheses(data, { legalAge: 62.75 }), 2030, RAW)
    const y = s.length - 1
    const pyr62 = s[y].pyramid
    let sixtyThreePlus = 0
    for (let a = 63; a < pyr62.H.length; a++) sixtyThreePlus += pyr62.H[a] + pyr62.F[a]
    const cohort62 = pyr62.H[62] + pyr62.F[62]
    expect(s[y].retirees).toBeCloseTo(sixtyThreePlus + 0.25 * cohort62, 6)
  })

  it('a reform calendar phases the age in by génération instead of stepping it', () => {
    const flat = project(state0(), buildHypotheses(data, { legalAge: 64 }), 2045, ECON_INIT)
    const ramp = project(
      state0(),
      buildHypotheses(data, {
        legalAge: 64,
        schedule: [
          { generation: 1963, legalAge: 62.75 },
          { generation: 1968, legalAge: 64 },
        ],
      }),
      2045,
      ECON_INIT,
    )
    const at = (s: typeof flat, year: number) => s.find((r) => r.year === year)!
    // Pendant la montée en charge, les générations concernées partent plus tôt → plus de retraités.
    expect(at(ramp, 2026).retirees).toBeGreaterThan(at(flat, 2026).retirees)
    expect(at(ramp, 2029).retirees).toBeGreaterThan(at(flat, 2029).retirees)
    // Une fois toutes les générations vivantes au-delà de la dernière ancre (gén. 1968 a 64 ans
    // en 2032, et toutes les suivantes sont clampées à 64), les deux courses convergent.
    expect(at(ramp, 2045).retirees).toBeCloseTo(at(flat, 2045).retirees, 6)
  })

  it('a calendar never un-retires a génération (keyed by birth year, not by liquidation year)', () => {
    // Gel puis reprise : sous un calendrier indexé sur l'année de liquidation, l'âge remonte et
    // des gens déjà partis redeviendraient cotisants. Par génération, c'est structurellement
    // impossible — l'âge d'une génération ne dépend pas de l'année où on l'interroge.
    const h = buildHypotheses(data, {
      legalAge: 64,
      schedule: [
        { generation: 1960, legalAge: 64 },
        { generation: 1963, legalAge: 62 },
        { generation: 1966, legalAge: 64 },
      ],
    })
    expect(h.cohortPolicy(1963).legalAge).toBe(62)
    expect(h.cohortPolicy(1966).legalAge).toBe(64)
    const s = project(state0(), h, 2040, ECON_INIT)
    for (let i = 1; i < s.length; i++) expect(s[i].retirees).toBeGreaterThanOrEqual(s[i - 1].retirees)
  })

  it('a calendar interpolates between générations and clamps outside them', () => {
    const h = buildHypotheses(data, {
      legalAge: 64,
      requiredQuarters: 172,
      schedule: [
        { generation: 1961, legalAge: 62, requiredQuarters: 168 },
        { generation: 1971, legalAge: 64, requiredQuarters: 172 },
      ],
    })
    expect(h.cohortPolicy(1955).legalAge).toBe(62) // clamped below
    expect(h.cohortPolicy(1966).legalAge).toBe(63) // midpoint
    expect(h.cohortPolicy(1990).legalAge).toBe(64) // clamped above
    expect(h.cohortPolicy(1966).requiredQuarters).toBe(170)
    expect(Number.isInteger(h.cohortPolicy(1964).requiredQuarters)).toBe(true)
    // Fields the calendar does not pin fall through to the flat policy.
    expect(h.cohortPolicy(1966).contributionRate).toBe(h.cohortPolicy(1990).contributionRate)
  })

  it('le plafonnement écrête la masse des pensions, et seulement au-dessus du plafond', () => {
    const run = (pensionCap?: number) =>
      project(state0(), buildHypotheses(data, { pensionCap }), 2040, ECON_INIT).at(-1)!
    const none = run()
    // Un plafond au-dessus du dernier décile (2,368 × la moyenne, ~4 400 €/mois ici) ne mord pas.
    expect(run(50_000).benefits).toBeCloseTo(none.benefits, 6)
    // Plus le plafond descend, plus la masse baisse — strictement et de façon monotone.
    const at4000 = run(4000).benefits
    const at2000 = run(2000).benefits
    expect(at4000).toBeLessThan(none.benefits)
    expect(at2000).toBeLessThan(at4000)
    expect(run(2000).soldePctGdp).toBeGreaterThan(none.soldePctGdp)
  })

  it('les déciles publiés décrivent le MÊME écrêtement que la masse (le graphe ne ment pas)', () => {
    const run = (pensionCap?: number) =>
      project(state0(), buildHypotheses(data, { pensionCap }), 2040, ECON_INIT).at(-1)!
    const none = run()
    const mean = (d: number[]) => d.reduce((s, v) => s + v, 0) / d.length
    // Hors plafond, la distribution est croissante et sa moyenne retombe sur le niveau observé
    // servant d'échelle (1 770 €/mois en base, dérivé par le noria).
    expect(none.pensionDeciles).toHaveLength(10)
    for (let i = 1; i < 10; i++) expect(none.pensionDeciles[i]).toBeGreaterThan(none.pensionDeciles[i - 1])
    // Sous plafond : aucun décile ne dépasse le plafond, et la baisse de la moyenne des déciles
    // est exactement celle de la masse versée. C'est ce qui autorise le graphe à boîtes à
    // illustrer le levier — sinon la boîte et le solde raconteraient deux histoires.
    for (const cap of [4000, 3000, 2000]) {
      const capped = run(cap)
      for (const d of capped.pensionDeciles) expect(d).toBeLessThanOrEqual(cap + 1e-9)
      expect(mean(capped.pensionDeciles) / mean(none.pensionDeciles)).toBeCloseTo(
        capped.benefits / none.benefits,
        9,
      )
    }
  })
})

import { describe, expect, it } from 'vitest'
import central from '../data/scenarios/central.json'
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, DEFAULT_POLICY, ECON_INIT } from '../data/loader'
import corRef from '../data/corReference.json'
import { applyReform } from '../data/reformLevers'
import { REFORM_PRESETS } from '../data/reforms'
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
    const corSolde: Record<number, number> = {
      2030: -0.0047,
      2040: -0.0076,
      2050: -0.0107,
      2060: -0.0116,
      2070: -0.0139,
    }
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
    const base = project(
      buildInitialState(pyr),
      buildHypotheses(data, { contributionRate: 0.28 }),
      2070,
      ECON_INIT,
    )
    const higher = project(
      buildInitialState(pyr),
      buildHypotheses(data, { contributionRate: 0.33 }),
      2070,
      ECON_INIT,
    )
    expect(at(higher, 2070).soldePctGdp).toBeGreaterThan(at(base, 2070).soldePctGdp)
  })

  it('higher productivity growth improves the long-run solde', () => {
    const low = project(
      buildInitialState(pyr),
      buildHypotheses(data, { productivity: 0.006 }),
      2070,
      ECON_INIT,
    )
    const high = project(
      buildInitialState(pyr),
      buildHypotheses(data, { productivity: 0.016 }),
      2070,
      ECON_INIT,
    )
    expect(at(high, 2070).soldePctGdp).toBeGreaterThan(at(low, 2070).soldePctGdp)
  })

  it('COR reference file is well-formed', () => {
    expect(corRef.points.length).toBeGreaterThanOrEqual(5)
    expect(corRef.points.at(-1)!.year).toBe(2070)
  })
})

describe('reform templates vs published estimates', () => {
  const run = (key: string) => {
    const r = REFORM_PRESETS[key]
    return project(
      buildInitialState(pyr),
      buildHypotheses(data, { ...r.delta, schedule: r.schedule }),
      2070,
      ECON_INIT,
    )
  }

  // The lever that prices every age reform. Raw (no legalAgeEffectiveness) the 2023 reform came
  // out at ~59 Md€ at 2030, ~4x the published range — this test is the guard on that calibration.
  it('the 2023 reform lands inside the published range (Cour des comptes ~10 Md€ … étude d’impact 17,7 Md€)', () => {
    const avant = run('avant-2023')
    const apres = run('reforme-2023')
    for (const year of [2030, 2040, 2050, 2070]) {
      const gain = (at(apres, year).balance - at(avant, year).balance) / 1e9
      expect(gain).toBeGreaterThan(10)
      expect(gain).toBeLessThan(17.7)
    }
  })

  it('the reform template IS the calibrated reference (same calendar as DEFAULT_POLICY)', () => {
    const apres = run('reforme-2023')
    // Le droit en vigueur est un calendrier par génération, et c'est celui que porte
    // DEFAULT_POLICY : la calibration COR est construite dessus, donc sélectionner ce template
    // ne doit rien changer — le solde reste sur la référence COR à tous les horizons.
    expect(REFORM_PRESETS['reforme-2023'].schedule).toEqual(DEFAULT_POLICY.schedule)
    for (const p of corRef.points) {
      expect(at(apres, p.year).soldePctGdp).toBeCloseTo(p.soldePctGdp, 3)
    }
  })

  it('the 2026 suspension costs only the deferred générations, not the whole 62-64 stock', () => {
    // Le garde-fou de la résolution par génération. Indexé sur l'année de liquidation, le gel
    // décalait tout le stock des 62-64 ans et coûtait ≈ 7 Md€ en 2027, contre 1,8 Md€ au
    // chiffrage gouvernemental. Par génération, seules 1964-1965 sont décalées.
    const cost2027 = (at(run('reforme-2023'), 2027).balance - at(run('suspension-2026'), 2027).balance) / 1e9
    expect(cost2027).toBeGreaterThan(0)
    expect(cost2027).toBeLessThan(4)
  })

  it('the 2026 suspension costs nothing before it starts and closes back onto the reference', () => {
    const ref = run('reforme-2023')
    const susp = run('suspension-2026')
    const cost = (year: number) => (at(susp, year).balance - at(ref, year).balance) / 1e9
    expect(cost(2025)).toBeCloseTo(0, 6) // applies to pensions taking effect from 01/09/2026
    expect(cost(2027)).toBeLessThan(0) // the freeze bites
    expect(cost(2035)).toBeCloseTo(0, 6) // calendar resumed, 64 ans reached in 2033
  })

  // Le chemin que suit VRAIMENT l'application : `applyReform`, pas un delta bricolé à la main.
  it('une réforme de recette vaut sa recette, et rien de plus — le calendrier du droit en vigueur survit', () => {
    // Le bug : `schedule: preset.schedule` inconditionnel abolissait la montée en charge 2023 pour
    // les cinq presets sans calendrier, appliquant 64 ans dès 2025 à des générations encore à
    // 62-63 ans. « Suppression de l'abattement de 10 % » (≈ 0,16 pt de PIB) affichait +0,52 pt en
    // 2027 : trois fois la mesure dont elle porte le nom.
    const ref = project(buildInitialState(pyr), buildHypotheses(data, DEFAULT_POLICY), 2070, ECON_INIT)
    const applied = applyReform(DEFAULT_POLICY, DEFAULT_POLICY, REFORM_PRESETS['abattement-10'])
    const after = project(buildInitialState(pyr), buildHypotheses(data, applied), 2070, ECON_INIT)
    expect(applied.schedule).toEqual(DEFAULT_POLICY.schedule)
    for (const year of [2027, 2030, 2040, 2070]) {
      const gain = at(after, year).soldePctGdp - at(ref, year).soldePctGdp
      expect(gain, String(year)).toBeCloseTo(0.0016, 5)
    }
  })
})

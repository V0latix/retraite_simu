import { describe, expect, it } from 'vitest'
import central from './scenarios/central.json'
import initialPyramid from './initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from './loader'
import { buildChocRecession, buildCorProdBasse, buildCorProdHaute } from './pragmatique'
import type { InitialPyramid, ScenarioData } from './schema'
import { project } from '../engine/project'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const run = (d: ScenarioData) => project(buildInitialState(pyr), buildHypotheses(d), 2070, ECON_INIT)
const at = (s: ReturnType<typeof run>, y: number) => s.find((r) => r.year === y)!

describe('scénarios COR par productivité', () => {
  it('solde 2070 : basse < central < haute', () => {
    const basse = at(run(buildCorProdBasse(data)), 2070).soldePctGdp
    const centr = at(run(data), 2070).soldePctGdp
    const haute = at(run(buildCorProdHaute(data)), 2070).soldePctGdp
    expect(basse).toBeLessThan(centr)
    expect(centr).toBeLessThan(haute)
  })
})

describe('choc conjoncturel (chômage)', () => {
  it('creuse le solde au pic (2028) puis se résorbe après le choc (2031)', () => {
    const choc = run(buildChocRecession(data))
    const centr = run(data)
    // Pendant le choc : moins de cotisants → solde plus bas qu'au central.
    expect(at(choc, 2028).soldePctGdp).toBeLessThan(at(centr, 2028).soldePctGdp)
    // Après le retour à la base (2030) : même démographie, même chômage → solde identique.
    expect(at(choc, 2031).soldePctGdp).toBeCloseTo(at(centr, 2031).soldePctGdp, 6)
  })
})

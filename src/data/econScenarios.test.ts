import { describe, expect, it } from 'vitest'
import central from './scenarios/central.json'
import initialPyramid from './initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from './loader'
import { applyHypotheses, buildChocRecession } from './hypotheses'
import type { InitialPyramid, ScenarioData } from './schema'
import type { PolicyParams } from '../engine/types'
import { project } from '../engine/project'

const pyr = initialPyramid as InitialPyramid
const data = central as unknown as ScenarioData
const run = (d: ScenarioData, p: Partial<PolicyParams> = {}) =>
  project(buildInitialState(pyr), buildHypotheses(d, p), 2070, ECON_INIT)
const at = (s: ReturnType<typeof run>, y: number) => s.find((r) => r.year === y)!

describe('curseur productivité (ex-scénarios COR par productivité)', () => {
  it('solde 2070 : 0,7 % < 1,0 % < 1,3 %', () => {
    const solde = (productivity: number) => at(run(data, { productivity }), 2070).soldePctGdp
    expect(solde(0.007)).toBeLessThan(solde(0.01))
    expect(solde(0.01)).toBeLessThan(solde(0.013))
  })
})

describe('curseurs démographiques (ex-variantes INSEE)', () => {
  it('solde 2070 : moins de migration dégrade, plus de migration soutient', () => {
    const solde = (netMigration: number) =>
      at(run(applyHypotheses(data, { netMigration }), { netMigration }), 2070).soldePctGdp
    expect(solde(20_000)).toBeLessThan(solde(70_000))
    expect(solde(70_000)).toBeLessThan(solde(120_000))
  })

  it('une fécondité plus basse dégrade le ratio de dépendance à long terme', () => {
    const dep = (tfr: number) => at(run(applyHypotheses(data, { tfr })), 2070).dependencyDemographic
    expect(dep(1.6)).toBeGreaterThan(dep(1.8))
    expect(dep(1.8)).toBeGreaterThan(dep(2.0))
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

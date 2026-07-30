import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from './loader'
import { REFORM_PRESETS } from './reforms'
import { SCENARIO_PRESETS } from './scenarioPresets'
import {
  applyReform,
  diffReformLevers,
  extractReformDelta,
  HYPOTHESIS_LEVER_KEYS,
  REFORM_LEVER_KEYS,
  REFORM_LEVER_SPECS,
  RISK_LEVER_KEYS,
} from './reformLevers'
import type { PolicyParams } from '../engine/types'

const base: PolicyParams = { ...DEFAULT_POLICY, ...SCENARIO_PRESETS.central }
const KEYS = Object.keys(REFORM_PRESETS)

describe('applyReform — remplacement propre', () => {
  it('ne garde aucune trace de la réforme précédente, pour tout couple de presets', () => {
    for (const a of KEYS) {
      for (const b of KEYS) {
        const stacked = applyReform(applyReform(base, base, REFORM_PRESETS[a]), base, REFORM_PRESETS[b])
        expect(stacked, `${a} puis ${b}`).toEqual(applyReform(base, base, REFORM_PRESETS[b]))
      }
    }
  })

  it('conserve les hypothèses et les risques, qui appartiennent aux autres cartes', () => {
    const tuned: PolicyParams = {
      ...base,
      tfr: 1.2,
      netMigration: 200_000,
      productivity: 0.018,
      unemployment: 0.166,
      realInterestRate: 0.033,
      workerExodus: 50_000,
    }
    const after = applyReform(tuned, base, REFORM_PRESETS['retour-60'])
    for (const k of [...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS]) {
      expect(after[k], k).toBe(tuned[k])
    }
    expect(after.legalAge).toBe(60)
  })

  it('le droit en vigueur EST la référence — appliquer « reforme-2023 » est un no-op', () => {
    expect(applyReform(base, base, REFORM_PRESETS['reforme-2023'])).toEqual(base)
  })
})

describe('applyReform — sort du calendrier', () => {
  it('une loi impose son propre calendrier', () => {
    const p = applyReform(base, base, REFORM_PRESETS['suspension-2026'])
    expect(p.schedule).toEqual(REFORM_PRESETS['suspension-2026'].schedule)
  })

  it('une proposition qui pose un âge à plat abandonne le calendrier', () => {
    expect(applyReform(base, base, REFORM_PRESETS['retour-62']).schedule).toBeUndefined()
    expect(applyReform(base, base, REFORM_PRESETS['retour-60']).schedule).toBeUndefined()
  })

  it('une réforme de recette conserve le calendrier du droit en vigueur', () => {
    // Le bug historique : `schedule: preset.schedule` inconditionnel abolissait la montée en charge
    // 2023 et appliquait 64 ans dès 2025 à des générations encore à 62-63 ans.
    for (const k of [
      'abattement-10',
      'plafond-pension',
      'annee-blanche',
      'sous-indexation',
      'plus-cotisation',
    ]) {
      const p = applyReform(base, base, REFORM_PRESETS[k])
      expect(p.schedule, k).toEqual(base.schedule)
    }
  })
})

describe('taxonomie des leviers', () => {
  it('aucun preset de scénario ne pose un levier de réforme', () => {
    for (const [id, preset] of Object.entries(SCENARIO_PRESETS)) {
      for (const k of REFORM_LEVER_KEYS) expect(preset[k], `${id}.${k}`).toBeUndefined()
    }
  })

  it('aucune réforme ne pose une hypothèse ni un risque', () => {
    for (const [key, r] of Object.entries(REFORM_PRESETS)) {
      for (const k of [...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS]) {
        expect(r.delta[k], `${key}.${k}`).toBeUndefined()
      }
    }
  })

  it('chaque levier de réforme a une spec dont les bornes encadrent la référence', () => {
    expect(REFORM_LEVER_SPECS.map((s) => s.key).sort()).toEqual([...REFORM_LEVER_KEYS].sort())
    for (const s of REFORM_LEVER_SPECS) {
      const v = base[s.key] ?? 0
      expect(v, s.key).toBeGreaterThanOrEqual(s.min)
      expect(v, s.key).toBeLessThanOrEqual(s.max)
    }
  })

  it("aucune clé intégrée ne contient ':' — le préfixe des réformes enregistrées ne peut pas collisionner", () => {
    for (const k of KEYS) expect(k).not.toContain(':')
  })
})

describe('diffReformLevers / extractReformDelta', () => {
  it('le droit en vigueur ne déplace aucun levier', () => {
    expect(diffReformLevers(applyReform(base, base, REFORM_PRESETS['reforme-2023']), base)).toEqual([])
  })

  it('un retour à 62 ans montre l’âge et le calendrier, rien d’autre', () => {
    const rows = diffReformLevers(applyReform(base, base, REFORM_PRESETS['retour-62']), base)
    expect(rows.map((r) => r.key)).toEqual(['legalAge', 'schedule'])
    expect(rows[0]).toMatchObject({ from: '64 ans', to: '62 ans' })
    expect(rows[1].to).toBe('aucun (application immédiate)')
  })

  it('+2 pts de cotisation ne montre que la cotisation', () => {
    const rows = diffReformLevers(applyReform(base, base, REFORM_PRESETS['plus-cotisation']), base)
    expect(rows.map((r) => r.key)).toEqual(['contributionRate'])
    expect(rows[0]).toMatchObject({ from: '28.1%', to: '30.1%' })
  })

  it('le delta enregistré est plat : ni schedule, ni levier non déviant', () => {
    // Fork de « suspension 2026 » : on ne bouge que la cotisation, l'âge reste sur la cible.
    const forked = {
      ...applyReform(base, base, REFORM_PRESETS['suspension-2026']),
      contributionRate: 0.3,
    }
    const delta = extractReformDelta(forked, base)
    expect(delta).toEqual({ contributionRate: 0.3 })
    expect(delta).not.toHaveProperty('schedule')
    expect(delta).not.toHaveProperty('legalAge')
  })

  it('un delta ré-appliqué conserve le calendrier du droit en vigueur', () => {
    const delta = extractReformDelta({ ...base, contributionRate: 0.3 }, base)
    const back = applyReform(base, base, { label: 'x', source: 'x', delta })
    expect(back.schedule).toEqual(base.schedule)
    expect(back.contributionRate).toBe(0.3)
  })
})

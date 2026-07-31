import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from './loader'
import { REFORM_PRESETS } from './reforms'
import { SCENARIO_PRESETS } from './scenarioPresets'
import {
  applyReform,
  diffReformLevers,
  extractReformDelta,
  fromInput,
  HYPOTHESIS_LEVER_KEYS,
  HYPOTHESIS_LEVER_SPECS,
  REFORM_LEVER_KEYS,
  REFORM_LEVER_SPECS,
  RISK_LEVER_KEYS,
  RISK_LEVER_SPECS,
  toInput,
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
    // Virgule décimale et espace avant le %, comme tous les autres `fmt` du fichier.
    expect(rows[0]).toMatchObject({ from: '28,1 %', to: '30,1 %' })
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

// La saisie manuelle derrière chaque curseur : `fmt` n'étant pas réversible (« aucun »,
// « 64 ans 3 mois », valeurs stockées en fraction), c'est `edit` qui dit dans quelle unité on tape.
// Un levier ajouté à une carte sans son `edit` tombe ici — même rôle que les listes closes de clés.
describe('EditSpec — la valeur se tape autant qu’elle se glisse', () => {
  const ALL = [...REFORM_LEVER_SPECS, ...HYPOTHESIS_LEVER_SPECS, ...RISK_LEVER_SPECS]

  it('couvre les trois cartes', () => {
    expect(ALL.map((s) => s.key).sort()).toEqual(
      [...REFORM_LEVER_KEYS, ...HYPOTHESIS_LEVER_KEYS, ...RISK_LEVER_KEYS].sort(),
    )
    for (const s of ALL) {
      expect(s.edit.scale, s.key).toBeGreaterThan(0)
      expect(s.edit.decimals, s.key).toBeGreaterThanOrEqual(0)
      expect(s.edit.unit, s.key).not.toBe('')
    }
  })

  it('fait l’aller-retour valeur → champ → valeur sur les bornes et le pas', () => {
    for (const s of ALL) {
      for (let v = s.min; v <= s.max + 1e-9; v = v + s.step) {
        const at = Math.min(v, s.max)
        expect(fromInput(toInput(at, s.edit), s), `${s.key} @ ${at}`).toBeCloseTo(at, 10)
      }
    }
  })

  it('clampe aux bornes et rend null sur une saisie non numérique', () => {
    for (const s of ALL) {
      expect(fromInput('999999999', s), s.key).toBe(s.max)
      expect(fromInput('-999999999', s), s.key).toBe(s.min)
      expect(fromInput('aucun', s), s.key).toBeNull()
      expect(fromInput('', s), s.key).toBeNull()
    }
  })

  it('ne cale pas sur le pas — c’est tout l’intérêt de la saisie', () => {
    const age = REFORM_LEVER_SPECS.find((s) => s.key === 'legalAge')!
    expect(age.step).toBe(0.25)
    expect(fromInput('64,1', age)).toBe(64.1)
    const cot = REFORM_LEVER_SPECS.find((s) => s.key === 'contributionRate')!
    expect(fromInput('27,3', cot)).toBe(0.273) // et pas 0.27300000000000002 dans l'URL
  })

  it('garde entiers les leviers qui doivent l’être', () => {
    const quarters = REFORM_LEVER_SPECS.find((s) => s.key === 'requiredQuarters')!
    expect(fromInput('172,4', quarters)).toBe(172)
    const mig = HYPOTHESIS_LEVER_SPECS.find((s) => s.key === 'netMigration')!
    expect(fromInput('176 500,7', mig)).toBe(176501)
  })
})

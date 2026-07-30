import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../data/loader'
import { REFORM_PRESETS } from '../data/reforms'
import { SCENARIO_PRESETS } from '../data/scenarioPresets'
import { type AppState, decodeState, encodeState } from './share'

const roundTrip = (s: AppState) => decodeState(new URLSearchParams(encodeState(s)))

describe('URL state round-trip', () => {
  it('survives encode → decode on a non-default state', () => {
    const state: AppState = {
      view: 'stochastique',
      scenarioId: 'pragmatique',
      horizon: 2085,
      policy: {
        ...DEFAULT_POLICY,
        ...SCENARIO_PRESETS.pragmatique,
        legalAge: 66,
        tfr: 1.35,
        netMigration: 90_000,
        legalAgeLEShare: 0.5,
        schedule: undefined,
      },
      reformKey: '',
      reformMode: 'custom',
    }
    expect(roundTrip(state)).toEqual(state)
  })

  it('carries a reform template and rebuilds its calendar (an array cannot ride in the params)', () => {
    const state: AppState = {
      view: 'macro',
      scenarioId: 'central',
      horizon: 2070,
      policy: {
        ...DEFAULT_POLICY,
        ...SCENARIO_PRESETS.central,
        ...REFORM_PRESETS['suspension-2026'].delta,
        schedule: REFORM_PRESETS['suspension-2026'].schedule,
      },
      reformKey: 'suspension-2026',
      reformMode: 'preset',
    }
    const back = roundTrip(state)
    expect(back).toEqual(state)
    expect(back.policy.schedule).toBeDefined()
    // An unknown key degrades to a custom state rather than throwing.
    expect(decodeState(new URLSearchParams('r=nope')).reformKey).toBe('')
  })

  it('falls back to defaults on garbage input, sliders on the central preset', () => {
    const s = decodeState(new URLSearchParams('v=bogus&s=nope&h=abc'))
    expect(s.view).toBe('macro')
    expect(s.scenarioId).toBe('central')
    expect(s.horizon).toBe(2070)
    expect(s.policy.tfr).toBe(SCENARIO_PRESETS.central.tfr)
    expect(s.policy.netMigration).toBe(SCENARIO_PRESETS.central.netMigration)
  })
})

describe('le sort du calendrier voyage (`cal`)', () => {
  const custom = (schedule: AppState['policy']['schedule']): AppState => ({
    view: 'macro',
    scenarioId: 'central',
    horizon: 2070,
    policy: { ...DEFAULT_POLICY, ...SCENARIO_PRESETS.central, contributionRate: 0.3, schedule },
    reformKey: '',
    reformMode: 'custom',
  })

  it('un réglage sur mesure qui a GARDÉ le calendrier le retrouve au rechargement', () => {
    // Le bug : bouger le seul curseur de cotisation gardait le calendrier à l'écran, mais recharger
    // l'URL que l'app venait d'écrire le perdait — et le solde 2025-2031 changeait.
    const back = roundTrip(custom(DEFAULT_POLICY.schedule))
    expect(back.policy.schedule).toEqual(DEFAULT_POLICY.schedule)
  })

  it("un réglage sur mesure qui l'a ABANDONNÉ ne le voit pas revenir", () => {
    expect(roundTrip(custom(undefined)).policy.schedule).toBeUndefined()
  })
})

describe('mode et nom de la réforme', () => {
  it('le mode fait l’aller-retour, y compris sans aucun levier déplacé', () => {
    const pristine: AppState = {
      view: 'macro',
      scenarioId: 'central',
      horizon: 2070,
      policy: { ...DEFAULT_POLICY, ...SCENARIO_PRESETS.central },
      reformKey: '',
      reformMode: 'custom',
    }
    expect(roundTrip(pristine).reformMode).toBe('custom')
    expect(roundTrip({ ...pristine, reformMode: 'preset' }).reformMode).toBe('preset')
  })

  it('une réforme enregistrée garde sa clé et son nom, même inconnue de cet appareil', () => {
    // Lien reçu d'ailleurs : le store local n'a pas cette réforme, mais ses réglages sont dans les
    // params. On garde la clé (App tranchera) et on ouvre côté sur mesure.
    const s = decodeState(new URLSearchParams('r=custom:zzz&rn=Ma%20r%C3%A9forme&legalAge=61'))
    expect(s.reformKey).toBe('custom:zzz')
    expect(s.reformName).toBe('Ma réforme')
    expect(s.reformMode).toBe('custom')
    expect(s.policy.legalAge).toBe(61)
  })

  it('le nom est assaini (contrôles retirés, longueur bornée) et jamais vide', () => {
    expect(decodeState(new URLSearchParams('rn=%00%01A%09%20%20B')).reformName).toBe('A B')
    expect(decodeState(new URLSearchParams(`rn=${'x'.repeat(200)}`)).reformName).toHaveLength(60)
    expect(decodeState(new URLSearchParams('rn=%20%20')).reformName).toBeUndefined()
  })

  it('un lien antérieur à `m`, avec des leviers déviants, ouvre côté sur mesure', () => {
    expect(decodeState(new URLSearchParams('legalAge=60')).reformMode).toBe('custom')
    expect(decodeState(new URLSearchParams('')).reformMode).toBe('preset')
  })
})

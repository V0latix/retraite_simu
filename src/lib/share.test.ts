import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../data/loader'
import { REFORM_PRESETS } from '../data/reforms'
import { SCENARIO_PRESETS } from '../data/scenarioPresets'
import { type AppState, decodeState, encodeState } from './share'

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
    }
    expect(decodeState(new URLSearchParams(encodeState(state)))).toEqual(state)
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
    }
    const back = decodeState(new URLSearchParams(encodeState(state)))
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

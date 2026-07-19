import { describe, expect, it } from 'vitest'
import { DEFAULT_POLICY } from '../data/loader'
import type { TimeSeries } from '../engine/types'
import { type AppState, decodeState, encodeState, seriesToCsv } from './share'

describe('URL state round-trip', () => {
  it('survives encode → decode on a non-default state', () => {
    const state: AppState = {
      view: 'stochastique',
      scenarioId: 'fertility-low',
      beyondPolicy: 'trend',
      horizon: 2085,
      policy: { ...DEFAULT_POLICY, legalAge: 66, unemployment: 0.09, legalAgeLEShare: 0.5 },
    }
    expect(decodeState(new URLSearchParams(encodeState(state)))).toEqual(state)
  })

  it('falls back to defaults on garbage input', () => {
    const s = decodeState(new URLSearchParams('v=bogus&s=nope&h=abc'))
    expect(s.view).toBe('macro')
    expect(s.scenarioId).toBe('central')
    expect(s.horizon).toBe(2070)
  })
})

describe('seriesToCsv', () => {
  it('emits one header + one row per year, no pyramid column', () => {
    const series = [
      { year: 2025, soldePctGdp: -0.005, pyramid: { H: [1], F: [2] } },
      { year: 2026, soldePctGdp: -0.006, pyramid: { H: [3], F: [4] } },
    ] as unknown as TimeSeries
    const lines = seriesToCsv(series).split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toBe('year,soldePctGdp')
    expect(lines[1]).toBe('2025,-0.005')
  })
})

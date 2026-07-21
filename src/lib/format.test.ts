import { describe, expect, it } from 'vitest'
import { fmtNum, fmtPct, fmtPctRaw } from './format'

// Only assert the decimal comma on small positive values — the group separator
// (U+202F) and minus sign vary across Node/ICU versions and would make this brittle.
describe('format fr-FR', () => {
  it('uses the decimal comma', () => {
    expect(fmtPct(0.014)).toBe('1,4 %')
    expect(fmtPctRaw(1.4, 1)).toBe('1,4 %')
    expect(fmtNum(1.4, 1)).toBe('1,4')
  })
})

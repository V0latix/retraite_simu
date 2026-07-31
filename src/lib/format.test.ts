import { describe, expect, it } from 'vitest'
import { fmtNum, fmtPct, fmtPctRaw, parseFrNumber } from './format'

// Only assert the decimal comma on small positive values — the group separator
// (U+202F) and minus sign vary across Node/ICU versions and would make this brittle.
describe('format fr-FR', () => {
  it('uses the decimal comma', () => {
    expect(fmtPct(0.014)).toBe('1,4 %')
    expect(fmtPctRaw(1.4, 1)).toBe('1,4 %')
    expect(fmtNum(1.4, 1)).toBe('1,4')
  })
})

describe('parseFrNumber — la saisie manuelle des curseurs', () => {
  it('accepte la virgule comme le point', () => {
    expect(parseFrNumber('64,25')).toBe(64.25)
    expect(parseFrNumber('64.25')).toBe(64.25)
    expect(parseFrNumber('64')).toBe(64)
    expect(parseFrNumber('0')).toBe(0)
  })

  it('tolère ce qui se recopie depuis l’affichage : milliers et moins typographique', () => {
    for (const sep of [' ', ' ', ' ']) {
      expect(parseFrNumber(`176${sep}000`), sep.charCodeAt(0).toString(16)).toBe(176000)
    }
    expect(parseFrNumber('  1,45  ')).toBe(1.45)
    expect(parseFrNumber('−50000')).toBe(-50000) // U+2212, celui que produisent nos `fmt`
    expect(parseFrNumber('-50000')).toBe(-50000)
  })

  it('rend null sur tout ce qui n’est pas un nombre — l’appelant garde sa valeur', () => {
    expect(parseFrNumber('')).toBeNull()
    expect(parseFrNumber('   ')).toBeNull()
    expect(parseFrNumber('aucun')).toBeNull()
    expect(parseFrNumber('12,3,4')).toBeNull()
    expect(parseFrNumber('64 ans 3 mois')).toBeNull()
    expect(parseFrNumber('Infinity')).toBeNull()
  })
})

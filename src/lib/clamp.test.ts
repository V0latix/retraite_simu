import { describe, expect, it } from 'vitest'
import { clamp } from './clamp'

describe('clamp', () => {
  it('passes through in-range values', () => {
    expect(clamp(50, 0, 100)).toBe(50)
  })
  it('clamps below min and above max', () => {
    expect(clamp(-5, 0, 100)).toBe(0)
    expect(clamp(150, 0, 100)).toBe(100)
  })
  it('respects the bounds exactly', () => {
    expect(clamp(0, 0, 100)).toBe(0)
    expect(clamp(100, 0, 100)).toBe(100)
  })
})

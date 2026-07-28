// Stochastic scenario generator (spec §6.3). Perturbs the calibrated central
// scenario, so the median tracks it and the fan width is data-grounded:
//   mortality: qxCentral · exp(β_a · z_t)   z = driftless RW, innovation σ (Lee-Carter)
//   fertility: × exp(f_t)                    f = driftless RW, σ_f (assumption)
//   migration: × exp(m_t)                    m = driftless RW, σ_m (assumption)
// project() itself is unchanged — only a generator + aggregation are added.
import { buildHypotheses } from '../../data/loader'
import type { LeeCarterFit, ScenarioData } from '../../data/schema'
import { OMEGA, type HypothesisSet, type PolicyParams, type Sex } from '../types'

/** Small, fast, seedable PRNG. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng())
}

/** Cumulative driftless random walk of length n (index 0 = 0, no perturbation at base). */
function randomWalk(n: number, sigma: number, rng: () => number): number[] {
  const w = new Array(n).fill(0)
  for (let i = 1; i < n; i++) w[i] = w[i - 1] + gaussian(rng) * sigma
  return w
}

export function makeStochasticHypotheses(
  central: ScenarioData,
  fit: LeeCarterFit,
  policy: Partial<PolicyParams>,
  baseYear: number,
  maxYear: number,
  seed: number,
): HypothesisSet {
  const base = buildHypotheses(central, policy)
  const n = maxYear - baseYear + 1
  const rng = mulberry32(seed)

  // Shared unit longevity shock, scaled per sex by its σ (keeps H/F correlated).
  const w = randomWalk(n, 1, rng)
  const fWalk = randomWalk(n, fit.assumptions.fertilitySigma, rng)
  const mWalk = randomWalk(n, fit.assumptions.migrationSigma, rng)
  const zAt = (sex: Sex, year: number) => fit[sex].sigma * (w[Math.min(Math.max(year - baseYear, 0), n - 1)] ?? 0)
  const idx = (year: number) => Math.min(Math.max(year - baseYear, 0), n - 1)

  return {
    ...base,
    mortality: (year, age, sex) => {
      const q = base.mortality(year, age, sex)
      const beta = fit[sex].beta[Math.min(age, OMEGA)] ?? 0
      return Math.min(0.999, Math.max(0, q * Math.exp(beta * zAt(sex, year))))
    },
    fertility: (year, age) => base.fertility(year, age) * Math.exp(fWalk[idx(year)]),
    migration: (year, age, sex) => base.migration(year, age, sex) * Math.exp(mWalk[idx(year)]),
  }
}

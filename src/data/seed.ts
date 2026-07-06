// SEED DATA — parametric placeholder shaped like France ~2025.
// ponytail: replace with strict INSEE/HMD/COR JSON in Phase 0 (§8). These
// closed-form approximations keep the engine runnable and honest about being
// approximate; they are NOT sourced figures.
import { OMEGA, type HypothesisSet, type PolicyParams, type PopulationState, type Sex } from '../engine/types'

// Gompertz-ish yearly mortality qx, sex-shifted. Improves ~1.2%/yr over time.
function baseMortality(age: number, sex: Sex): number {
  const infant = age === 0 ? 0.0035 : 0
  const gompertz = 0.00003 * Math.exp(0.095 * age)
  const male = sex === 'H' ? 1.35 : 1
  return Math.min(0.9, infant + gompertz * male + 0.0004)
}

// Age-specific fertility, bell around 30, total ≈ 1.8 (TFR seed).
function baseFertility(age: number): number {
  if (age < 15 || age > 50) return 0
  const peak = 30
  return 0.135 * Math.exp(-((age - peak) ** 2) / (2 * 6 ** 2))
}

/** Build an initial France-like pyramid (~68M) from survival shape. */
export function buildInitialState(year = 2025): PopulationState {
  const H = new Float64Array(OMEGA + 1)
  const F = new Float64Array(OMEGA + 1)
  // Survival-weighted cohort shape, mildly declining births in recent years.
  let survH = 1
  let survF = 1
  for (let a = 0; a <= OMEGA; a++) {
    H[a] = survH * 420_000
    F[a] = survF * 420_000
    survH *= 1 - baseMortality(a, 'H')
    survF *= 1 - baseMortality(a, 'F')
  }
  // Scale to ~68M total.
  const total = H.reduce((s, v) => s + v, 0) + F.reduce((s, v) => s + v, 0)
  const k = 68_000_000 / total
  for (let a = 0; a <= OMEGA; a++) {
    H[a] *= k
    F[a] *= k
  }
  return { year, H, F }
}

export const DEFAULT_POLICY: PolicyParams = {
  legalAge: 64,
  requiredQuarters: 172,
  contributionRate: 0.28,
  indexation: 'prices',
}

/** Central deterministic scenario. Reform levers override the default policy. */
export function buildHypotheses(policy: Partial<PolicyParams> = {}): HypothesisSet {
  const merged: PolicyParams = { ...DEFAULT_POLICY, ...policy }
  return {
    fertility: (_y, age) => baseFertility(age),
    mortality: (y, age, sex) => baseMortality(age, sex) * Math.pow(0.988, y - 2025),
    migration: (_y, age, _sex) => (age >= 20 && age <= 40 ? 8_000 : 2_000), // ~+70k/yr net seed
    productivity: () => 0.013,
    unemployment: () => 0.07,
    // Activity rate: high in mid-career, ramps down near legal age.
    activityRate: (_y, age, legalAge) => {
      if (age < 20) return 0.25
      if (age >= legalAge) return 0
      if (age >= legalAge - 5) return 0.55
      return 0.9
    },
    policy: () => merged,
  }
}

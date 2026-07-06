// Cohort-component demographic projection (cahier des charges §4.1).
import { OMEGA, type HypothesisSet, type PopulationState, type Sex } from './types'

const SEX_RATIO = 1.05 // male births per female birth

function zeros(): Float64Array {
  return new Float64Array(OMEGA + 1)
}

/** Advance the population one year: survival + ageing, migration, births. */
export function stepDemography(state: PopulationState, h: HypothesisSet): PopulationState {
  const t = state.year
  const next: PopulationState = { year: t + 1, H: zeros(), F: zeros() }

  // Survival + ageing + migration for ages 1..OMEGA.
  for (const sex of ['H', 'F'] as Sex[]) {
    const src = state[sex]
    const dst = next[sex]
    for (let a = 0; a < OMEGA; a++) {
      const survivors = src[a] * (1 - h.mortality(t, a, sex))
      dst[a + 1] = survivors + h.migration(t, a + 1, sex)
    }
    // Terminal age OMEGA absorbs itself (survivors stay), keeps population from leaking.
    dst[OMEGA] += src[OMEGA] * (1 - h.mortality(t, OMEGA, sex))
  }

  // Births: women aged 15..50.
  let births = 0
  for (let a = 15; a <= 50; a++) {
    births += state.F[a] * h.fertility(t, a)
  }
  next.H[0] = births * (SEX_RATIO / (1 + SEX_RATIO)) * (1 - h.mortality(t, 0, 'H'))
  next.F[0] = births * (1 / (1 + SEX_RATIO)) * (1 - h.mortality(t, 0, 'F'))

  return next
}

/** Demographic dependency ratio: 65+ / [20..64]. */
export function dependencyDemographic(state: PopulationState): number {
  let old = 0
  let working = 0
  for (let a = 0; a <= OMEGA; a++) {
    const n = state.H[a] + state.F[a]
    if (a >= 65) old += n
    else if (a >= 20) working += n
  }
  return working > 0 ? old / working : 0
}

export function totalPopulation(state: PopulationState): number {
  let sum = 0
  for (let a = 0; a <= OMEGA; a++) sum += state.H[a] + state.F[a]
  return sum
}

// Types for the strict versioned JSON produced by scripts/ingest-insee.mjs (§8.2).

export interface DataMeta {
  source: string
  inseeId: number
  scenario: string
  retrieved: string
}

/** Per-scenario demographic trajectories. Matrices are [yearIndex][age]. */
export interface ScenarioData {
  meta: DataMeta
  years: number[] // BASE_YEAR..2070
  ages: number[] // 0..105
  mortality: { H: number[][]; F: number[][] } // qx, probability in [0,1)
  fertility: number[][] // rate per woman, nonzero ages 15..50
  migration: { H: number[][]; F: number[][] } // net headcount by age
}

export interface InitialPyramid {
  meta: { source: string; inseeId: number; year: number; retrieved: string }
  ages: number[]
  H: number[]
  F: number[]
}

/** Extrapolation policy for years beyond the published data (§7). */
export type BeyondDataPolicy = 'hold' | 'trend' | 'converge'

/** COR reference trajectory for the validation view (§8.3). */
export interface CorReference {
  meta: { source: string; url: string; assumptions: string; note: string; retrieved: string }
  unit: string
  points: { year: number; depensesPctGdp: number; ressourcesPctGdp: number; soldePctGdp: number }[]
}

export const SCENARIO_IDS = [
  'central',
  'fertility-high',
  'fertility-low',
  'mortality-low',
  'mortality-high',
  'migration-high',
  'migration-low',
] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  central: 'Central',
  'fertility-high': 'Fécondité haute',
  'fertility-low': 'Fécondité basse',
  'mortality-low': 'Espérance de vie haute',
  'mortality-high': 'Espérance de vie basse',
  'migration-high': 'Migration haute',
  'migration-low': 'Migration basse',
}

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

/** Lee-Carter fit + stochastic assumptions (§6.3). */
export interface LeeCarterSex {
  alpha: number[] // α_a, log baseline mortality by age
  beta: number[] // β_a, age sensitivity (Σβ = 1)
  kappa: number[] // κ_t, historical time index
  drift: number // annual drift of κ
  sigma: number // std of κ innovations
}
export interface LeeCarterFit {
  meta: { source: string; fitYears: [number, number]; note: string; retrieved: string }
  ages: number[]
  H: LeeCarterSex
  F: LeeCarterSex
  assumptions: { fertilitySigma: number; migrationSigma: number; defaultDraws: number }
}

/**
 * Observed (historical) counterparts of the projected series, so every chart can
 * show "passé observé" before "futur projeté". Produced by scripts/ingest-historical.mjs.
 * Holes are `null`: the retirees headcount lags a year behind the other COR series.
 */
export interface HistoricalData {
  meta: { source: string; note: string; retrieved: string }
  /** Last year with observed finance data — the frontier between observed and projected. */
  lastObserved: number
  finance: {
    years: number[]
    depensesPctGdp: (number | null)[]
    resourcesPctGdp: (number | null)[]
    soldePctGdp: (number | null)[]
    activePerRetiree: (number | null)[]
    contributors: (number | null)[]
    retirees: (number | null)[]
    gdp: (number | null)[] // Md€ courants
  }
  demography: {
    years: number[]
    ratio2064over65: (number | null)[]
    share65: { years: number[]; values: number[] }
    /** Observed total fertility rate (ICF), France métropolitaine — contrasts with the
     *  flat 1.8 the INSEE scenarios assume. */
    fertility: { years: number[]; icf: number[] }
    /** Observed net migration (solde migratoire), INSEE Bilan démographique — contrasts
     *  with the +70k/an the INSEE projections assume. Persons/year. */
    migration: { years: number[]; solde: number[] }
  }
  /** Published levels used to anchor the cumulative-balance chart (COR Tab 2.3). */
  anchors: { reserves2024: number; frr2024: number; gdp2024: number; reservesPctGdp: number }
}

/** Observed pyramids, 1946 (création du régime général) → 2025. Matrices are [yearIndex][age]. */
export interface HistoricalPyramid {
  meta: { source: string; url: string; note: string; retrieved: string }
  ages: number[]
  years: number[]
  H: number[][]
  F: number[][]
  /** "France métropolitaine" before 1991, "France" after — the champ changes, so we label it. */
  champ: Record<string, string>
}

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
  'pragmatique',
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
  pragmatique: 'Pragmatique (tendances observées)',
}

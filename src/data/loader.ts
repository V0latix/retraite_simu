// Builds engine inputs from the real INSEE JSON (replaces the old seed.ts).
import { OMEGA, type HypothesisSet, type PolicyAnchor, type PolicyParams, type PopulationState, type Sex } from '../engine/types'
import { type EconInit, project } from '../engine/project'
import type { BeyondDataPolicy, CorReference, HistoricalData, HistoricalPyramid, InitialPyramid, OecdComparison, ReferenceIndicators, ScenarioData } from './schema'
import params from './systemParams.json'
import pensionDistributionJson from './pensionDistribution.json'
import corReferenceJson from './corReference.json'
import referenceIndicatorsJson from './referenceIndicators.json'
import oecdComparisonJson from './oecdComparison.json'
import centralScenario from './scenarios/central.json'
import initialPyramidJson from './initialPyramid.json'
import historicalJson from './historical.json'
import historicalPyramidJson from './historicalPyramid.json'

export const BASE_YEAR = params.baseYear
const CAL_END = 2070 // last year the COR reference publishes; calibration holds beyond it

/** Observed series (COR + INSEE). Everything before LAST_OBSERVED_YEAR is measured, not modelled. */
export const historical = historicalJson as HistoricalData
export const historicalPyramid = historicalPyramidJson as HistoricalPyramid
export const LAST_OBSERVED_YEAR = historical.lastObserved

/**
 * Distribution des pensions par tranches de 100 € (DREES fiche 05). Le JSON garde les parts
 * VERBATIM de la fiche — la colonne Hommes y somme à 99,6 — pour rester une transcription
 * vérifiable ; la normalisation à 100 est faite ici, une fois, pour les trois colonnes.
 * `ratio`/`edge` sont en ratio à la moyenne de la table : mis à l'échelle par
 * `YearResult.pensionScale`, ils suivent la pension moyenne projetée.
 */
export const pensionBrackets = (() => {
  const { edge, ratio, share } = pensionDistributionJson.brackets
  const norm = (col: number[]) => {
    const s = col.reduce((a, b) => a + b, 0)
    return col.map((v) => (v * 100) / s)
  }
  return { edge, ratio, share: { total: norm(share.total), femmes: norm(share.femmes), hommes: norm(share.hommes) } }
})()

/** Published DREES/COR reference indicators (context/validation, §4). */
export const referenceIndicators = referenceIndicatorsJson as ReferenceIndicators

/** OCDE Pensions at a Glance — France vs Europe comparison (§4). */
export const oecdComparison = oecdComparisonJson as OecdComparison

export const DEFAULT_POLICY: PolicyParams = {
  legalAge: params.policy.legalAge,
  requiredQuarters: params.policy.requiredQuarters,
  contributionRate: params.policy.contributionRate,
  indexation: params.policy.indexation as PolicyParams['indexation'],
  // Le droit en vigueur est un calendrier, pas un âge unique : la réforme 2023 monte en charge
  // génération par génération jusqu'en 1968. C'est sur ce calendrier que buildCorCalibration()
  // cale la référence, et c'est de lui que les templates de réforme s'écartent.
  schedule: params.policy.schedule as PolicyAnchor[],
  productivity: params.economy.productivity,
  realInterestRate: 0, // basic scenarios stay clean; the Pragmatique risk overlay sets these
  workerExodus: 0,
}

/** Economic seeds + base-year COR anchors (kept in data). Calibration is layered on below. */
const ECON_SEEDS: EconInit = {
  avgAnnualWage: params.init.avgAnnualWage,
  avgAnnualPension: params.init.avgAnnualPension,
  priceInflation: params.economy.priceInflation,
  pensionDriftShare: params.calibration.pensionDriftShare,
  quartersAgeShare: params.calibration.quartersAgeShare,
  quartersRef: params.policy.requiredQuarters,
  legalAgeEffectiveness: params.calibration.legalAgeEffectiveness,
  legalAgeRef: params.calibration.legalAgeRef,
  pensionBrackets: { ratio: pensionBrackets.ratio, share: pensionBrackets.share.total },
  avgPensionObservedMonthly: params.init.avgPensionObservedMonthly,
  depensesShareBase: params.calibration.depensesShareBase,
  soldeShareBase: params.calibration.soldeShareBase,
  resources2070Share: params.calibration.resources2070Share,
}

/**
 * Per-year COR EEC calibration. We run the CENTRAL scenario once with the raw taper, then
 * derive, at each year, the benefit multiplier and the other-resources share that make the
 * central trajectory reproduce the COR EEC reference (dépenses + ressources → solde) at
 * every horizon — interpolating between the reference's anchor years. Every scenario and
 * reform lever reuses this same calibration, so they deviate from COR through their own
 * demography and contributions rather than being pinned to it.
 */
/**
 * Linear interpolation of one field over year-keyed anchors, clamped outside their range.
 * Shared by the COR reference points and the reform calendars (`PolicyParams.schedule`) —
 * same shape, one implementation.
 */
export function interpByYear<T extends { year: number }>(pts: T[], year: number, field: keyof T): number | undefined {
  const known = pts.filter((p) => p[field] != null)
  if (known.length === 0) return undefined
  if (year <= known[0].year) return known[0][field] as number
  const last = known[known.length - 1]
  if (year >= last.year) return last[field] as number
  for (let i = 0; i < known.length - 1; i++) {
    if (year >= known[i].year && year <= known[i + 1].year) {
      const t = (year - known[i].year) / (known[i + 1].year - known[i].year)
      return (known[i][field] as number) + t * ((known[i + 1][field] as number) - (known[i][field] as number))
    }
  }
  return last[field] as number
}

/**
 * A reform calendar resolved for one **génération**: the fields it pins, others left to the flat
 * policy. Les ancres sont clefées par année de naissance ; on les remappe sur `year` pour
 * réutiliser `interpByYear` tel quel (même interpolation, une seule implémentation).
 */
function atSchedule(anchors: PolicyAnchor[], generation: number): Partial<PolicyParams> {
  const pts = anchors.map((a) => ({ ...a, year: a.generation })).sort((a, b) => a.year - b.year)
  const out: Partial<PolicyParams> = {}
  const legalAge = interpByYear(pts, generation, 'legalAge')
  if (legalAge != null) out.legalAge = legalAge
  const quarters = interpByYear(pts, generation, 'requiredQuarters')
  // Quarters are integers by nature — the law never asks for 170.5 trimestres.
  if (quarters != null) out.requiredQuarters = Math.round(quarters)
  return out
}

function buildCorCalibration(): EconInit['calibration'] {
  const ref = corReferenceJson as CorReference
  const pts = [...ref.points].sort((a, b) => a.year - b.year)
  const interp = (year: number, field: 'depensesPctGdp' | 'ressourcesPctGdp') =>
    interpByYear(pts, year, field) as number

  const rawCentral = project(
    buildInitialState(initialPyramidJson as InitialPyramid),
    buildHypotheses(centralScenario as unknown as ScenarioData),
    CAL_END,
    ECON_SEEDS,
  )
  const depMul: number[] = []
  const otherResPct: number[] = []
  for (const r of rawCentral) {
    depMul.push(interp(r.year, 'depensesPctGdp') / r.depensesPctGdp)
    otherResPct.push(interp(r.year, 'ressourcesPctGdp') - r.contributions / r.gdp)
  }
  return { baseYear: BASE_YEAR, depMul, otherResPct }
}

export const ECON_INIT: EconInit = { ...ECON_SEEDS, calibration: buildCorCalibration() }

export function buildInitialState(pyr: InitialPyramid): PopulationState {
  const H = new Float64Array(OMEGA + 1)
  const F = new Float64Array(OMEGA + 1)
  for (let a = 0; a <= OMEGA; a++) {
    H[a] = pyr.H[a] ?? 0
    F[a] = pyr.F[a] ?? 0
  }
  return { year: pyr.meta.year, H, F }
}

/**
 * Resolve a value from a [yearIndex][age] matrix at an arbitrary year, applying
 * the extrapolation policy for years past the last published one (§7).
 */
function atYear(matrix: number[][], years: number[], year: number, age: number, beyond: BeyondDataPolicy): number {
  const first = years[0]
  const last = years[years.length - 1]
  if (year <= first) return matrix[0][age]
  if (year <= last) return matrix[year - first][age] // years are contiguous 1-year steps
  // Beyond the data:
  const lastVal = matrix[last - first][age]
  if (beyond === 'hold') return lastVal
  const prevVal = matrix[last - first - 1][age]
  const slope = lastVal - prevVal
  if (beyond === 'trend') return Math.max(0, lastVal + slope * (year - last))
  // 'converge': ease the recent slope out to zero over ~30 years, then hold.
  const span = 30
  const k = Math.min(1, (year - last) / span)
  return Math.max(0, lastVal + slope * (year - last) * (1 - k))
}

/** +3 pts absolute peak of the one-off recession shock (flagged: illustrative, not calibrated). */
const SHOCK_PEAK = 0.03

/** Base unemployment plus an optional triangular shock: 0 outside [from,to], ramping linearly
 *  up to +SHOCK_PEAK at `peak`, back to base by `to`. Pure function of the year. */
function unemploymentFn(base: number, shock?: { from: number; peak: number; to: number }): (year: number) => number {
  if (!shock) return () => base
  const { from, peak, to } = shock
  return (year: number) => {
    if (year <= from || year >= to) return base
    const t = year < peak ? (year - from) / (peak - from) : (to - year) / (to - peak)
    return base + SHOCK_PEAK * t
  }
}

/** Central deterministic scenario from real data; reform levers override policy. */
/** Taux d'activité : hypothèse à la COR, qui décroît à l'approche de l'âge légal.
 *  Exporté parce que c'est la définition de la population active DU MODÈLE — la base à
 *  laquelle `project()` applique l'effet de non-cotisation, donc celle sur laquelle cet effet
 *  doit être calculé (voir jobseekerRate, scenarioPresets.ts). */
export function ACTIVITY_RATE(age: number, legalAge: number): number {
  if (age < 20) return 0.25
  if (age >= legalAge) return 0
  if (age >= legalAge - 5) return 0.55
  return 0.9
}

export function buildHypotheses(
  data: ScenarioData,
  policy: Partial<PolicyParams> = {},
  beyond: BeyondDataPolicy = 'hold',
): HypothesisSet {
  const merged: PolicyParams = { ...DEFAULT_POLICY, ...policy }
  // Un âge (ou une durée) passé à plat écrase le calendrier hérité de DEFAULT_POLICY : sinon le
  // calendrier du droit en vigueur avalerait silencieusement le levier, puisqu'il pilote
  // exactement ces deux champs. Même règle que l'UI (setP dans App.tsx). Une réforme qui fournit
  // son propre calendrier le garde, évidemment.
  if (policy.schedule === undefined && (policy.legalAge !== undefined || policy.requiredQuarters !== undefined)) {
    merged.schedule = undefined
  }
  const { years } = data
  // « Exode des actifs » lever: net emigration of workerExodus persons/year, spread
  // uniformly over ages 25-40 (16 ages) and both sexes — 32 equal slices.
  const exodusPerSlice = (merged.workerExodus ?? 0) / 32
  const exodus = (age: number) => (age >= 25 && age <= 40 ? exodusPerSlice : 0)
  return {
    fertility: (y, age) => (age < 15 || age > 50 ? 0 : atYear(data.fertility, years, y, age, beyond)),
    mortality: (y, age, sex: Sex) => atYear(data.mortality[sex], years, y, Math.min(age, OMEGA), beyond),
    migration: (y, age, sex: Sex) => (y < BASE_YEAR ? 0 : atYear(data.migration[sex], years, y, age, beyond) - exodus(age)),
    // Productivity and unemployment are sliders (SCENARIO_PRESETS positions them per scenario);
    // systemParams is the fallback for direct engine calls that pass no policy.
    productivity: () => merged.productivity ?? params.economy.productivity,
    unemployment: unemploymentFn(merged.unemployment ?? params.economy.unemployment, data.unemploymentShock),
    activityRate: (_y, age, legalAge) => ACTIVITY_RATE(age, legalAge),
    policy: () => merged,
    // A reform with a calendar (montée en charge, gel) overrides âge légal et durée requise
    // génération par génération ; sans calendrier on renvoie le MÊME objet — pas de spread,
    // c'est le chemin chaud (106 générations × 45 ans × K tirages en mode stochastique).
    cohortPolicy: merged.schedule?.length
      ? (g) => ({ ...merged, ...atSchedule(merged.schedule!, g) })
      : () => merged,
  }
}

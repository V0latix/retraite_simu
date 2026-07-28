// Runs projections off the main thread so recalcs never block the UI (§9.1).
import initialPyramid from '../data/initialPyramid.json'
import leeCarter from '../data/leeCarter.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import { SCENARIO_IDS, type InitialPyramid, type LeeCarterFit, type ScenarioData, type ScenarioId } from '../data/schema'
import { applyHypotheses, buildChocRecession } from '../data/hypotheses'
import { SCENARIO_PRESETS } from '../data/scenarioPresets'
import { runStochastic, type FanResult } from '../engine/scenarios/fanchart'
import { buildMicroContext } from '../engine/micro/coupling'
import { computePension } from '../engine/micro/pension'
import type { CareerParams, PensionBreakdown } from '../engine/micro/types'
import { synthesizeCareer } from '../engine/micro/career'
import { project } from '../engine/project'
import type { PolicyParams, TimeSeries } from '../engine/types'

export interface MacroRequest {
  type: 'macro'
  scenarioId: ScenarioId
  policy: Partial<PolicyParams>
  horizon: number
}
export interface MicroRequest {
  type: 'micro'
  career: CareerParams
  policy: Partial<PolicyParams>
}
export interface CompareRequest {
  type: 'compare'
  scenarioIds: ScenarioId[]
  policy: Partial<PolicyParams>
  horizon: number
}
export interface StochasticRequest {
  type: 'stochastic'
  draws: number
  horizon: number
  policy: Partial<PolicyParams>
  seed: number
}
export type EngineRequest = MacroRequest | MicroRequest | CompareRequest | StochasticRequest

export interface MacroResponse {
  type: 'macro'
  series: TimeSeries
}
export interface MicroResponse {
  type: 'micro'
  perScenario: { scenarioId: ScenarioId; breakdown: PensionBreakdown }[]
}
export interface CompareResponse {
  type: 'compare'
  seriesById: Record<string, TimeSeries>
}
export interface StochasticResponse {
  type: 'stochastic'
  fan: FanResult
}
export type EngineResponse = MacroResponse | MicroResponse | CompareResponse | StochasticResponse

const scenarioLoaders = import.meta.glob<{ default: ScenarioData }>('../data/scenarios/*.json')
const state0 = buildInitialState(initialPyramid as InitialPyramid)

// Scenarios with no JSON file: derived from the central scenario at load time. Only the
// recession shock is left — everything else a scenario used to change is now a slider.
const DERIVED: Partial<Record<ScenarioId, (c: ScenarioData) => ScenarioData>> = {
  pragmatique: (c) => c, // central demography; its hypotheses ride on SCENARIO_PRESETS
  'choc-recession': buildChocRecession,
}

function loadScenario(id: ScenarioId): Promise<ScenarioData> {
  const derive = DERIVED[id]
  if (derive) return loadScenario('central').then(derive)
  return scenarioLoaders[`../data/scenarios/${id}.json`]().then((m) => m.default)
}

/**
 * Multi-scenario views (compare, micro) share one policy from the macro sidebar. Letting it win
 * would give every scenario the same fertility/migration and flatten the comparison to nothing,
 * so there the scenario's own preset overrides the shared hypotheses — the reform levers
 * (age, cotisation…) still come from the user. In the macro view the sliders ARE the scenario,
 * so they win instead (see runMacro).
 */
const scenarioPolicy = (id: ScenarioId, policy: Partial<PolicyParams>): Partial<PolicyParams> => ({
  ...policy,
  ...SCENARIO_PRESETS[id],
})

async function runMacro(req: MacroRequest): Promise<MacroResponse> {
  const data = applyHypotheses(await loadScenario(req.scenarioId), req.policy)
  const h = buildHypotheses(data, req.policy)
  return { type: 'macro', series: project(state0, h, req.horizon, ECON_INIT) }
}

async function runMicro(req: MicroRequest): Promise<MicroResponse> {
  const career = synthesizeCareer(req.career)
  const liqYear = req.career.birthYear + req.career.retirementAge
  const horizon = Math.max(liqYear, 2070)
  const merged = { legalAge: 64, requiredQuarters: 172, ...req.policy }

  const perScenario = await Promise.all(
    SCENARIO_IDS.map(async (scenarioId) => {
      const p = scenarioPolicy(scenarioId, req.policy)
      const data = applyHypotheses(await loadScenario(scenarioId), p)
      const h = buildHypotheses(data, p)
      const series = project(state0, h, horizon, ECON_INIT)
      const ctx = buildMicroContext(series, h.mortality, merged.legalAge, merged.requiredQuarters)
      return { scenarioId, breakdown: computePension(career, ctx) }
    }),
  )
  return { type: 'micro', perScenario }
}

async function runCompare(req: CompareRequest): Promise<CompareResponse> {
  const seriesById: Record<string, TimeSeries> = {}
  await Promise.all(
    req.scenarioIds.map(async (id) => {
      const p = scenarioPolicy(id, req.policy)
      const data = applyHypotheses(await loadScenario(id), p)
      const h = buildHypotheses(data, p)
      seriesById[id] = project(state0, h, req.horizon, ECON_INIT)
    }),
  )
  return { type: 'compare', seriesById }
}

async function runStochasticReq(req: StochasticRequest): Promise<StochasticResponse> {
  const central = applyHypotheses(await loadScenario('central'), req.policy)
  const fan = runStochastic(state0, central, leeCarter as LeeCarterFit, ECON_INIT, {
    draws: req.draws,
    horizon: req.horizon,
    policy: req.policy,
    seed: req.seed,
  })
  return { type: 'stochastic', fan }
}

self.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const d = e.data
  const res =
    d.type === 'macro'
      ? await runMacro(d)
      : d.type === 'micro'
        ? await runMicro(d)
        : d.type === 'compare'
          ? await runCompare(d)
          : await runStochasticReq(d)
  self.postMessage(res)
}

// Runs projections off the main thread so recalcs never block the UI (§9.1).
import initialPyramid from '../data/initialPyramid.json'
import leeCarter from '../data/leeCarter.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import { SCENARIO_IDS, type BeyondDataPolicy, type InitialPyramid, type LeeCarterFit, type ScenarioData, type ScenarioId } from '../data/schema'
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
  beyondPolicy: BeyondDataPolicy
}
export interface MicroRequest {
  type: 'micro'
  career: CareerParams
  policy: Partial<PolicyParams>
  beyondPolicy: BeyondDataPolicy
}
export interface CompareRequest {
  type: 'compare'
  scenarioIds: ScenarioId[]
  policy: Partial<PolicyParams>
  horizon: number
  beyondPolicy: BeyondDataPolicy
}
export interface StochasticRequest {
  type: 'stochastic'
  draws: number
  horizon: number
  policy: Partial<PolicyParams>
  beyondPolicy: BeyondDataPolicy
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

function loadScenario(id: ScenarioId): Promise<ScenarioData> {
  return scenarioLoaders[`../data/scenarios/${id}.json`]().then((m) => m.default)
}

async function runMacro(req: MacroRequest): Promise<MacroResponse> {
  const data = await loadScenario(req.scenarioId)
  const h = buildHypotheses(data, req.policy, req.beyondPolicy)
  return { type: 'macro', series: project(state0, h, req.horizon, ECON_INIT) }
}

async function runMicro(req: MicroRequest): Promise<MicroResponse> {
  const career = synthesizeCareer(req.career)
  const liqYear = req.career.birthYear + req.career.retirementAge
  const horizon = Math.max(liqYear, 2070)
  const merged = { legalAge: 64, requiredQuarters: 172, ...req.policy }

  const perScenario = await Promise.all(
    SCENARIO_IDS.map(async (scenarioId) => {
      const data = await loadScenario(scenarioId)
      const h = buildHypotheses(data, req.policy, req.beyondPolicy)
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
      const data = await loadScenario(id)
      const h = buildHypotheses(data, req.policy, req.beyondPolicy)
      seriesById[id] = project(state0, h, req.horizon, ECON_INIT)
    }),
  )
  return { type: 'compare', seriesById }
}

async function runStochasticReq(req: StochasticRequest): Promise<StochasticResponse> {
  const central = await loadScenario('central')
  const fan = runStochastic(state0, central, leeCarter as LeeCarterFit, ECON_INIT, {
    draws: req.draws,
    horizon: req.horizon,
    policy: req.policy,
    beyond: req.beyondPolicy,
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

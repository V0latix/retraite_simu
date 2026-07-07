// Runs projections off the main thread so recalcs never block the UI (§9.1).
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import { SCENARIO_IDS, type BeyondDataPolicy, type InitialPyramid, type ScenarioData, type ScenarioId } from '../data/schema'
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
export type EngineRequest = MacroRequest | MicroRequest | CompareRequest

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
export type EngineResponse = MacroResponse | MicroResponse | CompareResponse

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
      const ctx = buildMicroContext(series, merged.legalAge, merged.requiredQuarters)
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

self.onmessage = async (e: MessageEvent<EngineRequest>) => {
  const res =
    e.data.type === 'macro' ? await runMacro(e.data) : e.data.type === 'micro' ? await runMicro(e.data) : await runCompare(e.data)
  self.postMessage(res)
}

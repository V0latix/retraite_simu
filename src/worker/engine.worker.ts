// Runs the projection off the main thread so slider recalcs never block the UI (§9.1).
import initialPyramid from '../data/initialPyramid.json'
import { buildHypotheses, buildInitialState, ECON_INIT } from '../data/loader'
import type { BeyondDataPolicy, InitialPyramid, ScenarioData, ScenarioId } from '../data/schema'
import { project } from '../engine/project'
import type { PolicyParams, TimeSeries } from '../engine/types'

export interface ProjectRequest {
  scenarioId: ScenarioId
  policy: Partial<PolicyParams>
  horizon: number
  beyondPolicy: BeyondDataPolicy
}
export interface ProjectResponse {
  series: TimeSeries
}

// Lazily load each scenario's JSON; only the selected one is fetched.
const scenarioLoaders = import.meta.glob<{ default: ScenarioData }>('../data/scenarios/*.json')
const state0 = buildInitialState(initialPyramid as InitialPyramid)

async function loadScenario(id: ScenarioId): Promise<ScenarioData> {
  const key = `../data/scenarios/${id}.json`
  const mod = await scenarioLoaders[key]()
  return mod.default
}

self.onmessage = async (e: MessageEvent<ProjectRequest>) => {
  const { scenarioId, policy, horizon, beyondPolicy } = e.data
  const data = await loadScenario(scenarioId)
  const h = buildHypotheses(data, policy, beyondPolicy)
  const series = project(state0, h, horizon, ECON_INIT)
  self.postMessage({ series } satisfies ProjectResponse)
}

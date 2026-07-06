// Runs the projection off the main thread so slider recalcs never block the UI (§9.1).
import { buildHypotheses, buildInitialState } from '../data/seed'
import { project } from '../engine/project'
import type { PolicyParams, TimeSeries } from '../engine/types'

export interface ProjectRequest {
  policy: Partial<PolicyParams>
  horizon: number
}
export interface ProjectResponse {
  series: TimeSeries
}

self.onmessage = (e: MessageEvent<ProjectRequest>) => {
  const { policy, horizon } = e.data
  const series = project(buildInitialState(2025), buildHypotheses(policy), horizon)
  self.postMessage({ series } satisfies ProjectResponse)
}

// Aggregation layer (spec §6.3): run project() K times over stochastic draws and
// reduce to per-year percentile bands (fan charts). project() is untouched.
import type { EconInit } from '../project'
import { project } from '../project'
import type { PopulationState, PolicyParams, YearResult } from '../types'
import type { LeeCarterFit, ScenarioData } from '../../data/schema'
import { makeStochasticHypotheses } from './stochastic'

export type FanMetric = 'solde' | 'dependency' | 'share65'
export interface Band {
  year: number
  p5: number
  p25: number
  p50: number
  p75: number
  p95: number
}
export type FanResult = Record<FanMetric, Band[]>

export interface StochasticOptions {
  draws: number
  horizon: number
  policy: Partial<PolicyParams>
  seed: number
}

function share65(r: YearResult): number {
  let old = 0
  let tot = 0
  for (let a = 0; a <= 105; a++) {
    const n = r.pyramid.H[a] + r.pyramid.F[a]
    tot += n
    if (a >= 65) old += n
  }
  return tot > 0 ? old / tot : 0
}

const METRIC: Record<FanMetric, (r: YearResult) => number> = {
  solde: (r) => r.soldePctGdp,
  dependency: (r) => r.dependencySystem,
  share65,
}

function percentile(sorted: number[], p: number): number {
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export function runStochastic(
  state0: PopulationState,
  central: ScenarioData,
  fit: LeeCarterFit,
  econ: EconInit,
  opts: StochasticOptions,
): FanResult {
  const baseYear = state0.year
  const metrics = Object.keys(METRIC) as FanMetric[]
  // samples[metric][yearIndex] = array of K draw values.
  const samples: Record<FanMetric, number[][]> = { solde: [], dependency: [], share65: [] }

  for (let k = 0; k < opts.draws; k++) {
    const h = makeStochasticHypotheses(central, fit, opts.policy, baseYear, opts.horizon, opts.seed + k)
    const series = project(state0, h, opts.horizon, econ)
    series.forEach((r, yi) => {
      for (const m of metrics) {
        ;(samples[m][yi] ??= []).push(METRIC[m](r))
      }
    })
  }

  const result = { solde: [], dependency: [], share65: [] } as FanResult
  const years = opts.horizon - baseYear + 1
  for (const m of metrics) {
    for (let yi = 0; yi < years; yi++) {
      const sorted = samples[m][yi].slice().sort((a, b) => a - b)
      result[m].push({
        year: baseYear + yi,
        p5: percentile(sorted, 0.05),
        p25: percentile(sorted, 0.25),
        p50: percentile(sorted, 0.5),
        p75: percentile(sorted, 0.75),
        p95: percentile(sorted, 0.95),
      })
    }
  }
  return result
}

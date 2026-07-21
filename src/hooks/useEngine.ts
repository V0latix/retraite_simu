import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeyondDataPolicy, ScenarioId } from '../data/schema'
import type { CareerParams } from '../engine/micro/types'
import type { FanResult } from '../engine/scenarios/fanchart'
import type { PolicyParams, TimeSeries } from '../engine/types'
import type { EngineRequest, EngineResponse, MicroResponse } from '../worker/engine.worker'

// One worker + one request/response cycle, shared by every view. Each caller below
// just names its request type and defaults; the boilerplate (spawn, terminate,
// filter by type, `computing` flag, re-post on change) lives here once.
// ponytail: plain worker + useState. Add caching when a single view fans out to
// many scenarios and recompute cost shows up.
function useEngine<T extends EngineResponse['type']>(
  type: T,
  request: Extract<EngineRequest, { type: T }>,
): { data: Extract<EngineResponse, { type: T }> | null; computing: boolean } {
  const [data, setData] = useState<Extract<EngineResponse, { type: T }> | null>(null)
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      if (e.data.type !== type) return
      setData(e.data as Extract<EngineResponse, { type: T }>)
      setComputing(false)
    }
    // Without this, a thrown engine error leaves every view stuck on "Calcul…" forever.
    worker.onerror = (err) => {
      console.error('engine worker error', err)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const key = JSON.stringify(request)
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage(request)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, computing }
}

export function useProjection(scenarioId: ScenarioId, policy: Partial<PolicyParams>, horizon: number, beyondPolicy: BeyondDataPolicy) {
  const { data, computing } = useEngine('macro', { type: 'macro', scenarioId, policy, horizon, beyondPolicy })
  return useMemo(() => ({ series: (data?.series ?? []) as TimeSeries, computing }), [data, computing])
}

export function useCompare(scenarioIds: ScenarioId[], policy: Partial<PolicyParams>, horizon: number, beyondPolicy: BeyondDataPolicy) {
  const { data, computing } = useEngine('compare', { type: 'compare', scenarioIds, policy, horizon, beyondPolicy })
  return useMemo(() => ({ seriesById: data?.seriesById ?? {}, computing }), [data, computing])
}

export function useMicro(career: CareerParams, policy: Partial<PolicyParams>, beyondPolicy: BeyondDataPolicy) {
  const { data, computing } = useEngine('micro', { type: 'micro', career, policy, beyondPolicy })
  return useMemo(() => ({ perScenario: (data?.perScenario ?? []) as MicroResponse['perScenario'], computing }), [data, computing])
}

export function useStochastic(policy: Partial<PolicyParams>, beyondPolicy: BeyondDataPolicy, draws: number, horizon: number, seed: number) {
  const { data, computing } = useEngine('stochastic', { type: 'stochastic', policy, beyondPolicy, draws, horizon, seed })
  return useMemo(() => ({ fan: (data?.fan ?? null) as FanResult | null, computing }), [data, computing])
}

import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeyondDataPolicy, ScenarioId } from '../data/schema'
import type { PolicyParams, TimeSeries } from '../engine/types'
import type { MacroRequest, EngineResponse } from '../worker/engine.worker'

// ponytail: plain worker + useState. Add React Query / caching when we run many
// scenarios at once (Phase 5 stochastic).
export function useProjection(
  scenarioId: ScenarioId,
  policy: Partial<PolicyParams>,
  horizon: number,
  beyondPolicy: BeyondDataPolicy,
) {
  const [series, setSeries] = useState<TimeSeries>([])
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      if (e.data.type !== 'macro') return
      setSeries(e.data.series)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const key = JSON.stringify({ scenarioId, policy, horizon, beyondPolicy })
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage({ type: 'macro', scenarioId, policy, horizon, beyondPolicy } satisfies MacroRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ series, computing }), [series, computing])
}

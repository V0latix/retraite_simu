import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeyondDataPolicy, ScenarioId } from '../data/schema'
import type { PolicyParams, TimeSeries } from '../engine/types'
import type { CompareRequest, EngineResponse } from '../worker/engine.worker'

// Projects several scenarios at once for the comparison + COR validation views.
export function useCompare(
  scenarioIds: ScenarioId[],
  policy: Partial<PolicyParams>,
  horizon: number,
  beyondPolicy: BeyondDataPolicy,
) {
  const [seriesById, setSeriesById] = useState<Record<string, TimeSeries>>({})
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      if (e.data.type !== 'compare') return
      setSeriesById(e.data.seriesById)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const key = JSON.stringify({ scenarioIds, policy, horizon, beyondPolicy })
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage({ type: 'compare', scenarioIds, policy, horizon, beyondPolicy } satisfies CompareRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ seriesById, computing }), [seriesById, computing])
}

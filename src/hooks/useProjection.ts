import { useEffect, useMemo, useRef, useState } from 'react'
import type { PolicyParams, TimeSeries } from '../engine/types'
import type { ProjectRequest, ProjectResponse } from '../worker/engine.worker'

// ponytail: plain worker + useState. Add React Query / caching when we run many
// scenarios at once (Phase 5 stochastic).
export function useProjection(policy: Partial<PolicyParams>, horizon: number) {
  const [series, setSeries] = useState<TimeSeries>([])
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ProjectResponse>) => {
      setSeries(e.data.series)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const key = JSON.stringify({ policy, horizon })
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage({ policy, horizon } satisfies ProjectRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ series, computing }), [series, computing])
}

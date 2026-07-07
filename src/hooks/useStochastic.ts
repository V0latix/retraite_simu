import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeyondDataPolicy } from '../data/schema'
import type { FanResult } from '../engine/scenarios/fanchart'
import type { PolicyParams } from '../engine/types'
import type { EngineResponse, StochasticRequest } from '../worker/engine.worker'

// Drives the stochastic fan-chart projection (Lee-Carter + RW draws).
export function useStochastic(
  policy: Partial<PolicyParams>,
  beyondPolicy: BeyondDataPolicy,
  draws: number,
  horizon: number,
  seed: number,
) {
  const [fan, setFan] = useState<FanResult | null>(null)
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      if (e.data.type !== 'stochastic') return
      setFan(e.data.fan)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const key = JSON.stringify({ policy, beyondPolicy, draws, horizon, seed })
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage({ type: 'stochastic', policy, beyondPolicy, draws, horizon, seed } satisfies StochasticRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ fan, computing }), [fan, computing])
}

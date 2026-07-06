import { useEffect, useMemo, useRef, useState } from 'react'
import type { BeyondDataPolicy } from '../data/schema'
import type { CareerParams } from '../engine/micro/types'
import type { PolicyParams } from '../engine/types'
import type { EngineResponse, MicroRequest, MicroResponse } from '../worker/engine.worker'

// Computes the pension under all 7 macro scenarios (spec §5.4) in the worker.
export function useMicro(
  career: CareerParams,
  policy: Partial<PolicyParams>,
  beyondPolicy: BeyondDataPolicy,
) {
  const [perScenario, setPerScenario] = useState<MicroResponse['perScenario']>([])
  const [computing, setComputing] = useState(true)
  const workerRef = useRef<Worker>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/engine.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<EngineResponse>) => {
      if (e.data.type !== 'micro') return
      setPerScenario(e.data.perScenario)
      setComputing(false)
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  const key = JSON.stringify({ career, policy, beyondPolicy })
  useEffect(() => {
    if (!workerRef.current) return
    setComputing(true)
    workerRef.current.postMessage({ type: 'micro', career, policy, beyondPolicy } satisfies MicroRequest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return useMemo(() => ({ perScenario, computing }), [perScenario, computing])
}

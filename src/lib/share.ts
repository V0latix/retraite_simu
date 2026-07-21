// URL state sharing + CSV export — native, zero-dependency (ponytail).
import { DEFAULT_POLICY } from '../data/loader'
import { SCENARIO_IDS, type BeyondDataPolicy, type ScenarioId } from '../data/schema'
import type { Indexation, PolicyParams, TimeSeries } from '../engine/types'

export type View = 'macro' | 'micro' | 'comparaison' | 'stochastique'

export interface AppState {
  view: View
  scenarioId: ScenarioId
  beyondPolicy: BeyondDataPolicy
  horizon: number
  policy: PolicyParams
}

const VIEWS: View[] = ['macro', 'micro', 'comparaison', 'stochastique']
const BEYONDS: BeyondDataPolicy[] = ['hold', 'trend', 'converge']
const INDEXATIONS: Indexation[] = ['prices', 'wages', 'mix']
// Numeric policy fields, encoded by name. `indexation` (string) is handled apart.
const POLICY_NUM_KEYS = [
  'legalAge', 'requiredQuarters', 'contributionRate', 'productivity',
  'realInterestRate', 'workerExodus', 'underIndexation', 'underIndexationYears',
  'legalAgeLEShare', 'unemployment', 'additionalResourcesPct', 'frrFlowPct',
  'earlyRetirementShare',
] as const

export function encodeState(s: AppState): string {
  const p = new URLSearchParams()
  p.set('v', s.view)
  p.set('s', s.scenarioId)
  p.set('b', s.beyondPolicy)
  p.set('h', String(s.horizon))
  p.set('idx', s.policy.indexation)
  for (const k of POLICY_NUM_KEYS) {
    const v = s.policy[k]
    if (v != null) p.set(k, String(v))
  }
  return p.toString()
}

export function decodeState(p: URLSearchParams): AppState {
  const num = (key: string, fallback: number): number => {
    const n = Number(p.get(key))
    return p.has(key) && Number.isFinite(n) ? n : fallback
  }
  const oneOf = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const v = p.get(key) as T | null
    return v != null && allowed.includes(v) ? v : fallback
  }
  const policy: PolicyParams = { ...DEFAULT_POLICY, indexation: oneOf('idx', INDEXATIONS, DEFAULT_POLICY.indexation) }
  for (const k of POLICY_NUM_KEYS) {
    if (p.has(k)) {
      const n = Number(p.get(k))
      if (Number.isFinite(n)) policy[k] = n
    }
  }
  return {
    view: oneOf('v', VIEWS, 'macro'),
    scenarioId: oneOf('s', SCENARIO_IDS, 'central'),
    beyondPolicy: oneOf('b', BEYONDS, 'hold'),
    horizon: num('h', 2070),
    policy,
  }
}

/** Flatten the projected series to CSV (all scalar YearResult fields; `pyramid` omitted). */
export function seriesToCsv(series: TimeSeries): string {
  if (series.length === 0) return ''
  const keys = Object.keys(series[0]).filter((k) => k !== 'pyramid')
  const cell = (v: unknown) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [keys.join(',')]
  for (const row of series) lines.push(keys.map((k) => cell((row as unknown as Record<string, unknown>)[k])).join(','))
  return lines.join('\n')
}

export function downloadCsv(name: string, csv: string): void {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

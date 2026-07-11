// Shared "passé observé / futur projeté" convention, used by every chart.
//
// Observed data is measured (COR, INSEE); projected data comes out of the engine.
// Conflating the two is the single most misleading thing a chart here could do, so
// the split is expressed once, centrally, rather than re-improvised per chart.
//
// The React half of the convention (frontier rule, legend) lives in ObservedProjected.tsx.
import { createElement } from 'react'
import { ReferenceLine } from 'recharts'
import { LAST_OBSERVED_YEAR } from '../data/loader'
import { CHART } from './chartColors'

export { LAST_OBSERVED_YEAR }

/** Projected lines are dashed; observed lines are solid. Same hue, so series stay comparable. */
export const PROJECTED_DASH = '5 4'

export type Row = { year: number } & Record<string, number | null | undefined>
export type MergedRow = { year: number } & Record<string, number | null>

/**
 * Fold observed and projected series into one row-per-year array carrying `obs_<key>`
 * and `proj_<key>` fields, so a chart can draw two <Line>s over a single dataset.
 *
 * The projected line is anchored, PER KEY, on that key's last *real* observed year
 * (the latest year ≤ joinYear whose value isn't null), not on a fixed frontier. This
 * matters when a series has a hole at the nominal join year — e.g. the retirees count
 * lags a year behind, so `activePerRetiree` is null at 2024 and the last measured point
 * is 2023. Seeding the dashed line at that real point makes the solid and dashed
 * segments meet instead of leaving a gap (the COR splices its own workbooks the same way).
 *
 * The projected line should be drawn with `connectNulls={true}` so it bridges the empty
 * frontier year (e.g. 2024) from the anchor to the first model year; the observed line
 * keeps `connectNulls={false}` to preserve genuine historical holes.
 */
export function mergeObservedProjected(
  observed: readonly Row[],
  projected: readonly Row[],
  keys: readonly string[],
  joinYear: number = LAST_OBSERVED_YEAR,
): MergedRow[] {
  const obsBy = new Map(observed.map((r) => [r.year, r]))
  const projBy = new Map(projected.map((r) => [r.year, r]))
  const years = [...new Set([...obsBy.keys(), ...projBy.keys()])].sort((a, b) => a - b)

  // Last observed year (≤ joinYear) that actually holds a value, per key.
  const anchor: Record<string, number> = {}
  for (const k of keys) {
    let a = -Infinity
    for (const r of observed) if (r.year <= joinYear && r[k] != null) a = Math.max(a, r.year)
    anchor[k] = a
  }

  return years.map((year) => {
    const row: MergedRow = { year }
    for (const k of keys) {
      const o = obsBy.get(year)?.[k] ?? null
      const p = projBy.get(year)?.[k] ?? null
      const a = anchor[k]
      row[`obs_${k}`] = year <= a ? o : null
      row[`proj_${k}`] = year > a ? p : year === a ? (p ?? o) : null
    }
    return row
  })
}

/** Build `{year, key}` rows from the parallel arrays the historical JSON stores. */
export function toRows(years: readonly number[], values: Record<string, readonly (number | null)[]>): Row[] {
  return years.map((year, i) => {
    const row: Row = { year }
    for (const [k, arr] of Object.entries(values)) row[k] = arr[i] ?? null
    return row
  })
}

/**
 * Dashed vertical rule marking where measurement stops and projection begins.
 * A plain factory, not a component: Recharts only honours a <ReferenceLine> that is
 * a direct child of the chart, so a wrapper component would be silently ignored.
 */
export function frontier(year: number = LAST_OBSERVED_YEAR, label = 'projection →') {
  return createElement(ReferenceLine, {
    x: year,
    stroke: CHART.muted,
    strokeDasharray: '2 3',
    label: { value: label, position: 'insideTopLeft', fontSize: 10, fill: CHART.muted },
  })
}

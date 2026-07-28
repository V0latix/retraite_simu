// Demographic hypotheses applied on top of a scenario's published matrices.
//
// The UI exposes fertility and net migration as sliders, so any scenario can be re-targeted
// onto arbitrary values without touching the engine: we rescale the *yearly totals* and leave
// the age/sex profiles alone (INSEE's shape, our level). The whole chain (demography → finance
// → pensions) then recomputes through project() — « a scenario is data, not a branch ».
//
// This is the mechanism the old « Pragmatique » scenario was hard-coded around; it is now
// generic, and Pragmatique is just a set of slider positions (see scenarioPresets.ts).
import type { PolicyParams } from '../engine/types'
import type { ScenarioData } from './schema'

const sum = (a: readonly number[]) => a.reduce((s, v) => s + v, 0)

/**
 * Re-target a scenario's fertility / migration onto the policy's `tfr` / `netMigration`.
 * Pure; an absent target leaves that matrix untouched (identity on the scenario's own data).
 *
 * ponytail: the target is flat over the whole horizon — no ramp from today's observed value.
 * The old Pragmatique ramped 1,53 (2025) → 1,45 (2040); the flat 1,45 the slider now carries
 * costs ~200 k births whose cohorts only reach the workforce after 2045, so its 2070 balance
 * lands at −3,13 % PIB instead of −3,00 % (dépendance 0,659 vs 0,654). Add a ramp — target
 * reached over N years from the scenario's own start — if that 0,13 pt ever matters.
 */
export function applyHypotheses(d: ScenarioData, p: Partial<PolicyParams>): ScenarioData {
  const out = { ...d }

  if (p.tfr != null) {
    out.fertility = d.fertility.map((row) => {
      const base = sum(row)
      return base > 0 ? row.map((v) => (v * p.tfr!) / base) : row
    })
  }

  if (p.netMigration != null) {
    // The net balance is H + F for a given year, so both sexes share one scaling factor.
    const k = d.migration.H.map((_, i) => {
      const net = sum(d.migration.H[i]) + sum(d.migration.F[i])
      return net !== 0 ? p.netMigration! / net : 0
    })
    const scale = (mat: number[][]) => mat.map((row, i) => row.map((v) => v * k[i]))
    out.migration = { H: scale(d.migration.H), F: scale(d.migration.F) }
  }

  return out
}

// « Choc conjoncturel » — central demography with a one-off unemployment spike: +3 pts (peak
// height set in the loader) rising from 2027, peaking 2028, back to base by 2030. Shows the
// short-term sensitivity of the balance (fewer contributors during the recession). Stays a
// scenario rather than a slider: it's a *shape over time*, not a level.
export const buildChocRecession = (c: ScenarioData): ScenarioData => ({
  ...c,
  meta: { ...c.meta, scenario: 'choc-recession' },
  unemploymentShock: { from: 2027, peak: 2028, to: 2030 },
})

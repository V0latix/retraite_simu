// On-brand chart palette, derived from the « Light brutalist » theme (mirrors the
// --chart-* variables in src/index.css). Single source of truth for Recharts strokes,
// fills, tooltips and legends — Recharts needs concrete color strings, so these are hex,
// not var(). Keep in sync with index.css if the theme changes.
export const CHART = {
  primary: '#1a56db', // accent — model / main series
  primarySoft: '#93aef0', // lighter tint for sub-areas (employee share)
  danger: '#cc2222', // deficit, COR reference, total contributed
  success: '#1a7a4a', // break-even
  violet: '#7c3aed', // cumulative balance, reserves line
  amber: '#b45309', // contributors/retiree ratio
  pink: '#be185d', // complémentaire / women
  blue: '#2563eb', // contributors / secondary blue
  muted: '#777777', // frontier, grid, axes, unselected bars
} as const

// Multi-series overlay palette (scenario comparison), most-distinct first.
export const SERIES = [CHART.primary, CHART.pink, CHART.amber, CHART.success, CHART.blue, CHART.violet, CHART.danger] as const

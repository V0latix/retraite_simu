# Simulateur de retraite — France

Web app simulating the French pension system at two coupled scales:
- **Macro** — national demography → economy → pension system → yearly balance, under reform scenarios.
- **Micro** (not built yet) — an individual's pension (régime général + AGIRC-ARRCO) computed *inside* a chosen macro context.

The coupling is the point: macro outputs (PASS, point value, indexation, legal age) feed the micro pension calc. Full spec: `docs/cahier-des-charges.md`.

## Stack
React 19 + Vite + TypeScript (strict) + Tailwind v4. Charts: Recharts. Tests: Vitest. Engine runs in a Web Worker. Static hosting on Vercel. No backend.

## Architecture invariants (do not break)
- **Engine is 100% React-free** (`src/engine/`). Pure, deterministic, testable in isolation.
- **Single projection entry point:** `project(state0, hypothesisSet, horizon) => TimeSeries` (`src/engine/project.ts`). Same signature in deterministic and (future) stochastic mode.
- **A scenario is data, not branches.** Reform levers live in `HypothesisSet.policy` as functions of time — never an `if` in the engine.
- **All scale/barème numbers live in data**, never hard-coded in engine logic. Currently `src/data/seed.ts` (parametric placeholder). Phase 0 replaces it with strict versioned INSEE/HMD/COR JSON.

## Layout
```
src/engine/      pure engine: types, demography (cohort-component), project()
src/data/        seed.ts — PLACEHOLDER data, replace with real JSON in Phase 0
src/worker/      engine.worker.ts — runs project() off-thread
src/hooks/       useProjection — drives the worker
src/ui/          Pyramid, MacroCharts, Levers
```

## Data status ⚠️
`src/data/seed.ts` is **not sourced** — closed-form approximations shaped like France ~2025 so the app runs. The seed pyramid is young-heavy; totals aren't realistic until Phase 0 lands real INSEE data. Don't present outputs as accurate before COR calibration (Phase 4).

## Roadmap (phases)
0 Data · 1 Demography+pyramid ✅ · 2 Macro finance ✅(seed) · 3 Micro (RG + AGIRC-ARRCO) · 4 Coupling + COR validation · 5 Stochastic (Lee-Carter, fan charts)

## Workflow
- Each feature → its own `feature/*` branch, commit, then deploy to Vercel.
- `npm run dev` · `npm run build` · `npx vitest run`.
- Engine changes must keep `src/engine/engine.test.ts` green (population ≥ 0, no runaway, reform monotonicity).

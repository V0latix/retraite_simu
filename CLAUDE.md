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
src/data/        loader.ts + real INSEE JSON (scenarios/*.json, initialPyramid.json), schema.ts, systemParams.json
src/worker/      engine.worker.ts — runs project() off-thread
src/hooks/       useProjection — drives the worker
src/ui/          Pyramid, MacroCharts, Levers
scripts/         ingest-insee.mjs — regenerates the JSON from INSEE workbooks (dev-only)
```

## Data status
- **Demography = real INSEE** (Projections 2021-2070): 7 scenarios (central + fécondité/EV/migration ±), qx/fertility/migration by age 2025-2070, initial 2025 pyramid. Regenerate via `node scripts/ingest-insee.mjs`. Calibration: our cohort-component reproduces INSEE's 2070 total (~69M vs 68.1M, ~1.3%) and 65+ share (~30%).
- **Extrapolation past 2070** is explicit (`BeyondDataPolicy` = hold/trend/converge, §7), chosen in the UI.
- ⚠️ **Finance block is not calibrated** — `systemParams.json` holds hand-curated headline figures (PASS, legal age, contribution rate, avg pension). Absolute €/solde levels await COR calibration (Phase 4). Don't present the solde/dette as accurate yet; the demographic curves are sound.
- Micro barèmes (décote/surcote, point value) → Phase 3. HMD skipped: INSEE's 1962-2070 qx series covers the Phase-5 Lee-Carter history.

## Roadmap (phases)
0 Data ✅(demography) · 1 Demography+pyramid ✅ · 2 Macro finance ✅(uncalibrated €) · 3 Micro (RG + AGIRC-ARRCO) · 4 Coupling + COR validation · 5 Stochastic (Lee-Carter, fan charts)

## Workflow
- Each feature → its own `feature/*` branch, commit, then deploy to Vercel.
- `npm run dev` · `npm run build` · `npx vitest run`.
- Engine changes must keep `src/engine/engine.test.ts` green (population ≥ 0, no runaway, reform monotonicity).

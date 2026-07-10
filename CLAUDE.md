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
src/engine/micro/  RG (regimeGeneral) + AGIRC-ARRCO (agircArrco) + coupling + pension; career synth
src/engine/scenarios/  stochastic (Lee-Carter generator) + fanchart (percentile aggregation)
src/data/        loader.ts + real INSEE JSON (scenarios/*.json, initialPyramid.json), historical.json + historicalPyramid.json (observed), schema.ts, systemParams.json, pensionParams.json
src/worker/      engine.worker.ts — {type:'macro'|'micro'} off-thread
src/hooks/       useProjection (macro), useMicro (pension × 7 scenarios), useCompare (macro × N scenarios)
src/ui/          Pyramid, MacroCharts, Levers, ComparisonView (COR validation + scenario overlay) · observed.ts + ObservedProjected.tsx (observed/projected convention) · micro/ CareerForm, PensionResult, ScenarioSensitivity, MicroView
scripts/         ingest-insee.mjs (projections) + ingest-historical.mjs (observed) — regenerate the JSON from INSEE/COR workbooks (dev-only)
```

## Observed vs projected (invariant)
Every time-series chart shows **observed data solid, projected data dashed**, with a `frontier()` rule at the boundary. The convention lives in `src/ui/observed.ts` (`mergeObservedProjected`, `frontier`, `PROJECTED_DASH`) + `ObservedProjected.tsx` (legend) — reuse it, never re-improvise per chart. The engine stays untouched: history is display data, loaded from `historical.json` / `historicalPyramid.json` and merged in the UI. The join year appears in both the observed and projected fields so the segments meet (this is also what COR's own workbooks do). Micro/career charts split at `BASE_YEAR` but are labelled *carrière passée / projetée*, never "observé" — the salary is user input even for past years.

## Data status
- **Observed series** (`node scripts/ingest-historical.mjs`): COR rapport annuel juin 2025 workbooks → dépenses/ressources/solde % PIB, cotisants, retraités, PIB (2002-2024, `Obs` rows); ratio 20-64/65+ (1962-2024); réserves du système au 31/12/2024 = 213,8 Md€ ≈ 7,3 % PIB (Tab 2.3), used to anchor the cumulative-balance chart. INSEE POP3 → pyramides observées 1946 (ordonnances créant le régime général) → 2025; champ *France métropolitaine* before 1991, *France* after — stored per year, never spliced. Retirees lag a year behind (holes are `null`).
- **Demography = real INSEE** (Projections 2021-2070): 7 scenarios (central + fécondité/EV/migration ±), qx/fertility/migration by age 2025-2070, initial 2025 pyramid. Regenerate via `node scripts/ingest-insee.mjs`. Calibration: our cohort-component reproduces INSEE's 2070 total (~69M vs 68.1M, ~1.3%) and 65+ share (~30%).
- **Extrapolation past 2070** is explicit (`BeyondDataPolicy` = hold/trend/converge, §7), chosen in the UI.
- **Finance block calibrated to COR** (Phase 4): constant (real) euros, base-year anchored to the COR June 2025 reference (`corReference.json`) — dépenses ≈13.9% PIB, solde ≈−0.1% PIB in 2025; solde reaches ≈−1.36% PIB in 2070 (COR −1.4%). Outputs in % PIB. `systemParams.json` `calibration` block holds the anchors + `pensionDriftShare` (noria) + resource taper. ⚠️ Mid-century the model runs ~1–1.5 pt more pessimistic than COR (single aggregated regime, retirees≈pop 64+); the écart is shown honestly in the Validation view, not hidden.
- **Micro engine (Phase 3) runs in constant (real) euros.** RG (SAM = 25 best capped at PASS, décote/surcote, proratisation) + AGIRC-ARRCO points. Barèmes in `pensionParams.json` — hand-curated/approximate, flagged. The macro→micro coupling (§5.4) ties the AGIRC-ARRCO point value to each scenario's `dependencySystem` (`couplingSensitivity` k, gentle) so the same career yields a different pension per scenario. Replacement rates land in the realistic range (SMIC ~64%, médian ~53%, cadre ~34%); the per-scenario spread is small for near-2049 retirees (honest) and widens for younger cohorts. HMD skipped: INSEE's 1962-2070 qx covers Phase-5.

## Roadmap (phases)
0 Data ✅(demography) · 1 Demography+pyramid ✅ · 2 Macro finance ✅ · 3 Micro (RG + AGIRC-ARRCO) ✅ · 4 Coupling + COR validation ✅ · 5 Stochastic (Lee-Carter, fan charts) ✅ — v1 roadmap complete

## Stochastic mode (Phase 5)
Lee-Carter fitted at build time on INSEE observed qx 1962-2021 (`scripts/ingest-insee.mjs` → `leeCarter.json`: α/β/κ, drift, σ per sex). The generator (`src/engine/scenarios/stochastic.ts`) perturbs the **calibrated central** — qx·exp(β_a·z_t) with z a driftless RW (σ from the fit), plus RW factors on fertility/migration (hand-tuned σ, flagged) — so the median tracks the deterministic central and the fan is data-grounded. `runStochastic` (fanchart.ts) runs `project()` K times → p5/25/50/75/95 bands. `project()` itself is unchanged (invariant held). Fan tab covers solde %PIB, dependency, 65+ share.

## Workflow
- Each feature → its own `feature/*` branch, commit, then deploy to Vercel.
- `npm run dev` · `npm run build` · `npx vitest run`.
- Engine changes must keep `src/engine/engine.test.ts` green (population ≥ 0, no runaway, reform monotonicity).

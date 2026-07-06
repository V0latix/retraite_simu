# Data ingestion

## `ingest-insee.mjs`
Turns the INSEE *Projections de population 2021-2070* workbooks into the strict
JSON under `src/data/` (`scenarios/*.json` + `initialPyramid.json` + `insee-manifest.json`).

```bash
node scripts/ingest-insee.mjs
```

Downloads the 7 scenario workbooks (cached in `scripts/.cache/`, gitignored) and
extracts, for years 2025-2070 and ages 0-105:
- `hyp_mortaliteH/F` → mortality qx (source is per 100 000 → divided)
- `hyp_fecondite` → fertility rate (per 10 000 → divided)
- `hyp_soldemigH/F` → net migration by age
- `populationH/F` at 2025 → initial pyramid (central scenario only)

Sources:
- central: https://www.insee.fr/fr/statistiques/5894083 (`00_central.xlsx`)
- variants: https://www.insee.fr/fr/statistiques/5894085 (`1x_*.xlsx`)

Re-run when INSEE publishes a new projection vintage. Update `FILES`/`BASE_YEAR`
in the script if the pages or base year change, then re-run and commit the JSON.

## `systemParams.json`
Hand-curated (NOT ingested): PASS, legal age, required quarters, contribution
rate, economic hypotheses (COR), and system init figures (DREES). Each field is
annotated with its source in `_sources`. Update by hand as barèmes change.

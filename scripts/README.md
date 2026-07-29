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

It also fits **Lee-Carter** on the observed qx 1962-2021 (central workbook) and
emits `src/data/leeCarter.json` (α/β/κ, drift, σ per sex) for the stochastic mode.

Sources:
- central: https://www.insee.fr/fr/statistiques/5894083 (`00_central.xlsx`)
- variants: https://www.insee.fr/fr/statistiques/5894085 (`1x_*.xlsx`)

Re-run when INSEE publishes a new projection vintage. Update `FILES`/`BASE_YEAR`
in the script if the pages or base year change, then re-run and commit the JSON.

## `ingest-jobseekers.mjs`
Remplit `historical.jobseekers` — les inscrits à France Travail par catégorie
A→G, effectifs bruts trimestriels (1996T1→aujourd'hui), sur lesquels le scénario
Pragmatique cale son taux de non-emploi.

```bash
node scripts/ingest-jobseekers.mjs [chemin/vers/export.csv]   # défaut : scripts/.cache/defm_brut_trim.csv
```

Le CSV n'est **pas** téléchargeable automatiquement : `statistiques.francetravail.org`
est derrière une protection anti-bot, et la seule ressource stable de data.gouv est
le fichier CVS-CJO, qui ne publie ni F ni G. À exporter à la main, une fois par
trimestre, sur <https://statistiques.francetravail.org/stmt/teleselo> :
stock trimestriel, données **Brutes**, champ France, catégories A à G, tous les
croisements sur « Total », export CSV (`;`).

Le script ne réécrit que la clé `jobseekers` et sa ligne `_sources` — le reste de
`historical.json` (blocs saisis à la main compris) est relu et conservé.

## `systemParams.json`
Hand-curated (NOT ingested): PASS, legal age, required quarters, contribution
rate, economic hypotheses (COR), and system init figures (DREES). Each field is
annotated with its source in `_sources`. Update by hand as barèmes change.

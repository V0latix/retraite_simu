// Ingests the France Travail DEFM headcounts (catégories A→G) into `historical.jobseekers`.
// Dev-only, re-runnable, merges into historical.json without touching anything else.
//
//   node scripts/ingest-jobseekers.mjs [chemin/vers/export.csv]
//   (défaut : scripts/.cache/defm_brut_trim.csv)
//
// Le CSV n'est PAS téléchargeable automatiquement : statistiques.francetravail.org est derrière
// une protection anti-bot, et la seule ressource stable de data.gouv est le fichier CVS-CJO, qui
// ne publie ni F ni G. Il faut donc l'exporter à la main, une fois par trimestre :
//   statistiques.francetravail.org/stmt/teleselo
//   → « Demandeurs d'emploi — stock », périodicité trimestrielle, données **Brutes**
//     (seules les brutes publient F et G), champ France, catégories A à G,
//     tous les croisements sur « Total » → export CSV (séparateur « ; »).
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data')
const SRC = process.argv[2] ?? join(__dirname, '.cache', 'defm_brut_trim.csv')

const CATS = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const RETRIEVED = new Date().toISOString().slice(0, 10)

const SOURCE =
  'France Travail – Dares, STMT, « Inscrits à France Travail – Stock – France (trimestrielles, ' +
  `brutes) » (statistiques.francetravail.org/stmt/teleselo, export du ${RETRIEVED}). Champ France ` +
  'entière hors Mayotte, Saint-Martin et Saint-Barthélemy ; effectifs bruts (non CVS-CJO). ' +
  'A→E depuis 1996T1 ; F et G, créées en janvier 2025 par la loi plein emploi, sont nulles avant — ' +
  'et seules les séries brutes les publient.'

if (!existsSync(SRC)) {
  console.error(`CSV introuvable : ${SRC}\nVoir l'en-tête de ce script pour l'exporter.`)
  process.exit(1)
}

// Le fichier est un cube à plat : une ligne par croisement de TOUTES les dimensions. Ne garder que
// la ligne « Total » de chaque dimension autre que Date/Champ/Catégorie, sinon on somme des
// ventilations par-dessus le total.
const lines = readFileSync(SRC, 'utf8').replace(/^﻿/, '').split(/\r?\n/)
const header = lines[0].split(';')
const iDate = header.indexOf('Date')
const iChamp = header.indexOf('Champ')
const iCat = header.indexOf('Catégorie')
const iValue = header.length - 1
const crossed = header.map((_, i) => i).filter((i) => i > iCat && i < iValue)

const byPeriod = new Map()
for (const line of lines.slice(1)) {
  if (!line) continue
  const f = line.split(';')
  if (f[iChamp] !== 'France' || !CATS.includes(f[iCat])) continue
  if (crossed.some((i) => f[i] !== 'Total')) continue
  const period = f[iDate].replace('-', '') // « 1996-T1 » → « 1996T1 »
  if (!byPeriod.has(period)) byPeriod.set(period, {})
  byPeriod.get(period)[f[iCat]] = f[iValue] === '' ? 0 : Number(f[iValue])
}

const periods = [...byPeriod.keys()].sort()
const jobseekers = { periods }
for (const cat of CATS) {
  jobseekers[cat.toLowerCase()] = periods.map((p) => {
    const v = byPeriod.get(p)[cat]
    if (v === undefined) throw new Error(`catégorie ${cat} absente au ${p}`)
    return v
  })
}

const historical = JSON.parse(readFileSync(join(OUT, 'historical.json'), 'utf8'))
historical.jobseekers = jobseekers
historical._sources.jobseekers = SOURCE
writeFileSync(join(OUT, 'historical.json'), JSON.stringify(historical))

const last = periods.at(-1)
const total = CATS.reduce((s, c) => s + jobseekers[c.toLowerCase()].at(-1), 0)
console.log(`jobseekers : ${periods.length} trimestres, ${periods[0]} → ${last}`)
console.log(`  total A→G au ${last} : ${(total / 1e6).toFixed(2)} M`)
console.log(`  F+G nuls jusqu'au ${periods[jobseekers.f.findIndex((v) => v > 0) - 1]}`)

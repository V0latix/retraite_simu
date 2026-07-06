// Phase 0 data ingestion — turns INSEE "Projections 2021-2070" workbooks into
// strict versioned JSON under src/data/. Dev-only, re-runnable (e.g. when INSEE
// refreshes). Not shipped to the client.
//
//   node scripts/ingest-insee.mjs
//
// Source: INSEE Résultats "Projections de population 2021-2070 pour la France"
//   central : https://www.insee.fr/fr/statistiques/5894083   (00_central.xlsx)
//   variants: https://www.insee.fr/fr/statistiques/5894085   (1x_*.xlsx)
import XLSX from 'xlsx'
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const CACHE = join(__dirname, '.cache')
const OUT = join(ROOT, 'src', 'data')
const OUT_SCEN = join(OUT, 'scenarios')

const BASE_YEAR = 2025
const END_YEAR = 2070
const OMEGA = 105 // terminal age; INSEE population uses a "105+" open group
const RETRIEVED = new Date().toISOString().slice(0, 10)

// file → { id: INSEE page id for the download URL, scenario: our id }
const FILES = {
  '00_central.xlsx': { page: 5894083, scenario: 'central' },
  '11_fec_haute.xlsx': { page: 5894085, scenario: 'fertility-high' },
  '12_fec_basse.xlsx': { page: 5894085, scenario: 'fertility-low' },
  '13_ev_haute.xlsx': { page: 5894085, scenario: 'mortality-low' }, // higher life expectancy
  '14_ev_basse.xlsx': { page: 5894085, scenario: 'mortality-high' },
  '15_smi_haut.xlsx': { page: 5894085, scenario: 'migration-high' },
  '16_smi_bas.xlsx': { page: 5894085, scenario: 'migration-low' },
}

async function fetchFile(name, page) {
  const dest = join(CACHE, name)
  if (existsSync(dest)) return dest
  mkdirSync(CACHE, { recursive: true })
  const url = `https://www.insee.fr/fr/statistiques/fichier/${page}/${name}`
  process.stdout.write(`  downloading ${name}… `)
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('ok')
  return dest
}

// Rows: [1]=header (col0 label, then years), [2..]=age in col0 then values/year.
// Returns { colOfYear:Map, rows:[[age,...values]] } for the FIRST contiguous
// age block (INSEE sheets append other blocks — survie, espérance de vie — below).
function sheetBlock(ws) {
  const A = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
  const header = A[1]
  const colOfYear = new Map()
  for (let j = 1; j < header.length; j++) if (typeof header[j] === 'number') colOfYear.set(header[j], j)
  const rows = []
  for (let r = 2; r < A.length; r++) {
    const c0 = A[r][0]
    const age = c0 === '105+' ? OMEGA : c0
    if (typeof age !== 'number' || !Number.isInteger(age)) break // end of the age block
    rows.push({ age, cells: A[r] })
  }
  return { colOfYear, rows }
}

const round = (v, d) => (v == null || Number.isNaN(v) ? 0 : Number(v.toFixed(d)))

// age×year matrix over [0..OMEGA] × [BASE_YEAR..END_YEAR], value transformed by fn.
function matrix(ws, fn, ageLo = 0, ageHi = OMEGA) {
  const { colOfYear, rows } = sheetBlock(ws)
  const years = []
  for (let y = BASE_YEAR; y <= END_YEAR; y++) years.push(y)
  const M = years.map(() => new Array(OMEGA + 1).fill(0))
  for (const { age, cells } of rows) {
    if (age < ageLo || age > ageHi || age > OMEGA) continue
    years.forEach((y, yi) => {
      const col = colOfYear.get(y)
      M[yi][age] = fn(typeof cells[col] === 'number' ? cells[col] : 0)
    })
  }
  return { years, M }
}

function extractScenario(wb, scenario) {
  const qxH = matrix(wb.Sheets.hyp_mortaliteH, (v) => round(v / 1e5, 7)) // per 100000
  const qxF = matrix(wb.Sheets.hyp_mortaliteF, (v) => round(v / 1e5, 7))
  const fec = matrix(wb.Sheets.hyp_fecondite, (v) => round(v / 1e4, 6), 15, 50) // per 10000
  const migH = matrix(wb.Sheets.hyp_soldemigH, (v) => round(v, 1))
  const migF = matrix(wb.Sheets.hyp_soldemigF, (v) => round(v, 1))
  return {
    meta: {
      source: 'INSEE — Projections de population 2021-2070 pour la France',
      inseeId: scenario === 'central' ? 5894083 : 5894085,
      scenario,
      retrieved: RETRIEVED,
    },
    years: qxH.years,
    ages: Array.from({ length: OMEGA + 1 }, (_, a) => a),
    mortality: { H: qxH.M, F: qxF.M }, // qx (probability)
    fertility: fec.M, // rate per woman
    migration: { H: migH.M, F: migF.M }, // net headcount
  }
}

function extractInitialPyramid(wb) {
  const popH = matrix(wb.Sheets.populationH, (v) => Math.round(v))
  const popF = matrix(wb.Sheets.populationF, (v) => Math.round(v))
  const yi = popH.years.indexOf(BASE_YEAR)
  return {
    meta: {
      source: 'INSEE — Projections de population 2021-2070 (scénario central)',
      inseeId: 5894083,
      year: BASE_YEAR,
      retrieved: RETRIEVED,
    },
    ages: Array.from({ length: OMEGA + 1 }, (_, a) => a),
    H: popH.M[yi],
    F: popF.M[yi],
  }
}

async function main() {
  mkdirSync(OUT_SCEN, { recursive: true })
  const manifest = { source: 'INSEE Projections 2021-2070', retrieved: RETRIEVED, scenarios: {} }

  for (const [name, { page, scenario }] of Object.entries(FILES)) {
    const path = await fetchFile(name, page)
    const wb = XLSX.readFile(path)
    const data = extractScenario(wb, scenario)
    writeFileSync(join(OUT_SCEN, `${scenario}.json`), JSON.stringify(data))
    manifest.scenarios[scenario] = { file: name, inseeId: data.meta.inseeId }
    console.log(`  ${scenario}: ${data.years.length} years × ${data.ages.length} ages`)

    if (scenario === 'central') {
      const pyr = extractInitialPyramid(wb)
      writeFileSync(join(OUT, 'initialPyramid.json'), JSON.stringify(pyr))
      const tot = pyr.H.reduce((s, v) => s + v, 0) + pyr.F.reduce((s, v) => s + v, 0)
      console.log(`  initialPyramid ${BASE_YEAR}: total ${(tot / 1e6).toFixed(2)}M`)
    }
  }
  writeFileSync(join(OUT, 'insee-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

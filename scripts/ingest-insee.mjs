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

// age×year matrix over [0..OMEGA] × [fromY..toY], value transformed by fn.
function matrixRange(ws, fn, fromY, toY, ageLo = 0, ageHi = OMEGA) {
  const { colOfYear, rows } = sheetBlock(ws)
  const years = []
  for (let y = fromY; y <= toY; y++) years.push(y)
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
const matrix = (ws, fn, ageLo = 0, ageHi = OMEGA) => matrixRange(ws, fn, BASE_YEAR, END_YEAR, ageLo, ageHi)

// Lee-Carter: ln q(a,t) = α_a + β_a·κ_t + ε. Rank-1 fit by power iteration on the
// age-centered log-mortality matrix (qxM[t][a] = probability). §6.3.
function fitLeeCarter(qxM, years) {
  const A = OMEGA + 1
  const T = years.length
  // Treat q<=0 as missing (INSEE has empty cells at sparse high ages / tail years);
  // averaging and centering over valid cells only keeps outliers from wrecking κ.
  const valid = (t, a) => qxM[t][a] > 0
  const alpha = new Array(A).fill(Math.log(1e-4))
  for (let a = 0; a < A; a++) {
    let s = 0
    let n = 0
    for (let t = 0; t < T; t++) if (valid(t, a)) (s += Math.log(qxM[t][a])), n++
    if (n) alpha[a] = s / n
  }
  const M = qxM.map((row, t) => row.map((q, a) => (valid(t, a) ? Math.log(q) - alpha[a] : 0))) // centered: M[t][a] ≈ κ_t·β_a
  let beta = new Array(A).fill(1 / Math.sqrt(A))
  let kappa = new Array(T).fill(0)
  for (let it = 0; it < 300; it++) {
    let bb = 0
    for (let a = 0; a < A; a++) bb += beta[a] * beta[a]
    for (let t = 0; t < T; t++) {
      let s = 0
      for (let a = 0; a < A; a++) s += M[t][a] * beta[a]
      kappa[t] = s / bb
    }
    let kk = 0
    for (let t = 0; t < T; t++) kk += kappa[t] * kappa[t]
    if (kk === 0) break
    for (let a = 0; a < A; a++) {
      let s = 0
      for (let t = 0; t < T; t++) s += M[t][a] * kappa[t]
      beta[a] = s / kk
    }
  }
  // LC constraints: Σβ = 1, Σκ = 0 (absorb the mean into α).
  let sb = 0
  for (let a = 0; a < A; a++) sb += beta[a]
  if (sb !== 0) {
    for (let a = 0; a < A; a++) beta[a] /= sb
    for (let t = 0; t < T; t++) kappa[t] *= sb
  }
  let mk = 0
  for (let t = 0; t < T; t++) mk += kappa[t]
  mk /= T
  for (let t = 0; t < T; t++) kappa[t] -= mk
  for (let a = 0; a < A; a++) alpha[a] += beta[a] * mk
  const drift = (kappa[T - 1] - kappa[0]) / (T - 1)
  let s2 = 0
  for (let t = 1; t < T; t++) {
    const e = kappa[t] - kappa[t - 1] - drift
    s2 += e * e
  }
  const sigma = Math.sqrt(s2 / (T - 2))
  return {
    alpha: alpha.map((v) => +v.toFixed(6)),
    beta: beta.map((v) => +v.toFixed(8)),
    kappa: kappa.map((v) => +v.toFixed(4)),
    drift: +drift.toFixed(6),
    sigma: +sigma.toFixed(6),
  }
}

function extractLeeCarter(wb) {
  const FROM = 1962
  const TO = 2021 // last observed year (2022+ are projections → would understate volatility)
  // Drop years whose column is empty in the workbook (q at a reliable mid age == 0).
  const dropEmpty = (m) => {
    const keep = m.M.map((row) => row[50] > 0)
    return { years: m.years.filter((_, i) => keep[i]), M: m.M.filter((_, i) => keep[i]) }
  }
  const hH = dropEmpty(matrixRange(wb.Sheets.hyp_mortaliteH, (v) => v / 1e5, FROM, TO))
  const hF = dropEmpty(matrixRange(wb.Sheets.hyp_mortaliteF, (v) => v / 1e5, FROM, TO))
  return {
    meta: {
      source: 'Lee-Carter fit on INSEE qx (scénario central), années observées 1962-2021',
      fitYears: [FROM, TO],
      note: 'β (sensibilité par âge) + σ (volatilité des innovations de κ) servent à perturber les qx AUTOUR du central calé. fertilitySigma/migrationSigma sont des hypothèses ajustées à la main (pas de fit INSEE propre).',
      retrieved: RETRIEVED,
    },
    ages: Array.from({ length: OMEGA + 1 }, (_, a) => a),
    H: fitLeeCarter(hH.M, hH.years),
    F: fitLeeCarter(hF.M, hF.years),
    assumptions: { fertilitySigma: 0.012, migrationSigma: 0.05, defaultDraws: 300 },
  }
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

      const lc = extractLeeCarter(wb)
      writeFileSync(join(OUT, 'leeCarter.json'), JSON.stringify(lc))
      console.log(`  leeCarter: drift H ${lc.H.drift} F ${lc.F.drift} · σ H ${lc.H.sigma} F ${lc.F.sigma}`)
    }
  }
  writeFileSync(join(OUT, 'insee-manifest.json'), JSON.stringify(manifest, null, 2))
  console.log('done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

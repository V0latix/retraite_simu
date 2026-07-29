// Ingests the OBSERVED (historical) counterparts of everything the app projects,
// so every chart can show "passé observé" before "futur projeté". Dev-only, re-runnable.
//
//   node scripts/ingest-historical.mjs
//
// Sources:
//   INSEE POP3 — population au 1er janvier par sexe et âge détaillé (1901→2025)
//     https://www.insee.fr/fr/statistiques/8560651 (3_Pop1janv_age.xlsx)
//   COR — Rapport annuel juin 2025, fichiers sources des figures
//     https://www.cor-retraites.fr/rapports-du-cor/rapport-annuel-cor-juin-2025-evolutions-perspectives-retraites-france
import XLSX from 'xlsx'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data')
const CACHE = join(__dirname, '.cache')

const OMEGA = 105 // terminal age, matches the engine
// Le régime général de retraite naît des ordonnances des 4 et 19 octobre 1945.
const PYRAMID_FROM = 1946
const PYRAMID_TO = 2025
const RETRIEVED = new Date().toISOString().slice(0, 10)

const COR = 'https://www.cor-retraites.fr/sites/default/files'
const SOURCES = {
  'pop3.xlsx': 'https://www.insee.fr/fr/statistiques/fichier/8560651/3_Pop1janv_age.xlsx',
  'cor_synthese.xlsx': `${COR}/2025-06/Donn%C3%A9es_RA2025_Synth%C3%A8se.xlsx`,
  'cor_p1.xlsx': `${COR}/2025-06/Donn%C3%A9es_RA2025_P1.xlsx`,
  'cor_p2.xlsx': `${COR}/2025-06/Donn%C3%A9es_RA2025_P2_2.xlsx`,
  'cor_complementaires.xlsx': `${COR}/2025-06/Donn%C3%A9es_compl%C3%A9mentaires_RA2025.xlsx`,
}

async function fetchFile(name, url) {
  const dest = join(CACHE, name)
  if (existsSync(dest)) return dest
  mkdirSync(CACHE, { recursive: true })
  process.stdout.write(`  downloading ${name}… `)
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
  console.log('ok')
  return dest
}

const rowsOf = (ws) => XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
const round = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null)

// ---------------------------------------------------------------- COR sheets

/** COR figure sheets carry one header row whose cells are the years. */
function yearHeader(rows) {
  const header = rows.find((r) => r.filter((c) => typeof c === 'number' && c > 1900 && c < 2100).length > 10)
  if (!header) throw new Error('no year header')
  return header
}

function valuesByYear(header, row) {
  const out = new Map()
  header.forEach((y, col) => {
    if (typeof y !== 'number' || y < 1900) return
    const v = row[col]
    if (typeof v === 'number' && Number.isFinite(v)) out.set(y, v)
  })
  return out
}

const labelOf = (row) => String(row?.[1] ?? '').replace(/\s+/g, ' ')

/**
 * Most COR sheets stack, under a label row, one row per variant tagged in the 3rd
 * column: "Obs" = observed, "Sc. Ref" = projected. Returns the observed values.
 */
function corObserved(ws, label) {
  const rows = rowsOf(ws)
  const match = rows.findIndex((r) => labelOf(r).includes(label))
  if (match < 0) throw new Error(`row "${label}" not found`)
  // The "Obs" tag sits either on the label row itself or on one of the rows just below.
  const obs = [match, match + 1, match + 2].find((i) => String(rows[i]?.[2] ?? '').trim() === 'Obs')
  if (obs == null) throw new Error(`no "Obs" row under "${label}"`)
  return valuesByYear(yearHeader(rows), rows[obs])
}

/** Fig 1.5 has no "Obs" tag: the observed row is named outright. */
function corRowByLabel(ws, label) {
  const rows = rowsOf(ws)
  const row = rows.find((r) => labelOf(r).includes(label))
  if (!row) throw new Error(`row "${label}" not found`)
  return valuesByYear(yearHeader(rows), row)
}

function extractFinance(synth, comp) {
  const cotisantsSheet = comp.Sheets['Cotisants_Retraités']
  const series = {
    depensesPctGdp: corObserved(synth.Sheets['Dépenses en %'], 'Dépenses, en % du PIB'),
    resourcesPctGdp: corObserved(synth.Sheets['Ressources en %'], 'Ressources, en % du PIB'),
    soldePctGdp: corObserved(synth.Sheets['Solde en %'], 'Convention EPR'),
    activePerRetiree: corObserved(cotisantsSheet, 'Rapport cotisants / retraités'),
    contributors: corObserved(cotisantsSheet, 'Nombre de cotisants en millions'),
    retirees: corObserved(cotisantsSheet, 'Nombre de retraités (tous retraités) en millions'),
    gdp: corObserved(comp.Sheets['PIB'], 'PIB en valeur'),
  }
  // The retirees count lags a year behind the rest: keep the union and leave holes
  // as null rather than truncating every other series to the shortest one.
  const years = [...new Set(Object.values(series).flatMap((m) => [...m.keys()]))].sort((a, b) => a - b)
  const pick = (m, d, scale = 1) => years.map((y) => (m.has(y) ? round(m.get(y) * scale, d) : null))

  return {
    years,
    depensesPctGdp: pick(series.depensesPctGdp, 5),
    resourcesPctGdp: pick(series.resourcesPctGdp, 5),
    soldePctGdp: pick(series.soldePctGdp, 5),
    activePerRetiree: pick(series.activePerRetiree, 4),
    contributors: pick(series.contributors, 0, 1e6),
    retirees: pick(series.retirees, 0, 1e6),
    gdp: pick(series.gdp, 1), // Md€ courants
    _gdpByYear: series.gdp,
  }
}

/**
 * Onglet Rému_pensions — montants mensuels en euros 2023 constants. Trois libellés commencent par
 * « Pension … moyenne » et deux par « Rémunération brute moyenne des cotisants » : `corObserved`
 * fait du substring et prend le PREMIER, d'où les libellés complets ci-dessous (ensemble des
 * retraités plutôt que « vivant en France », cotisants hors correction activité partielle).
 */
function extractPensions(comp) {
  const ws = comp.Sheets['Rému_pensions']
  const pension = corObserved(ws, "Pension brute moyenne de l'ensemble des retraités")
  const remu = corObserved(ws, 'Rémunération brute moyenne des cotisants (euros 2023)')
  const years = [...new Set([...pension.keys(), ...remu.keys()])].sort((a, b) => a - b)
  const pick = (m) => years.map((y) => (m.has(y) ? round(m.get(y), 0) : null))
  return { years, pensionBruteMoyenne: pick(pension), remuBruteMoyenne: pick(remu) }
}

/** Tab 2.3 — réserves financières des régimes en répartition au 31/12/2024. */
function extractAnchors(p2, finance) {
  const rows = rowsOf(p2.Sheets['Tab 2.3'])
  const cell = (label) => rows.find((r) => String(r[1] ?? '').trim().startsWith(label))?.[2]
  const reserves = cell('Total des réserves')
  const frr = cell('FRR')
  if (!(reserves > 0) || !(frr > 0)) throw new Error('Tab 2.3: réserves introuvables')
  const gdp2024 = finance._gdpByYear.get(2024)
  if (!(gdp2024 > 0)) throw new Error('PIB 2024 introuvable')
  return {
    reserves2024: round(reserves, 2),
    frr2024: round(frr, 2),
    gdp2024: round(gdp2024, 1),
    reservesPctGdp: round(reserves / gdp2024, 5),
  }
}

// ------------------------------------------------------------- INSEE POP3

/**
 * One sheet per year. Columns: [année de naissance, âge, métropole(E,H,F), France(E,H,F)].
 * "France" columns only exist from 1991; before that only France métropolitaine is
 * published — we record the champ per year rather than splicing two populations.
 * Old sheets stop at "100 ou plus", recent ones at "105 ou plus": the open group is
 * folded into its own age slot, so a 1946 pyramid tops out at 100 by construction.
 */
function extractPyramidYear(ws) {
  const rows = rowsOf(ws)
  const h = rows.findIndex((r) => String(r[1] ?? '').includes('Âge'))
  if (h < 0) throw new Error('no header row')
  const hasFrance = rows[h].length >= 8
  const [ch, cf] = hasFrance ? [6, 7] : [3, 4]

  const H = new Array(OMEGA + 1).fill(0)
  const F = new Array(OMEGA + 1).fill(0)
  for (let r = h + 1; r < rows.length; r++) {
    const raw = String(rows[r][1] ?? '').trim()
    if (!raw) continue
    const age = parseInt(raw, 10) // "105 ou plus" → 105
    if (!Number.isInteger(age) || age < 0 || age > OMEGA) continue
    H[age] = Math.round(rows[r][ch] ?? 0)
    F[age] = Math.round(rows[r][cf] ?? 0)
  }
  const total = H.reduce((s, v) => s + v, 0) + F.reduce((s, v) => s + v, 0)
  if (total < 3e7) throw new Error(`implausible total ${total}`)
  return { H, F, champ: hasFrance ? 'France' : 'France métropolitaine' }
}

function extractPyramids(wb) {
  const years = []
  const H = []
  const F = []
  const champ = {}
  for (let y = PYRAMID_FROM; y <= PYRAMID_TO; y++) {
    const ws = wb.Sheets[String(y)]
    if (!ws) continue // INSEE publishes no estimate for 1915-1919
    const p = extractPyramidYear(ws)
    years.push(y)
    H.push(p.H)
    F.push(p.F)
    champ[y] = p.champ
  }
  return { years, H, F, champ }
}

/** Part des 65 ans et plus. France entière only (1991+), to avoid a champ break mid-curve. */
function share65(pyr) {
  const years = []
  const values = []
  pyr.years.forEach((y, i) => {
    if (pyr.champ[y] !== 'France') return
    let tot = 0
    let old = 0
    for (let a = 0; a <= OMEGA; a++) {
      const n = pyr.H[i][a] + pyr.F[i][a]
      tot += n
      if (a >= 65) old += n
    }
    years.push(y)
    values.push(round(old / tot, 5))
  })
  return { years, values }
}

async function main() {
  const paths = {}
  for (const [name, url] of Object.entries(SOURCES)) paths[name] = await fetchFile(name, url)

  const synth = XLSX.readFile(paths['cor_synthese.xlsx'])
  const p1 = XLSX.readFile(paths['cor_p1.xlsx'])
  const p2 = XLSX.readFile(paths['cor_p2.xlsx'])
  const comp = XLSX.readFile(paths['cor_complementaires.xlsx'])
  const pop3 = XLSX.readFile(paths['pop3.xlsx'])

  const financeRaw = extractFinance(synth, comp)
  const anchors = extractAnchors(p2, financeRaw)
  const { _gdpByYear, ...finance } = financeRaw
  const ratio = corRowByLabel(p1.Sheets['Fig 1.5'], 'bilan démographique 2024 - observé')
  const ratioYears = [...ratio.keys()].sort((a, b) => a - b)
  const pyr = extractPyramids(pop3)

  const historical = {
    meta: {
      source: 'COR — Rapport annuel juin 2025 (fichiers sources) · INSEE — POP3',
      note: "Séries observées, à opposer aux projections du modèle. Le solde suit la convention EPR du COR (ensemble des régimes légalement obligatoires, FSV inclus, hors RAFP).",
      retrieved: RETRIEVED,
    },
    lastObserved: finance.years[finance.years.length - 1],
    finance,
    pensions: extractPensions(comp),
    demography: {
      years: ratioYears,
      ratio2064over65: ratioYears.map((y) => round(ratio.get(y), 4)),
      share65: share65(pyr),
    },
    anchors,
    _sources: {
      finance: 'COR juin 2025, Données_RA2025_Synthèse.xlsx (lignes « Obs ») et Données_complémentaires_RA2025.xlsx',
      pensions:
        'COR juin 2025, Données_complémentaires_RA2025.xlsx, onglet Rému_pensions (lignes « Obs ») — pension brute moyenne de l’ensemble des retraités et rémunération brute moyenne des cotisants, en euros 2023 par mois. Champ : ensemble des régimes légalement obligatoires, FSV inclus, hors RAFP.',
      anchors: 'COR juin 2025, Données_RA2025_P2_2.xlsx, Tableau 2.3 — réserves en valeur de marché au 31/12/2024',
      demography: 'COR juin 2025, Données_RA2025_P1.xlsx, Figure 1.5 · part des 65+ calculée depuis INSEE POP3',
      pyramid: 'INSEE, POP3 — Population au 1er janvier par sexe et âge détaillé (recensements et estimations)',
    },
  }
  // historical.json porte aussi des blocs saisis à la main que ce script ne sait pas produire
  // (fécondité / migration / chômage observés, inflation INSEE, réserves du FRR). Écraser le
  // fichier les effacerait silencieusement : on fusionne, l'ingéré gagne clé à clé.
  const previous = existsSync(join(OUT, 'historical.json'))
    ? JSON.parse(readFileSync(join(OUT, 'historical.json'), 'utf8'))
    : {}
  const merged = {
    ...previous,
    ...historical,
    demography: { ...previous.demography, ...historical.demography },
    _sources: { ...previous._sources, ...historical._sources },
  }
  writeFileSync(join(OUT, 'historical.json'), JSON.stringify(merged))

  const pyramid = {
    meta: {
      source: 'INSEE — POP3, population au 1er janvier par sexe et âge détaillé',
      url: 'https://www.insee.fr/fr/statistiques/8560651',
      note: "Champ « France métropolitaine » jusqu'en 1990, « France » à partir de 1991. Les années anciennes s'arrêtent au groupe ouvert « 100 ans et plus ».",
      retrieved: RETRIEVED,
    },
    ages: Array.from({ length: OMEGA + 1 }, (_, a) => a),
    ...pyr,
  }
  writeFileSync(join(OUT, 'historicalPyramid.json'), JSON.stringify(pyramid))

  console.log(`  finance:   ${finance.years[0]}–${finance.years.at(-1)} (solde ${finance.years.at(-1)} = ${finance.soldePctGdp.at(-1)})`)
  console.log(`  anchors:   réserves ${anchors.reserves2024} Md€ = ${(anchors.reservesPctGdp * 100).toFixed(1)} % PIB`)
  console.log(`  ratio:     ${historical.demography.years[0]}–${historical.demography.years.at(-1)}`)
  console.log(`  pyramides: ${pyr.years.length} années (${pyr.years[0]}–${pyr.years.at(-1)})`)
  console.log('done.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

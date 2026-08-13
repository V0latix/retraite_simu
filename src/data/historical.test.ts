import { describe, expect, it } from 'vitest'
import { historical, historicalPyramid, LAST_OBSERVED_YEAR } from './loader'
import {
  JOBSEEKER_UNEMPLOYMENT_CATEGORIES,
  JOBSEEKER_WEIGHTS,
  SCENARIO_PRESETS,
  jobseekerRate,
  jobseekerRateByYear,
  jobseekerUnemploymentRate,
  jobseekerUnemploymentRateByYear,
} from './scenarioPresets'

const strictlyIncreasing = (ys: readonly number[]) => ys.every((y, i) => i === 0 || y > ys[i - 1])

describe('historical.json', () => {
  const { finance, demography, anchors } = historical

  it('carries contiguous, strictly increasing years', () => {
    expect(strictlyIncreasing(finance.years)).toBe(true)
    expect(strictlyIncreasing(demography.years)).toBe(true)
    expect(finance.years[0]).toBe(2002)
    expect(LAST_OBSERVED_YEAR).toBe(finance.years.at(-1))
  })

  it('has no NaN and keeps every series aligned with its year axis', () => {
    for (const [key, arr] of Object.entries(finance)) {
      if (key === 'years') continue
      expect(arr).toHaveLength(finance.years.length)
      for (const v of arr as (number | null)[]) expect(v === null || Number.isFinite(v)).toBe(true)
    }
  })

  it('reproduces the balance the COR publishes for 2024 (−0,1 % PIB)', () => {
    const i = finance.years.indexOf(2024)
    expect(finance.soldePctGdp[i]).toBeCloseTo(-0.0006, 4)
    // Dépenses ≈ 13,9 % PIB, the anchor the finance block is calibrated against.
    expect(finance.depensesPctGdp[i]).toBeCloseTo(0.139, 2)
  })

  it('keeps solde = ressources − dépenses', () => {
    finance.years.forEach((_, i) => {
      const [d, r, s] = [finance.depensesPctGdp[i], finance.resourcesPctGdp[i], finance.soldePctGdp[i]]
      if (d == null || r == null || s == null) return
      expect(r - d).toBeCloseTo(s, 4)
    })
  })

  it('anchors the cumulative-balance chart on published reserves', () => {
    expect(anchors.reserves2024).toBeGreaterThan(0)
    expect(anchors.gdp2024).toBeGreaterThan(2000)
    expect(anchors.reservesPctGdp).toBeCloseTo(anchors.reserves2024 / anchors.gdp2024, 5)
  })

  it('carries the observed fertility série ending below the 1,8 INSEE assumption', () => {
    const { years, icf } = demography.fertility
    expect(years).toHaveLength(icf.length)
    expect(strictlyIncreasing(years)).toBe(true)
    expect(years.at(-1)).toBe(2025)
    expect(icf.at(-1)).toBeCloseTo(1.53, 2) // 2025, France métropolitaine (INSEE)
    expect(Math.max(...icf)).toBeLessThan(2.1) // stays below génération-renewal threshold
    for (const v of icf) expect(Number.isFinite(v)).toBe(true)
  })

  it('carries the observed net migration série, recent years above the +70k INSEE assumption', () => {
    const { years, solde } = demography.migration
    expect(years).toHaveLength(solde.length)
    expect(strictlyIncreasing(years)).toBe(true)
    expect(years.at(-1)).toBe(2025)
    for (const v of solde) {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0) // net migration stayed positive every year
      expect(v).toBeLessThan(400000) // sane upper bound (2022 Ukraine peak ≈ 271k)
    }
    // Recent observed solde runs above the +70k the INSEE projections assume.
    for (const [i, y] of years.entries()) if (y >= 2020) expect(solde[i]).toBeGreaterThan(70000)
  })

  it('carries the observed unemployment série (BIT), a rate in ]0,1[', () => {
    const { years, rate } = demography.unemployment
    expect(years).toHaveLength(rate.length)
    expect(strictlyIncreasing(years)).toBe(true)
    expect(rate.at(-1)).toBeCloseTo(0.074, 3) // 2024, INSEE
    expect(Math.max(...rate)).toBeGreaterThan(0.1) // the 2013-2015 peak
    for (const v of rate) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('carries the France Travail A→G headcounts, aligned and summing to the published total', () => {
    const j = historical.jobseekers
    expect(j.periods[0]).toBe('1996T1')
    expect(strictlyIncreasing(j.periods.map((p) => Number(p.replace('T', '.'))))).toBe(true)
    for (const cat of [j.a, j.b, j.c, j.d, j.e, j.f, j.g]) {
      expect(cat).toHaveLength(j.periods.length)
      for (const v of cat) expect(v).toBeGreaterThanOrEqual(0)
    }
    // F et G ne naissent qu'avec la loi plein emploi : nulles avant, peuplées après. La série
    // n'est donc pas homogène de part et d'autre — c'est la marche que l'UI doit expliquer.
    const born = j.periods.indexOf('2025T1')
    for (const cat of [j.f, j.g]) {
      expect(cat.slice(0, born).every((v) => v === 0)).toBe(true)
      expect(cat.slice(born).every((v) => v > 0)).toBe(true)
    }
    for (const cat of [j.a, j.b, j.c, j.d, j.e]) expect(Math.min(...cat)).toBeGreaterThan(0)
    // Total A→G publié au 2025T1 : 7 409 100 (arrondi à la centaine près par la Dares).
    const t0 = [j.a, j.b, j.c, j.d, j.e, j.f, j.g].reduce((s, cat) => s + cat[born], 0)
    expect(t0).toBeCloseTo(7_409_100, -3)
    // Le taux qui en découle est bien la mesure large, pas le BIT — mais pondéré : la somme
    // brute rapportée à la même base donnerait ~22,8 %, la pondération doit mordre.
    expect(jobseekerRate()).toBeGreaterThan(0.13)
    expect(jobseekerRate()).toBeLessThan(0.2)
    const raw = [j.a, j.b, j.c, j.d, j.e, j.f, j.g].reduce((s, cat) => s + cat.slice(-4).reduce((x, v) => x + v, 0), 0)
    const weighted = (Object.keys(JOBSEEKER_WEIGHTS) as (keyof typeof JOBSEEKER_WEIGHTS)[]).reduce(
      (s, k) => s + JOBSEEKER_WEIGHTS[k] * historical.jobseekers[k].slice(-4).reduce((x, v) => x + v, 0),
      0,
    )
    expect(weighted / raw).toBeCloseTo(0.73, 2) // 5,5 M d'équivalents sur 7,5 M d'inscrits
    // Ancrage dur : l'ajout de l'historique 1996-2024 ne doit RIEN changer à l'hypothèse du
    // Pragmatique, qui reste la moyenne des 4 derniers trimestres sur les actifs de 2025.
    expect(jobseekerRate()).toBeCloseTo(0.1661, 4)
    expect(SCENARIO_PRESETS.pragmatique.unemployment).toBe(jobseekerRate())
    expect(SCENARIO_PRESETS.central.unemployment).toBe(0.07) // la référence COR ne bouge pas

    // Le chômage affiché est volontairement plus étroit que l'effet total sur les cotisations :
    // A+D seulement. B/C/E/F/G restent dans la simulation selon leur situation, sans être nommés
    // « chômeurs ».
    expect(JOBSEEKER_UNEMPLOYMENT_CATEGORIES).toEqual(['a', 'd'])
    expect(jobseekerUnemploymentRate()).toBeGreaterThan(0.1)
    expect(jobseekerUnemploymentRate()).toBeLessThan(jobseekerRate())
  })

  it('derives the observed France Travail rate year by year, break included', () => {
    const { years, rate } = jobseekerRateByYear()
    expect(years).toHaveLength(rate.length)
    expect(strictlyIncreasing(years)).toBe(true)
    expect(years[0]).toBe(1996)
    expect(years.at(-1)).toBe(2025) // 2026 est incomplet (2 trimestres) et hors pyramide observée
    for (const v of rate) {
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThan(0.25)
    }
    const at = (y: number) => rate[years.indexOf(y)]
    expect(at(2025)).toBeCloseTo(0.164, 3)
    // L'entrée de F et G en janvier 2025 : un changement de périmètre, pas du marché du travail.
    expect(at(2025) - at(2024)).toBeGreaterThan(0.03)
    // Le dernier point observé et l'hypothèse projetée décrivent bien la même mesure.
    expect(at(2025)).toBeCloseTo(jobseekerRate(), 2)
  })

  it('separates chômage administratif A+D from the broader retirement contribution effect', () => {
    const unemployment = jobseekerUnemploymentRateByYear()
    const total = jobseekerRateByYear()
    expect(unemployment.years).toEqual(total.years)
    for (const [i, rate] of unemployment.rate.entries()) {
      expect(rate).toBeGreaterThan(0)
      expect(rate).toBeLessThan(total.rate[i])
    }
  })

  it('shows the 65+ share rising over the observed period', () => {
    const { values } = demography.share65
    expect(values[0]).toBeGreaterThan(0.1)
    expect(values.at(-1)).toBeGreaterThan(values[0])
    expect(values.at(-1)).toBeLessThan(0.3)
  })
})

describe('historicalPyramid.json', () => {
  const total = (i: number) =>
    historicalPyramid.H[i].reduce((s, v) => s + v, 0) + historicalPyramid.F[i].reduce((s, v) => s + v, 0)

  it('spans 1946 (création du régime général) to 2025 with no gap', () => {
    expect(historicalPyramid.years[0]).toBe(1946)
    expect(historicalPyramid.years.at(-1)).toBe(2025)
    expect(strictlyIncreasing(historicalPyramid.years)).toBe(true)
    expect(historicalPyramid.years).toHaveLength(2025 - 1946 + 1)
  })

  it('matches the population INSEE publishes for 2025', () => {
    const i = historicalPyramid.years.indexOf(2025)
    expect(total(i)).toBe(68_605_616) // POP3, France
    expect(historicalPyramid.champ['2025']).toBe('France')
  })

  it('labels the champ break at 1991 rather than splicing two populations', () => {
    expect(historicalPyramid.champ['1990']).toBe('France métropolitaine')
    expect(historicalPyramid.champ['1991']).toBe('France')
  })

  it('grows from ~40M in 1946, every age bucket non-negative', () => {
    expect(total(0)).toBeGreaterThan(3.9e7)
    expect(total(0)).toBeLessThan(4.1e7)
    for (const row of [...historicalPyramid.H, ...historicalPyramid.F]) {
      expect(row).toHaveLength(106) // ages 0..OMEGA
      for (const v of row) expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})

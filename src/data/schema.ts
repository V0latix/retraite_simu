// Types for the strict versioned JSON produced by scripts/ingest-insee.mjs (§8.2).

export interface DataMeta {
  source: string
  inseeId: number
  scenario: string
  retrieved: string
}

/** Per-scenario demographic trajectories. Matrices are [yearIndex][age]. */
export interface ScenarioData {
  meta: DataMeta
  years: number[] // BASE_YEAR..2070
  ages: number[] // 0..105
  mortality: { H: number[][]; F: number[][] } // qx, probability in [0,1)
  fertility: number[][] // rate per woman, nonzero ages 15..50
  migration: { H: number[][]; F: number[][] } // net headcount by age
  /** Optional one-off unemployment shock: a triangular bump added to the base rate, rising
   *  from `from` to `peak`, back to base by `to`. Peak height lives in the loader (flagged).
   *  Set by the derived « Choc récession » scenario. */
  unemploymentShock?: { from: number; peak: number; to: number }
}

export interface InitialPyramid {
  meta: { source: string; inseeId: number; year: number; retrieved: string }
  ages: number[]
  H: number[]
  F: number[]
}

/** Extrapolation policy for years beyond the published data (§7). */
export type BeyondDataPolicy = 'hold' | 'trend' | 'converge'

/** Lee-Carter fit + stochastic assumptions (§6.3). */
export interface LeeCarterSex {
  alpha: number[] // α_a, log baseline mortality by age
  beta: number[] // β_a, age sensitivity (Σβ = 1)
  kappa: number[] // κ_t, historical time index
  drift: number // annual drift of κ
  sigma: number // std of κ innovations
}
export interface LeeCarterFit {
  meta: { source: string; fitYears: [number, number]; note: string; retrieved: string }
  ages: number[]
  H: LeeCarterSex
  F: LeeCarterSex
  assumptions: { fertilitySigma: number; migrationSigma: number; defaultDraws: number }
}

/**
 * Observed (historical) counterparts of the projected series, so every chart can
 * show "passé observé" before "futur projeté". Produced by scripts/ingest-historical.mjs.
 * Holes are `null`: the retirees headcount lags a year behind the other COR series.
 */
export interface HistoricalData {
  meta: { source: string; note: string; retrieved: string }
  /** Last year with observed finance data — the frontier between observed and projected. */
  lastObserved: number
  finance: {
    years: number[]
    depensesPctGdp: (number | null)[]
    resourcesPctGdp: (number | null)[]
    soldePctGdp: (number | null)[]
    activePerRetiree: (number | null)[]
    contributors: (number | null)[]
    retirees: (number | null)[]
    gdp: (number | null)[] // Md€ courants
  }
  /** Montants mensuels observés, en euros 2023 constants (COR, onglet Rému_pensions).
   *  La pension s'arrête un an avant la rémunération : les trous sont `null`. */
  pensions: {
    years: number[]
    pensionBruteMoyenne: (number | null)[]
    remuBruteMoyenne: (number | null)[]
  }
  demography: {
    years: number[]
    ratio2064over65: (number | null)[]
    share65: { years: number[]; values: number[] }
    /** Observed total fertility rate (ICF), France métropolitaine — contrasts with the
     *  flat 1.8 the INSEE scenarios assume. */
    fertility: { years: number[]; icf: number[] }
    /** Observed net migration (solde migratoire), INSEE Bilan démographique — contrasts
     *  with the +70k/an the INSEE projections assume. Persons/year. */
    migration: { years: number[]; solde: number[] }
    /** Observed unemployment rate (taux de chômage BIT, moyenne annuelle), fraction —
     *  contrasts with the flat 7 % the model assumes. */
    unemployment: { years: number[]; rate: number[] }
  }
  /** Inscrits à France Travail par catégorie, effectifs bruts trimestriels (STMT).
   *  Une mesure bien plus large que le chômage BIT — c'est celle du scénario Pragmatique.
   *  A→E remontent à 1996T1 ; F et G, créées en janvier 2025 par la loi plein emploi, valent 0
   *  avant — la série n'est donc pas homogène de part et d'autre de 2025. */
  jobseekers: {
    periods: string[] // « 1996T1 », …
    a: number[]
    b: number[]
    c: number[]
    d: number[]
    e: number[]
    f: number[]
    g: number[]
  }
  /** Observed inflation (INSEE IPC, moyenne annuelle), fraction. Display only — the model
   *  runs in constant euros, so inflation is neutralised by construction and never read. */
  economy: { inflation: { years: number[]; rate: number[] } }
  /** Observed FRR (Fonds de réserve pour les retraites) trajectory, Md€ valeur de marché.
   *  A dedicated, shrinking fund — distinct from the system's total reserves (anchors). */
  reserves: { frr: { years: number[]; valueMdEur: number[] } }
  /** Published levels used to anchor the cumulative-balance chart (COR Tab 2.3). */
  anchors: { reserves2024: number; frr2024: number; gdp2024: number; reservesPctGdp: number }
}

/** Observed pyramids, 1946 (création du régime général) → 2025. Matrices are [yearIndex][age]. */
export interface HistoricalPyramid {
  meta: { source: string; url: string; note: string; retrieved: string }
  ages: number[]
  years: number[]
  H: number[][]
  F: number[][]
  /** "France métropolitaine" before 1991, "France" after — the champ changes, so we label it. */
  champ: Record<string, string>
}

/** Published DREES/COR indicators used as reference/context (§4 TODO). Not model outputs:
 *  niveau de vie relatif & taux de pauvreté aren't modelled, only shown as context; the taux
 *  de remplacement moyen is the one figure comparable to the micro cas-types. */
export interface ReferenceIndicators {
  meta: { source: string; urls: { drees: string; cor: string }; note: string; retrieved: string }
  niveauDeVieRelatif: {
    unit: string
    observed: { year: number; value: number }[]
    projected: { year: number; value: number }[]
  }
  tauxRemplacementMoyen: { value2024: number; note: string }
  drees2023: {
    pensionBruteMoyenne: number
    pensionNetteMoyenne: number
    pensionAvecReversion: number
    niveauVieMedianRetraites: number
    tauxPauvreteRetraites: number
    tauxPauvretePopulation: number
    decileTop10NiveauVie: number
    decileBottom10NiveauVie: number
    ecartPensionFemmesHommes: number
  }
}

/** OCDE Pensions at a Glance — France vs Europe cross-country reference (§4 TODO). */
export interface OecdComparison {
  meta: { source: string; url: string; note: string; retrieved: string }
  unit: { netReplacementRate: string; publicPensionExpenditurePctGdp: string; effectiveExitAge: string }
  countries: {
    code: string
    name: string
    netReplacementRate: number
    publicPensionExpenditurePctGdp: number
    effectiveExitAge: number
    highlight: boolean
  }[]
}

/** COR reference trajectory for the validation view (§8.3). */
export interface CorReference {
  meta: { source: string; url: string; assumptions: string; note: string; retrieved: string }
  unit: string
  points: { year: number; depensesPctGdp: number; ressourcesPctGdp: number; soldePctGdp: number }[]
}

// Only scenarios that differ by their *data* remain. The old INSEE variants (fécondité,
// migration, EV, productivité COR) were each a single hypothesis moved: they are now slider
// positions, carried by SCENARIO_PRESETS. Their JSON files stay in scenarios/ (lazily globbed,
// regenerated by the ingest script) — a future life-expectancy slider interpolates them.
export const SCENARIO_IDS = ['central', 'pragmatique', 'choc-recession'] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  central: 'Central (INSEE / COR)',
  pragmatique: 'Pragmatique (tendances observées)',
  'choc-recession': 'Choc récession (chômage +3 pts)',
}

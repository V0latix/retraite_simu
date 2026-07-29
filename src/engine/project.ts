// The single projection entry point (cahier des charges §3, §6.1).
// Signature is identical in deterministic and stochastic mode:
//   project(state0, hypothesisSet, horizon) => TimeSeries
import { dependencyDemographic, stepDemography } from './demography'
import { periodLifeExpectancy } from './micro/coupling'
import { OMEGA, type HypothesisSet, type PopulationState, type TimeSeries } from './types'

// ponytail: economy + pension-system math lives inline here for Phase 1/2.
// Split into economy.ts / pensionSystem.ts when the finance block grows past a screenful.

/**
 * Absolute money seeds + COR calibration — supplied from data (systemParams.json),
 * not hard-coded. Everything runs in constant (real, base-year) euros.
 */
export interface EconInit {
  avgAnnualWage: number
  avgAnnualPension: number
  priceInflation: number
  // Calibration to the COR reference (see corReference.json).
  depensesShareBase: number // pension mass / GDP at the base year (≈ 0.139)
  soldeShareBase: number // solde / GDP at the base year (≈ -0.001)
  resources2070Share: number // total resources / GDP target by 2070 (≈ 0.128)
  pensionDriftShare: number // noria drift of avg pension as a share of productivity
  /** Behavioural elasticity (0-1, approximate) turning extra required quarters into
   *  effective working years: +4 quarters over `quartersRef` ⇒ +share year of exit age.
   *  <1 because not everyone works longer — some retire on time with a décote. */
  quartersAgeShare: number
  /** Reference required quarters (the base-config value the shift anchors to, so the
   *  reference scenario is unshifted and the COR calibration stays intact). */
  quartersRef: number
  /** Share (0-1) of a legal-age move that actually converts into the retiree→contributor
   *  reclassification. The raw mechanism assumes everyone exits the day they become eligible
   *  and immediately holds a job — an upper bound (OFCE flags the same one). In reality much
   *  of the band was already inactive without being retired, part was already working past the
   *  age, and early-exit routes exempt a chunk of departures. Calibrated on the published
   *  estimates of the 2023 reform (see systemParams `_sources`). */
  legalAgeEffectiveness: number
  /** Reference legal age the effectiveness damping anchors to: at this age the deviation is
   *  zero, so the COR calibration is untouched (same trick as quartersRef). */
  legalAgeRef: number
  /** Distribution des pensions par décile, en ratio à la moyenne (Σ = 10, une valeur par
   *  dixième de la population retraitée). Sert uniquement au levier `pensionCap` : sans
   *  plafond elle n'est jamais lue, la trajectoire de référence est donc inchangée.
   *  Donnée, jamais en dur — voir pensionDistribution.json. */
  pensionDeciles: number[]
  /** Pension brute moyenne OBSERVÉE à l'année de base, en €/mois. Sert d'échelle au plafond,
   *  qui est en euros réels : `benefits / retirees` ne convient pas (le modèle compte plus de
   *  retraités que le champ administratif, et hérite du multiplicateur de calage COR), et
   *  `avgAnnualPension` fixe l'échelle interne du bloc finance, pas un montant de pension
   *  comparable. On projette ce niveau observé avec la dynamique du modèle. */
  avgPensionObservedMonthly: number
  /**
   * Optional per-year COR calibration (built in loader.ts from corReference.json).
   * When present, it pins the CENTRAL scenario's dépenses and resources to the COR EEC
   * trajectory at every horizon (not just the endpoints), so the reference solde tracks
   * COR across 2025-2070. Other scenarios and reform levers keep the same calibration and
   * deviate from it through their own demography/contributions — sensitivity is preserved.
   * `depMul` scales benefits; `otherResPct` replaces the linear resource taper. Indexed by
   * `year - baseYear`, clamped past the last entry.
   */
  calibration?: { baseYear: number; depMul: number[]; otherResPct: number[] }
}
const DEFAULT_ECON: EconInit = {
  avgAnnualWage: 40000,
  avgAnnualPension: 16800,
  priceInflation: 0.018,
  depensesShareBase: 0.139,
  soldeShareBase: -0.001,
  resources2070Share: 0.128,
  pensionDriftShare: 0.22,
  quartersAgeShare: 0.5,
  quartersRef: 172,
  legalAgeEffectiveness: 0.26,
  legalAgeRef: 64,
  pensionDeciles: [0.263, 0.447, 0.579, 0.7, 0.815, 0.936, 1.078, 1.262, 1.552, 2.368],
  avgPensionObservedMonthly: 1770,
}

// ponytail: carrières longues départ age fixed at 60 (RN « 60 ans si commencé avant 20 »).
// Move to systemParams if a second early-exit age is ever needed.
const EARLY_RETIREMENT_AGE = 60

/** Share of an age-year cohort already past a (possibly fractional) retirement age. Real reforms
 *  move the age by quarters — 62,75 means a quarter of the age-62 cohort has already left. At an
 *  integer age this is exactly the old 0/1 step, so the COR calibration is untouched. */
function retiredWeight(age: number, retireAge: number): number {
  return Math.min(1, Math.max(0, age + 1 - retireAge))
}

/** Retirees = everyone at/above the effective retirement age **de sa génération**, plus an
 *  optional share of the [60, legalAge) band leaving early (carrières longues, §3.2).
 *  `effAge[a]` = âge effectif de sortie de la génération qui a l'âge `a` cette année-là. */
function retirees(state: PopulationState, effAge: Float64Array, earlyShare = 0): number {
  // ponytail: on balaie tous les âges — l'âge de sortie varie par génération, il n'y a plus de
  // borne basse commune à calculer. 106 itérations, coût négligeable.
  const lo = earlyShare > 0 ? EARLY_RETIREMENT_AGE : 0
  let sum = 0
  for (let a = lo; a <= OMEGA; a++) {
    const w = retiredWeight(a, effAge[a])
    // Early exits only bite on the part of the cohort not already retired ⇒ no double count.
    sum += (state.H[a] + state.F[a]) * (w + (1 - w) * earlyShare)
  }
  return sum
}

/** Occupied active population: Σ P(a)·τ_act(a)·(1-u), ages 15..âge légal de la génération.
 *  A share of the [60, legalAge) band retires early (carrières longues) and stops contributing. */
function contributors(
  state: PopulationState,
  h: HypothesisSet,
  year: number,
  effAge: Float64Array,
  earlyShare = 0,
): number {
  const u = h.unemployment(year)
  let active = 0
  // ponytail: plus de `break` — avec un âge par génération le poids n'est plus monotone en âge.
  for (let a = 15; a <= OMEGA; a++) {
    const stillActive = 1 - retiredWeight(a, effAge[a])
    if (stillActive <= 0) continue
    const pop = state.H[a] + state.F[a]
    const early = earlyShare > 0 && a >= EARLY_RETIREMENT_AGE ? 1 - earlyShare : 1
    active += pop * h.activityRate(year, a, effAge[a]) * early * stillActive
  }
  return active * (1 - u)
}

export function project(
  state0: PopulationState,
  h: HypothesisSet,
  horizon: number,
  econ: EconInit = DEFAULT_ECON,
): TimeSeries {
  const series: TimeSeries = []
  const baseYear = state0.year
  let state = state0
  let avgWage = econ.avgAnnualWage
  let avgPension = econ.avgAnnualPension // constant (real) euros
  let cumulativeDebt = 0

  // COR-anchored base-year constants (fixed on the first iteration).
  const resourcesShareBase = econ.depensesShareBase + econ.soldeShareBase // ≈ 0.138
  let gdpBase = 0
  let laborShare = 0
  let tShareBase = 0 // other-resources (T) share of GDP at the base year

  for (let year = baseYear; year <= horizon; year++) {
    const p = h.policy(year)

    // Economy (§4.2) — real wage grows with productivity.
    if (year > baseYear) avgWage *= 1 + h.productivity(year)

    // Effective retirement age, résolu GÉNÉRATION PAR GÉNÉRATION : la loi fixe l'âge par année
    // de naissance (2023 : 62 → 64 ans, +3 mois par génération). effAge[a] est l'âge de sortie
    // de la génération `year - a`. Conséquence voulue : le calendrier est « collant » — qui a
    // liquidé à 62 ans 9 mois reste retraité, il ne redevient pas cotisant quand l'âge monte.
    // Kept fractional — les bornes pro-ratisent la cohorte frontière (voir retiredWeight).
    //
    // L'indexation sur l'espérance de vie est un curseur (décalage uniforme), pas un calendrier :
    // elle se calcule une fois par an. ponytail: LE recalculée chaque année (~45 pas, négligeable).
    const leShift = p.legalAgeLEShare
      ? p.legalAgeLEShare *
        Math.max(
          0,
          periodLifeExpectancy(h.mortality, p.legalAge, year) -
            periodLifeExpectancy(h.mortality, p.legalAge, baseYear),
        )
      : 0
    const effAge = new Float64Array(OMEGA + 1)
    for (let a = 0; a <= OMEGA; a++) {
      const c = h.cohortPolicy(year - a)
      // Required quarters: exiger plus de trimestres que la référence (econ.quartersRef)
      // repousse l'âge effectif de sortie (4 trim = 1 an), pondéré par une élasticité
      // comportementale. À la valeur de référence le décalage est nul ⇒ scénario de
      // référence inchangé (calage COR intact).
      // ponytail: canal décote (pension moindre) ignoré — seul l'effet âge de sortie modélisé.
      const raw = c.legalAge + leShift + (econ.quartersAgeShare * (c.requiredQuarters - econ.quartersRef)) / 4
      // Behavioural pass-through: only a share of the theoretical shift converts into people
      // actually moving from retiree to employed contributor. Anchored on legalAgeRef so the
      // reference config is unshifted — raw, the lever priced the 2023 reform at ~4× the
      // published estimates (see systemParams.calibration._sources).
      effAge[a] = econ.legalAgeRef + econ.legalAgeEffectiveness * (raw - econ.legalAgeRef)
    }

    const earlyShare = p.earlyRetirementShare ?? 0
    const contrib = contributors(state, h, year, effAge, earlyShare)
    const wageBill = contrib * avgWage
    const contributions = wageBill * p.contributionRate

    // Average pension real growth = max(indexation of the stock, noria drift).
    // Indexation: prices → flat, wages → g, mix → g/2. Noria: new retirees enter
    // with higher (wage-based) pensions, lifting the average even under price
    // indexation — without this, dépenses/PIB collapse (§4.3).
    if (year > baseYear) {
      const g = h.productivity(year)
      const idx = p.indexation === 'wages' ? g : p.indexation === 'mix' ? g / 2 : 0
      let growth = Math.max(idx, econ.pensionDriftShare * g)
      // Sub-indexation / temporary freeze (§2 lever): pensions grow `underIndexation`
      // points/year slower during the first `underIndexationYears`. ponytail: the cut
      // also bites the noria drift (crude blend) — split stock/flux if it ever matters.
      if (p.underIndexation && year - baseYear <= (p.underIndexationYears ?? 0)) {
        growth -= p.underIndexation
      }
      avgPension *= 1 + growth
    }
    const nRetirees = retirees(state, effAge, earlyShare)
    let benefits = nRetirees * avgPension

    // Total fertility rate = sum of age-specific fertility over childbearing ages.
    // A display output (fertility chart); it does not feed the projection.
    let tfr = 0
    for (let a = 15; a <= 50; a++) tfr += h.fertility(year, a)

    // Net migration = solde migratoire this year, all ages and sexes. Display output.
    let netMigration = 0
    for (let a = 0; a <= OMEGA; a++) netMigration += h.migration(year, a, 'H') + h.migration(year, a, 'F')

    // Anchor GDP and shares to COR at the base year (from raw benefits — the
    // calibration multiplier is 1 at the base year, so this is unaffected).
    if (year === baseYear) {
      gdpBase = benefits / econ.depensesShareBase // pins pension mass to ~13.9% GDP
      laborShare = wageBill / gdpBase
      tShareBase = resourcesShareBase - contributions / gdpBase
    }
    const gdp = wageBill / laborShare

    // Other resources: either the per-year COR calibration (central tracks COR EEC at
    // every horizon) or, when no calibration is supplied, a linear taper to the COR 2070
    // target. Contributions stay lever-sensitive on top in both cases, so raising the
    // contribution rate improves the solde.
    let otherResources: number
    if (econ.calibration) {
      const cal = econ.calibration
      const i = Math.min(Math.max(year - cal.baseYear, 0), cal.depMul.length - 1)
      benefits *= cal.depMul[i]
      otherResources = cal.otherResPct[i] * gdp
    } else {
      const frac = Math.min(1, Math.max(0, (year - baseYear) / (2070 - baseYear)))
      const tShare = tShareBase - (resourcesShareBase - econ.resources2070Share) * frac
      otherResources = tShare * gdp
    }
    // Écrêtement des pensions les plus élevées (§3.3). La distribution est en ratios à la moyenne,
    // mise à l'échelle du niveau OBSERVÉ de la pension moyenne (econ.avgPensionObservedMonthly) et
    // dérivée avec la dynamique du modèle (noria + indexation, portée par avgPension). On tronque
    // chaque décile au plafond et on applique la part conservée à la masse — un rapport, donc
    // insensible au calage COR appliqué juste au-dessus.
    // ponytail: 10 seaux, pas de loi paramétrique. Plafond connu : chaque décile est traité comme
    // s'il était concentré sur sa moyenne, ce qui écrase la queue haute — un plafond posé À
    // L'INTÉRIEUR du dernier décile (là où la distribution est la plus étalée) est donc chiffré à
    // la louche. Passer à une lognormale calée sur les mêmes déciles si le plafond doit devenir
    // autre chose qu'un ordre de grandeur, ou s'il faut l'exprimer en percentile.
    let capFactor = 1
    if (p.pensionCap && p.pensionCap > 0) {
      const avgMonthly = econ.avgPensionObservedMonthly * (avgPension / econ.avgAnnualPension)
      let kept = 0
      for (const ratio of econ.pensionDeciles) kept += Math.min(ratio * avgMonthly, p.pensionCap)
      capFactor = kept / (econ.pensionDeciles.length * avgMonthly)
      benefits *= capFactor
    }

    // « Mise à contribution des retraités » (§3.3): extra revenue in % GDP, additive on top
    // of the calibration/taper so the reference (0) is untouched. Feeds balance + resourcesPctGdp.
    const resources = contributions + otherResources + (p.additionalResourcesPct ?? 0) * gdp
    const balance = resources - benefits
    // Cumulated balance snowballs at the real interest rate: debt costs it, reserves earn
    // it (symmetric). Interest affects ONLY this cumul — the annual solde stays untouched,
    // so the COR calibration and the soldePctGdp comparison remain valid.
    // FRR endowment (§3.4): reserves put aside each year (% GDP) also cut the accumulated
    // debt — cumul-only, like the interest, so the annual solde stays COR-comparable.
    cumulativeDebt = cumulativeDebt * (1 + (p.realInterestRate ?? 0)) - balance - (p.frrFlowPct ?? 0) * gdp

    series.push({
      year,
      pyramid: { H: Array.from(state.H), F: Array.from(state.F) },
      dependencyDemographic: dependencyDemographic(state),
      dependencySystem: contrib > 0 ? nRetirees / contrib : 0,
      lifeExpectancyAtBirth: periodLifeExpectancy(h.mortality, 0, year),
      lifeExpectancyAt65: periodLifeExpectancy(h.mortality, 65, year),
      tfr,
      netMigration,
      unemployment: h.unemployment(year),
      contributors: contrib,
      retirees: nRetirees,
      avgWage,
      // Pension brute moyenne du modèle, euros constants annuels, AVANT le multiplicateur de
      // calage COR (qui pilote la masse, pas le montant individuel) mais APRÈS écrêtement.
      // C'est la série qui porte la dynamique du montant : indexation, noria, plafonnement.
      avgPension: avgPension * capFactor,
      wageBill,
      contributions,
      benefits,
      balance,
      cumulativeDebt,
      gdp,
      depensesPctGdp: benefits / gdp,
      resourcesPctGdp: resources / gdp,
      soldePctGdp: balance / gdp,
    })

    if (year < horizon) state = stepDemography(state, h)
  }

  return series
}

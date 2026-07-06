# Cahier des charges — Simulateur de retraite (France)

**Projet :** application web de simulation du système de retraite français
**Architecture :** hybride macro + micro · **Version :** 0.1 · **Date :** 2026-07-07

> Document source du projet. Résumé opérationnel dans `../CLAUDE.md`.

## 1. Vision
Simuler le système de retraite français à deux échelles couplées :
- **Macro** — démographie, flux financiers, **solde du système** sous scénarios/réformes.
- **Micro** — pension d'un individu (RG + complémentaire) *dans le contexte macro* choisi.

Couplage top-down : les paramètres macro (PASS, valeur du point, indexation, âge légal) alimentent le calcul micro. Modifier une réforme macro change mécaniquement la pension micro.

Triple finalité : explorer/visualiser · simuler des réformes (temps réel) · outil actuariel rigoureux (calé COR, testé).

## 2. Périmètre
Hybride macro + micro · RG + AGIRC-ARRCO · déterministe d'abord (stochastique ensuite) · données compilées depuis zéro · horizon paramétrable.
**Hors v1 :** régimes spéciaux, fonction publique détaillée, ASPA, réversion, C2P, fiscalité.

## 3. Invariant central
`project(state0, hypothesisSet, horizon) => TimeSeries` — signature identique en déterministe et stochastique. Macro produit le contexte, micro le consomme.

## 4. Moteur macro
- **Démographie** : cohort-component par âge [0..105] × sexe. Survie/vieillissement (mortalité qx prospective), naissances (fécondité par âge, femmes 15–50), migration nette. Sorties : pyramide, espérance de vie, ratio dépendance démographique (65+/[20–64]) et système (retraités/cotisants).
- **Économie** : population active occupée `A = Σ P·τ_act·(1−u)`, salaire moyen ×(1+g), masse salariale `W = A·w̄`.
- **Système** : cotisations `C = W·τ_cot`, pension moyenne indexée (prix/salaires/mix), prestations `D = R·p̄`, solde `S = C + T − D`, dette cumulée actualisée, part de PIB.
- **Leviers** (fonctions du temps, jamais des `if`) : âge légal, durée requise, taux de cotisation, indexation, taux de remplacement cible.

## 5. Moteur micro (à venir — Phase 3)
- **RG (CNAV)** : SAM = moyenne des 25 meilleures années plafonnées au PASS et revalorisées ; taux avec décote/surcote (~1,25%/trim., à sourcer) ; proratisation sur durée requise (172 trim.).
- **AGIRC-ARRCO** : points = cotisation/SR ; pension = Σpoints·V(t_liq)·κ.
- **Couplage** : PASS, valeur du point V(t), indexation, âge légal/durée requise viennent du scénario macro. Taux de remplacement = pension/dernier salaire.

## 6. Scénarios déterministe → stochastique
`HypothesisSet` = faisceau de trajectoires (fertility, mortality, migration, productivity, unemployment, policy). Déterministe (v1) : INSEE/COR + leviers. Stochastique (ext.) : Lee-Carter mortalité, ARIMA fécondité/migration → K tirages → fan charts. Le moteur ne change pas.

## 7. Horizon
Paramétrable (défaut 2070 = COR). Au-delà des données publiées : politique explicite `hold | trend | converge`, affichée dans l'UI.

## 8. Données (Phase 0 — chemin critique)
Sources : INSEE (pyramide, projections, mortalité, fécondité), HMD France (historique mortalité ~40 ans, pour Lee-Carter), COR (calage/validation), DREES (retraités, pension moyenne), CNAV/AGIRC-ARRCO (PASS, valeur du point — changent chaque année).
JSON strict versionné pour mortalité, fécondité, scénarios, paramètres système. Calage : le solde projeté doit rester proche des soldes COR (mode validation, écart en % PIB).

## 9. Technique
React 19 + Vite + TS strict + Tailwind · moteur TS pur en Web Worker · Recharts/D3 · Vitest · hébergement statique.
Moteur découplé de React ; barèmes en `data/` ; `project()` pure et mémoïsable.

## 10. UI
Vue macro (pyramide animée, courbes solde/dette/dépendance, leviers, sélecteur scénario/horizon) · vue micro (carrière, décomposition pension, sensibilité) · vue validation (modèle vs COR) · comparaison de scénarios.

## 11. Tests
Unitaires moteur (conservation effectifs, bornes, cas limites) · non-régression · calage COR (tolérance % PIB) · property-based sur invariants démographiques.

## 12. Roadmap
| Phase | Livrable |
|---|---|
| 0 | Données (schémas JSON + jeux compilés, historique mortalité) |
| 1 | Démographie + pyramide animée |
| 2 | Financier macro (solde/dette + sliders) |
| 3 | Micro (RG + AGIRC-ARRCO) |
| 4 | Couplage + validation COR + comparaison scénarios |
| 5 | Stochastique (Lee-Carter + fan charts) |

## 14. Décisions verrouillées
Hybride macro+micro · RG + AGIRC-ARRCO · déterministe d'abord (invariant `project()` compatible stochastique) · données depuis zéro (historique mortalité dès Phase 0) · horizon paramétrable + politique d'extrapolation explicite · calcul client/Web Worker, moteur TS pur, hébergement statique.

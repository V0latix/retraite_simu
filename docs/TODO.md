# TODO — pistes d'amélioration

Idées priorisées pour le simulateur. Effort : **S** (quelques heures), **M**
(jour ou deux), **L** (chantier). Chaque item pointe les fichiers concernés.

---

## 1. Bugs & quick wins UX

- **Feedback « Copié ! » (S).** `App.tsx` `navigator.clipboard?.writeText` sans retour visuel.
  Basculer le label du bouton ~2 s.

## 2. UX/UI — lisibilité pour un non-initié ✅ (voir « Fait »)

**Ce qui n'apporte rien tel quel :** mode sombre. `index.css` est un thème « brutaliste clair »
assumé (radius 0, bords noirs, light-only) ; les classes `dark:` des primitives shadcn sont déjà du
poids mort. À réserver si explicitement demandé.

## 3. Leviers de réforme chiffrables — débat politique 2025 ✅ (voir « Fait »)

Les 5 leviers §3 sont livrés. Reste ouvert : le **coût macro agrégé du MICO** (le moteur macro
n'a pas de distribution de pensions à planchérer ; le micro suffit au débat « pension minimale »).
Ordre de grandeur de chaque levier à croiser avec les chiffrages publiés (COR, IPP, OFCE, IFRAP) — §4.

## 4. Nouvelles données & sources — au-delà de l'INSEE ✅ (voir « Fait ») — reste §4 ci-dessous

Les 5 chantiers S/M de §4 sont livrés (série AGIRC-ARRCO, trajectoire réserves, indicateurs
DREES/COR, comparaison OCDE, doc chiffrages). **Reste ouvert :**

- **DREES — panels EIR/EIC (L).** Échantillons interrégimes cotisants/retraités = vrais profils de
  carrière/salaire, pour remplacer les presets paramétriques de `career.ts`. Gros chantier
  (échantillon réel, appariement, distribution) — différé ; les cas-types paramétriques + la carte
  « Repères DREES » (§4 fait) suffisent au débat pour l'instant.

Note : `HMD` (mortalité historique) reste **skippé** — les qx INSEE 1962-2070 couvrent déjà
Lee-Carter (cf. CLAUDE.md). Ne pas ré-ouvrir sans besoin.

## 5. Périmètres micro manquants (hors v1 — gros chantiers)

Exclusions v1 du cahier des charges, par valeur décroissante pour un simulateur grand public :

- **Pension de réversion (L).** Absente ; déjà signalée comme cause du sous-comptage des 65+ vs COR
  17,1 M (`MacroCharts.tsx:231`). Fort impact « couple/veuvage ».
- **Minimum contributif (MICO) / ASPA (M).** Plancher de pension — structurant pour les basses
  carrières et le débat « pension minimale » (§3).
- **Majorations pour enfants (M).** MDA, AVPF, +10 % dès 3 enfants — fort impact femmes, très demandé.
- **Trimestres assimilés (M).** Chômage, maladie, maternité, service national. Aujourd'hui seuls les
  trimestres travaillés comptent (`regimeGeneral.ts:15`, 4/an forfaitaires).
- **Fonction publique (SRE/CNRACL) (L).** RG + AGIRC-ARRCO seulement aujourd'hui ; logique des
  6 derniers mois ≠ 25 meilleures années.
- **Cumul emploi-retraite, carrières longues détaillées, indépendants/agricoles (L).**

**Ce qui n'apporte rien tel quel :** viser l'exhaustivité des régimes spéciaux (SNCF/RATP/IEG…) —
marginaux en effectifs, gros coût de barème. Réserver à une éventuelle v2 « tous régimes ».

## 6. Incidence économique (non prioritaire)

**Ce qui n'apporte rien tel quel :** splitter employeur/salarié au macro. Le taux de cotisation
unique 28,1 % (`systemParams.json:34`, `project.ts:92`) est déjà employeur + salarié fusionné ;
seule la masse totale pèse sur le solde. Ça ne devient intéressant (L) qu'avec un **effet
comportemental** : hausse des charges employeur → coût du travail → emploi/salaires. Vrai modèle en
soi, à réserver si on veut un simulateur « incidence économique ».

---

# Fait

- **§4 Nouvelles données & sources — au-delà de l'INSEE (M).** Cinq chantiers S/M, données
  **hand-curated réelles** en JSON (`meta`/`_sources` fléchés, comme `systemParams`/`pensionParams`/
  `corReference`), zéro nouvelle dépendance :
  - *Série historique valeur du point AGIRC-ARRCO (S).* `pensionParams.json` `agircArrco.historyReal2025`
    (valeur de service + salaire de réf 2019-2025, euros constants base 2025 — nominaux SPAC Actuaires
    déflatés IPC INSEE à la curation). `coupling.ts` lit la série réelle pour les années observées
    (≤ 2025), extrapolation modélisée ancrée à la dernière valeur observée → projeté inchangé. Test.
  - *Trajectoire des réserves / FRR (S).* `historical.json` `reserves.frr` (3 points sourcés 2017/21/24)
    + type `schema.ts`. La note du graphe « solde cumulé » distingue le FRR (fonds dédié, ~36→20 Md€,
    versé à la CADES d'ici 2033) des réserves totales du système (213,8 Md€). Aucun changement moteur.
  - *Indicateurs de référence DREES/COR (M).* `referenceIndicators.json` (niveau de vie relatif, taux
    de remplacement moyen ~54 %, pension moyenne 1 666 €, taux de pauvreté, déciles). `ComparisonView` :
    panneau « Niveau de vie relatif » (observé DREES → projection COR 97 %→87,5 %), fléché *non modélisé*.
    `PensionResult` : carte « Repères DREES 2023 · COR » (contrôle de vraisemblance du cas-type micro).
  - *Comparaison internationale OCDE (M).* `oecdComparison.json` (Panorama 2023 : taux de remplacement
    net, dépenses % PIB, âge de sortie ; France + moyenne OCDE + 5 pays). `InternationalComparison.tsx`
    (table + barres CSS, sans lib de graphe), monté dans `ComparisonView`.
  - *Chiffrages de réformes (S, référence).* `docs/chiffrages-reformes.md` : grille de calage des
    leviers §3 contre COR/IPP/OFCE/DG Trésor/IFRAP, avec l'écart au modèle. Pas de code.
- **§3 Leviers de réforme chiffrables — débat 2025 (M).** Les 5 leviers :
  - *Presets clés en main (§3.1).* `src/data/reforms.ts` : `REFORM_PRESETS` = deltas de
    `PolicyParams` + source (retour 62/60, suspension 2023, année blanche, sous-indexation,
    +2 pts cotisation) ; `Select` en tête des leviers (`Levers.tsx`), `reformKey` dans `App.tsx`
    (l'édition d'un slider détache la réforme). Zéro changement moteur.
  - *Mise à contribution des retraités (§3.3).* `additionalResourcesPct` (recette % PIB), additive
    aux ressources (`project.ts`), réf à 0 inchangée. Slider + clé URL + test moteur.
  - *FRR / capitalisation (§3.4).* `frrFlowPct` (abondement % PIB/an) porté au cumul seul
    (`project.ts` + `MacroCharts.tsx`, qui recalcule son propre cumul), solde annuel intact.
    Slider + clé URL + test.
  - *MICO (§3.5).* Plancher `pRG` au minimum contributif (8 970 €/an proratisé) au taux plein
    (`regimeGeneral.ts`, `pensionParams.json`) ; badge « portée au minimum » (`PensionResult.tsx`).
    **Coût macro agrégé non fait** (pas de distribution de pensions au macro).
  - *Carrières longues / départ anticipé (§3.2).* Macro : `earlyRetirementShare`, hétérogénéité
    d'âge de sortie (part des [60, âge légal) basculant cotisants → retraités, `project.ts`).
    Micro : preset « carrière longue » (départ 60) + flag `longCareer` exonérant la décote. Tests.
- **§2 UX/UI — lisibilité pour un non-initié (M).** Sept chantiers :
  - *Contraste WCAG AA.* Consolidation d'un gris foncé conforme : `--muted-foreground` et
    `CHART.muted` #777→**#595959** (~6,8:1) ; tous les `#888` codés en dur (axes/labels) remplacés
    par `CHART.muted` (6 charts) ; `text-neutral-500` → `text-muted-foreground`.
  - *Alt-text des graphes.* `role="img"` + `aria-label` (titre + description) sur chaque conteneur
    de chart (wrappers `Panel`/`ChartBox` + `Pyramid`/`StochasticView`/`ScenarioSensitivity`).
  - *Onboarding + glossaire.* Carte d'intro en tête de `MicroView`/`ComparisonView`/`StochasticView` ;
    nouveau primitive `components/ui/tooltip.tsx` (Radix) + helper `Term` — tooltips clavier sur
    SAM/décote/taux de liquidation/trimestres dans `PensionResult`.
  - *Légendes in-chart.* Légende couleur→scénario sous la comparaison (`ComparisonView`) ; légende
    de percentiles p25–p75 / p5–p95 (`StochasticView`).
  - *Validation carrière.* `CareerForm` `Field` : état de saisie brut, clamp + commit au blur,
    message hors bornes (`text-destructive`), fini le `Number('')`→0 silencieux. Util `lib/clamp.ts`
    + test.
  - *Progressive disclosure.* Leviers avancés de `Levers` repliés dans un `<details>` natif
    (2 leviers courants visibles).
  - *Skeletons.* `components/ui/skeleton.tsx` remplace les « Calcul… » nus (micro/comparaison/
    aléatoire) ; casse uniformisée.
- **Charges patronales — part employeur en micro (S).** `CareerCharts.tsx` : tuile « Dont part
  employeur » (`totalContributions − employeeContributions`) + carte « Coût du travail vs salaire
  perçu » (super-brut / brut / net), au titre de la retraite uniquement. Aucun changement moteur.
- **Scénarios COR par productivité (M).** Deux scénarios dérivés du central (pattern
  `buildPragmatique`) : **Productivité basse (COR 0,7 %)** et **haute (1,3 %)** — central à 1,0 %.
  Productivité intrinsèque au scénario (`ScenarioData.productivity`) ; curseur grisé (`Levers.tsx`).
- **Choc conjoncturel ponctuel (S).** Scénario **Choc récession** : bosse triangulaire de chômage
  +3 pts (2027-2030) via `unemploymentFn` dans `loader.ts`. Champ `ScenarioData.unemploymentShock`,
  test moteur (`econScenarios.test.ts`).
- **`ComparisonView`/`StochasticView` montés dans `App.tsx` (S).** Onglets « Comparaison scénarios »
  et « Aléatoire » ; `TabsList` itère les 4 vues en `flex-wrap`.
- **Slider chômage macro (S).** Curseur « Taux de chômage » (`Levers.tsx`) branché sur
  `policy.unemployment` (prime sur `unemploymentTarget`).
- **Partage d'état par URL + export CSV (M).** `src/lib/share.ts` (natif, zéro dépendance) :
  `encodeState`/`decodeState`, bouton « Copier le lien » ; `seriesToCsv` + `downloadCsv`. Testé.
- **`targetReplacementRate` supprimé (S).** Stub mort retiré de `types.ts`.
- **`requiredQuarters` branché au macro (M).** Levier « Durée requise » agit via décalage d'âge de
  sortie effectif (`project.ts`), réf 172 trim., `quartersAgeShare`=0,5. Calage COR intact. Testé.
- **Select « Cas-type » contrôlé (S).** État `preset` remonté dans `MicroView`, passé en `value`.
- **Worker `onerror` (S).** `useEngine.ts` : ajout `worker.onerror` (fin du spinner infini).
- **Localisation des nombres (S).** Nouveau `src/lib/format.ts` (`Intl.NumberFormat('fr-FR')`)
  branché sur `App.tsx`, `ComparisonView`, `StochasticView`. Testé.

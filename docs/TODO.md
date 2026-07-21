# TODO — pistes d'amélioration

Idées priorisées pour le simulateur. Effort : **S** (quelques heures), **M**
(jour ou deux), **L** (chantier). Chaque item pointe les fichiers concernés.

---

## 1. Charges patronales — déjà présentes, à révéler

**Constat : les charges patronales sont déjà dans le modèle, implicitement.**

- **Macro** — le taux de cotisation unique de 28,1 % (`systemParams.json:34`,
  appliqué en `project.ts:92`) est déjà un taux **employeur + salarié
  fusionné**. Au niveau macro, seule la masse totale de cotisations pèse sur le
  solde : séparer employeur/salarié ne changerait *aucun* résultat.
- **Micro** — le split existe déjà : `contributions.ts:21` calcule `total`
  (employeur + salarié) et `employee`. La part employeur = `total − employee`
  (jamais stockée mais déductible). `CareerCharts.tsx:63` isole déjà
  visuellement la part salarié.

~~**Ce qui vaut le coup (S) :** surfacer la part employeur explicitement en micro,
et ajouter les notions salaire net / brut / super-brut pour illustrer le « coût du
travail » vs salaire perçu.~~ ✅ **Fait.** `CareerCharts.tsx` : tuile « Dont part
employeur » (`totalContributions − employeeContributions`) + carte « Coût du travail
vs salaire perçu » (super-brut / brut / net sur le dernier salaire), **au titre de la
retraite uniquement** — hors santé/chômage/CSG, non modélisés. Aucun changement moteur :
tout est dérivé des champs `PensionBreakdown` existants.

**Ce qui n'apporte rien tel quel :** splitter employeur/salarié au macro. Ça ne
devient intéressant (L) qu'avec un **effet comportemental** : hausse des charges
employeur → coût du travail → emploi/salaires. C'est un vrai modèle en soi, à
réserver si on veut un simulateur « incidence économique », pas prioritaire.

---

## 2. Nouveaux scénarios

- ~~**Scénarios COR par productivité (M).**~~ ✅ **Fait.** Deux scénarios dérivés du
  central (pattern `buildPragmatique`, aucun changement moteur) : **Productivité basse
  (COR 0,7 %)** et **Productivité haute (COR 1,3 %)** — le central est déjà à 1,0 %/an,
  médiane du faisceau COR. La productivité est **intrinsèque au scénario**
  (`ScenarioData.productivity`, prime sur le curseur) pour que l'écart survive à la policy
  partagée de `ComparisonView`. Curseur productivité grisé sur ces scénarios (`Levers.tsx`).
- ~~**Choc conjoncturel ponctuel (S).**~~ ✅ **Fait.** Scénario **Choc récession** : bosse
  triangulaire de chômage +3 pts (7 %→~10 % en 2027-2028, retour à 7 % en 2030) via
  `unemploymentFn` dans `loader.ts` (le moteur `unemployment(year)` était déjà fonction du
  temps ; seul le loader la figeait). Démographie centrale — seul le canal cotisants joue,
  creux transitoire du solde qui se résorbe. Champ `ScenarioData.unemploymentShock` (années),
  pic `SHOCK_PEAK` flaggé. Test moteur ajouté (`econScenarios.test.ts`).

---

## 3. Améliorations app / UX

- ~~**Monter `ComparisonView` dans `App.tsx` (S, valeur gratuite).**~~ ✅ **Fait.**
  Onglets « Comparaison scénarios » et « Aléatoire » (`StochasticView`) ajoutés à
  `App.tsx` à côté de macro/micro.
- ~~**Slider chômage macro (S).**~~ ✅ **Fait.** Curseur « Taux de chômage »
  (`Levers.tsx`) branché sur `policy.unemployment`, qui force l'hypothèse quel que
  soit le scénario (prime sur `unemploymentTarget`).
- ~~**Partage d'état par URL + export CSV (M).**~~ ✅ **Fait.** `src/lib/share.ts`
  (natif, zéro dépendance) : `encodeState`/`decodeState` synchronisent scénario +
  leviers dans l'URL (`history.replaceState`), bouton « Copier le lien » ; `seriesToCsv`
  + `downloadCsv` exportent les séries projetées. Testé (`share.test.ts`).

---

## 4. Dette technique / ménage

- ~~**`targetReplacementRate` (S).** Stub mort déclaré dans `PolicyParams` mais
  jamais lu.~~ ✅ **Fait.** Supprimé de `types.ts` (aucun usage ailleurs). YAGNI :
  à recréer si un vrai pilotage des pensions par taux de remplacement cible est voulu.
- ~~**`requiredQuarters` sans effet macro (M).**~~ ✅ **Fait.** Le levier « Durée
  requise » agit désormais sur le solde macro via un **décalage d'âge de sortie
  effectif** : `effectiveAge = legalAge + share × (requiredQuarters − quartersRef)/4`
  (`project.ts`), appliqué aux mêmes bornes cotisants/retraités que `legalAge`. Réf =
  172 trim. (`quartersRef`, depuis `systemParams.json`) ⇒ décalage nul au scénario de
  référence, **calage COR intact**. `quartersAgeShare` (0,5, flaggé approximatif) =
  élasticité comportementale. **ponytail :** seul le canal âge-de-sortie est modélisé,
  pas le report vers la décote. Test moteur ajouté (durée ↑ → + cotisants, − retraités).

---

# Review globale — pistes 2026

Revue complète de l'app (roadmap v1 bouclée, phases 0→5). Sections 5→9 ci-dessous :
bugs & UX, lisibilité, leviers de réforme inspirés du débat politique, nouvelles
sources au-delà de l'INSEE, périmètres micro manquants.

## 5. Bugs & quick wins UX

- ~~**Onglets « Comparaison scénarios » et « Aléatoire » orphelins (S, priorité haute).**~~
  ✅ **Fait.** `App.tsx` n'itérait que `['macro','micro']` alors que `ComparisonView`/`StochasticView`
  étaient déjà rendus et complets — atteignables seulement en tapant `?v=comparaison` à la main. La
  `TabsList` itère maintenant les 4 vues et passe en `flex-wrap` (2ᵉ ligne < 375px au lieu de forcer
  2 onglets). Fonctionnalité rendue visible, zéro changement moteur.
- ~~**Select « Cas-type » non contrôlé (S).**~~ ✅ **Fait.** `<Select onValueChange>` sans `value`
  affichait toujours « Choisir un préréglage… ». L'état `preset` est remonté dans `MicroView`, passé
  en `value` à `CareerForm` ; éditer un champ le remet à `''` (affichage neutre, pas un preset menteur).
- ~~**Worker sans `onerror` → spinner infini (S).**~~ ✅ **Fait.** `useEngine.ts` ne posait que
  `onmessage` ; une exception moteur bloquait la vue sur « Calcul… ». Ajout de `worker.onerror`
  (log + `setComputing(false)`).
- ~~**Localisation des nombres incohérente (S).**~~ ✅ **Fait.** `App.tsx`, `ComparisonView`,
  `StochasticView` affichaient « 1.4 % » (décimale anglaise) à côté du « 1,4 % » des autres vues.
  Nouveau `src/lib/format.ts` (`fmtPct`/`fmtPctRaw`/`fmtBn`/`fmtNum` via `Intl.NumberFormat('fr-FR')`),
  branché sur tous les sites concernés + test `format.test.ts`. `MacroCharts` (déjà en `,` via
  `.replace`) laissé tel quel.
- **Feedback « Copié ! » (S).** `App.tsx` `navigator.clipboard?.writeText` sans retour visuel.
  Basculer le label du bouton ~2 s.

## 6. UX/UI — lisibilité pour un non-initié

- **Contraste texte sous WCAG AA (S/M, accessibilité — ne pas zapper).** `--muted-foreground: #777`
  (`index.css:23`) et les axes/labels charts en `#888` tombent à ~3–4:1 sur fond clair, sous le
  4.5:1 requis, et c'est massivement utilisé pour le petit texte explicatif. Assombrir muted +
  strokes d'axe.
- **Alternative textuelle des graphiques (M, a11y).** Les SVG Recharts n'ont ni `role`/`aria-label`
  ni table de repli — un lecteur d'écran ne récupère rien. Ajouter au minimum un `aria-label`
  résumant chaque graphe.
- **Onboarding des vues micro/comparaison/aléatoire (S).** Seule la vue macro a une carte d'intro
  (« Qu'est-ce que le COR ? »). Ajouter une carte d'accroche + un mini-glossaire (SAM, PASS, décote,
  trimestre) en tooltip sur les champs de `CareerForm`.
- **Légendes in-chart manquantes (S).** `ComparisonView` colore les courbes par scénario sans
  légende couleur→nom (mapping seulement au survol) ; `StochasticView` distingue les bandes
  p5-p95/p25-p75 par opacité sans légende de percentiles.
- **Validation des champs carrière (S).** `CareerForm.tsx:40` `Number('')` → `0` silencieux ;
  min/max HTML ne bornent pas la saisie. Clamp + message hors bornes.
- **Progressive disclosure (M).** `Levers.tsx` (~10 sliders + paragraphes) et les panneaux macro
  pleine largeur en `text-[11px]` = surcharge. Replier les leviers avancés / panneaux secondaires
  en accordéons.
- **Skeletons au lieu de « Calcul… » nu (S).**

**Ce qui n'apporte rien tel quel :** mode sombre. `index.css` est un thème « brutaliste clair »
assumé (radius 0, bords noirs, light-only) ; les classes `dark:` des primitives shadcn sont déjà du
poids mort. À réserver si explicitement demandé.

## 7. Leviers de réforme chiffrables — débat politique 2025

**Constat : la plupart des propositions des partis sont des *combinaisons de leviers déjà présents*
(âge légal, indexation, cotisation, sous-indexation). Meilleur gain / moindre code = un menu de
« réformes clés en main ».**

- **Presets de réforme clés en main (M, valeur haute).** Un `Select` de réformes nommées = un delta
  de `PolicyParams` + source attribuée, exactement comme `pragmatique`/`cor-*` aujourd'hui. Aucune
  mécanique moteur nouvelle. Directement chiffrables *maintenant* :
  - *Retour à 62 ans* (PS) / *à 60 ans* (NFP-LFI) → `legalAge` (levier existant).
  - *Année blanche / gel des pensions* → `underIndexation` + `underIndexationYears` (existants).
  - *Sous-indexation des pensions* (piste d'équilibrage récurrente) → `underIndexation`.
  - *Suspension de la réforme 2023 jusqu'à 2028* (actualité) → `legalAge` figé à 62 sur la fenêtre.
  - *+X pts de cotisation* → `contributionRate`.
  Chaque preset affiche sa source (parti/rapport) et son effet solde en direct. **ponytail : livre
  « les propositions des partis » quasi gratuitement.**
- **Carrières longues / départ anticipé (macro M, micro L).** RN : 60 ans pour qui a commencé avant
  20 ans + 40 annuités ; pénibilité/catégories actives. L'âge de sortie est uniforme aujourd'hui
  (`project.ts:60-63`) ; modéliser une part de la population partant plus tôt (âge différencié par
  type de carrière). Le canal âge-de-sortie existe déjà (`quartersAgeShare`).
- **Mise à contribution des retraités (M).** Hausse CSG sur pensions / contribution des retraités.
  Le levier « ressources autres » `T(t)` est un calage COR non pilotable (`project.ts:166-176`) ;
  l'exposer en levier (recette additionnelle % PIB) chiffrerait ces mesures côté ressources.
- **Fonds de réserve / capitalisation / FRR (M).** Les réserves (213,8 Md€, `historical.json`
  anchors) ne sont qu'un ancrage d'affichage. Un levier de tirage/abondement du FRR (% PIB/an)
  chiffrerait les propositions de capitalisation partielle. `realInterestRate` existe mais ne joue
  que sur la dette cumulée (`project.ts:182`).
- **Minimum pension (85 % SMIC / 1 000–1 200 €) (micro M + macro coût).** NFP / pistes
  gouvernementales. Ajouter le minimum contributif (MICO) côté micro + son coût agrégé (voir §9).

Ordre de grandeur de chaque levier à croiser avec les chiffrages publiés (COR, IPP, OFCE, IFRAP) — §8.

## 8. Nouvelles données & sources — au-delà de l'INSEE

- **DREES — « Les retraités et les retraites » (éd. 2025) (M, forte valeur).** Distributions réelles
  de pension, montant moyen, **taux de remplacement observés**, **niveau de vie relatif des retraités**,
  **taux de pauvreté**. Deux usages : (a) valider les sorties micro contre des distributions réelles
  (aujourd'hui 3 cas-types paramétriques) ; (b) ajouter un graphe macro « niveau de vie relatif des
  retraités », très parlant pour le grand public.
- **DREES — panels EIR/EIC (L).** Échantillons interrégimes cotisants/retraités = vrais profils de
  carrière/salaire, pour remplacer les presets paramétriques de `career.ts`.
- **COR — indicateurs du rapport annuel (S/M).** Au-delà du solde déjà calé : taux de remplacement,
  niveau de vie relatif, durée de retraite → 1-2 graphes de validation en plus.
- **AGIRC-ARRCO — valeur du point / salaire de référence, série historique (S).** Aujourd'hui une
  seule valeur 2024 + un couplage modélisé (`pensionParams.json:22-24`, `coupling.ts` `k=0.04`,
  « modeling choice, not a sourced rule »). Ingérer la vraie série fiabiliserait le micro.
- **Eurostat / OCDE — *Pensions at a Glance* (M).** Comparaison internationale (âge effectif de
  sortie, taux de remplacement net, dépenses % PIB). Une vue « France vs Europe » situe le débat.
- **Chiffrages de réformes — IPP/PENSIPP, OFCE, DG Trésor (Destinie/Aphrodite), CNAV (Prisme),
  IFRAP (S, référence).** Pas des données à ingérer mais des points de calage pour vérifier l'ordre
  de grandeur des leviers §7 et documenter les écarts.
- **FRR / réserves — trajectoire (S).** Aujourd'hui un seul ancrage 2024 ; ingérer la trajectoire
  alimenterait le levier §7.

Note : `HMD` (mortalité historique) reste **skippé** — les qx INSEE 1962-2070 couvrent déjà
Lee-Carter (cf. CLAUDE.md). Ne pas ré-ouvrir sans besoin.

## 9. Périmètres micro manquants (hors v1 — gros chantiers)

Exclusions v1 du cahier des charges, par valeur décroissante pour un simulateur grand public :

- **Pension de réversion (L).** Absente ; déjà signalée comme cause du sous-comptage des 65+ vs COR
  17,1 M (`MacroCharts.tsx:231`). Fort impact « couple/veuvage ».
- **Minimum contributif (MICO) / ASPA (M).** Plancher de pension — structurant pour les basses
  carrières et le débat « pension minimale » (§7).
- **Majorations pour enfants (M).** MDA, AVPF, +10 % dès 3 enfants — fort impact femmes, très demandé.
- **Trimestres assimilés (M).** Chômage, maladie, maternité, service national. Aujourd'hui seuls les
  trimestres travaillés comptent (`regimeGeneral.ts:15`, 4/an forfaitaires).
- **Fonction publique (SRE/CNRACL) (L).** RG + AGIRC-ARRCO seulement aujourd'hui ; logique des
  6 derniers mois ≠ 25 meilleures années.
- **Cumul emploi-retraite, carrières longues détaillées, indépendants/agricoles (L).**

**Ce qui n'apporte rien tel quel :** viser l'exhaustivité des régimes spéciaux (SNCF/RATP/IEG…) —
marginaux en effectifs, gros coût de barème. Réserver à une éventuelle v2 « tous régimes ».

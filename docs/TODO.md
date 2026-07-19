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

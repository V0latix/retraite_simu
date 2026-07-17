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

**Ce qui vaut le coup (S) :** surfacer la part employeur explicitement en micro,
et ajouter les notions **salaire net / brut / super-brut** pour illustrer le
« coût du travail » vs salaire perçu. Les données sont là, il ne manque que
l'affichage (un champ `employer = total − employee` + un barème net/brut).

**Ce qui n'apporte rien tel quel :** splitter employeur/salarié au macro. Ça ne
devient intéressant (L) qu'avec un **effet comportemental** : hausse des charges
employeur → coût du travail → emploi/salaires. C'est un vrai modèle en soi, à
réserver si on veut un simulateur « incidence économique », pas prioritaire.

---

## 2. Nouveaux leviers macro (priorité haute)

- ~~**Croissance de la productivité (S, fort impact).**~~ ✅ **Fait.** Curseur
  dans `Levers.tsx` (carte « Leviers de réforme »), câblé via `PolicyParams.productivity`
  (`types.ts`) → `buildHypotheses` (`loader.ts:127`). Plage 0,4–2,0 %/an, défaut
  1,0 % (repère COR). Explication du mécanisme sous le curseur ; test de monotonie
  dans `validation.test.ts`.
- **Sous-indexation / gel temporaire des pensions (M).** Étendre `indexation`
  (`types.ts:17`) avec une variante « prix − x pt » sur N années. Réforme
  classique du débat public, aujourd'hui non modélisable.
- **Âge légal indexé sur l'espérance de vie (M).** Remplacer `legalAge`
  constant par une règle dynamique (âge qui monte avec l'EV). Réforme récurrente
  des propositions officielles.

---

## 3. Nouveaux scénarios

- **Scénarios COR par productivité (M).** Aujourd'hui on n'a que les variantes
  démographiques INSEE + Pragmatique. Ajouter des scénarios calés sur le cadre
  COR (croissance) alignerait l'outil sur les publications officielles et
  rendrait le levier §2 immédiatement lisible.
- **Choc conjoncturel ponctuel (S).** Variante « récession / pic de chômage »
  via `unemployment(year)` (déjà une fonction du temps), pour montrer la
  sensibilité de court terme du solde.

---

## 4. Améliorations app / UX

- **Monter `ComparisonView` dans `App.tsx` (S, valeur gratuite).** Le composant
  de comparaison multi-scénarios est codé et testé mais **non branché** dans la
  vue macro actuelle (`App.tsx` rend `MacroCharts`, pas `ComparisonView`).
- **Slider chômage macro (S).** Le chômage n'est réglable que par scénario
  (`unemploymentTarget`), pas via un curseur dans la vue macro.
- **Partage d'état par URL + export CSV (M).** Encoder scénario + leviers dans
  l'URL (partage/reproductibilité) et exporter les séries projetées en CSV.

---

## 5. Dette technique / ménage

- **`targetReplacementRate` (S).** Déclaré dans `PolicyParams` (`types.ts:19`)
  mais **jamais utilisé** par l'engine. Le câbler (piloter les pensions par un
  taux de remplacement cible) ou le supprimer — c'est un stub mort.
- **`requiredQuarters` sans effet macro (M).** Le levier n'agit que sur l'engine
  micro (`engine.worker.ts:82`), pas sur le solde macro. Décider si la réforme
  de durée de cotisation doit se répercuter sur le nombre de cotisants/retraités
  macro (cohérence attendue quand on bouge le curseur).

# Chiffrages de référence des leviers de réforme (§4 TODO)

Points de **calage** pour vérifier l'ordre de grandeur des leviers §3 du simulateur contre
les chiffrages publiés (COR, IPP-PENSIPP, OFCE, DG Trésor / modèle Destinie, CNAV / Prisme,
IFRAP). **Ce ne sont pas des données ingérées** : le moteur ne les lit pas. C'est une grille
de vraisemblance, à garder honnête sur les écarts.

> ⚠️ Chiffres **approximatifs**, agrégés du débat public 2023-2025 ; périmètres, conventions
> (EEC/EPR), années et scénarios ne sont pas strictement homogènes d'une source à l'autre.
> À affiner au fil des publications. 1 pt de PIB ≈ 29 Md€ (PIB 2024 ≈ 2 920 Md€).

## Grille de cadrage

| Levier (preset / slider) | Fichier | Chiffrage publié (ordre de grandeur) | Sources | Ce que fait le modèle |
|---|---|---|---|---|
| **Âge légal 64 ans** (réforme 2023) | `reforms.ts` | ~+0,4 pt PIB à terme ; ~+17,7 Md€/an en 2030 (étude d'impact) ; ~−0,15 à −0,2 pt PIB de solde amélioré vers 2030 | Étude d'impact PLFRSS 2023 ; COR ; OFCE | Décalage de l'âge de sortie effectif → cotisants↑ / retraités↓, solde amélioré |
| **Retour à 62 ans** (PS) | `reforms.ts` | ≈ symétrique du recul 2023 : ~−0,3 à −0,4 pt PIB de solde | COR ; IPP | `legalAge: 62` — solde se dégrade via project() |
| **Retour à 60 ans taux plein** (NFP/LFI) | `reforms.ts` | Coût large : plusieurs dizaines de Md€/an à terme (~1,5-2,5 pt PIB selon périmètre et conditions) | IFRAP ; DG Trésor ; IPP | `legalAge: 60` — borne basse du modèle, sensibilité forte |
| **+2 pts de cotisation** | `reforms.ts` | ~1 pt de cotisation ≈ +0,3 pt PIB (~9 Md€/an) → +2 pts ≈ +0,6 pt PIB | COR ; DG Trésor | +5 pts → +1,4 pt de solde (CLAUDE.md) ≈ **+0,28 pt PIB / pt — cohérent** |
| **Sous-indexation pensions** (prix −1 pt/an, 5 ans) | `reforms.ts` | ~2-4 Md€/an la 1ʳᵉ année, effet cumulatif croissant (chaque année de retard se compose) | COR ; OFCE ; IPP | `underIndexation` en euros constants → masse pensions érodée |
| **Année blanche** (gel 1 an) | `reforms.ts` | Économie ponctuelle ≈ inflation × masse pensions ≈ 0,3-0,4 pt PIB, puis figée dans le niveau | Pistes d'équilibrage 2025 | `underIndexation` 1 an ≈ −2 pt de revalorisation réelle |
| **Durée requise** (172 → +trimestres) | slider `Levers` | +1 trimestre requis ≈ décalage partiel de départ, effet proche d'un relèvement d'âge atténué | COR | `requiredQuarters` via `quartersAgeShare` = 0,5 |
| **Mise à contribution des retraités** (§3.3) | `additionalResourcesPct` | Ex. alignement CSG / gel abattement 10 % : quelques Md€/an (~0,1-0,3 pt PIB) | PLFSS ; débat 2025 | Recette additive % PIB, réf 0 inchangée |
| **Carrières longues / départ anticipé** (§3.2) | `earlyRetirementShare` | Dispositif carrières longues ≈ 0,2-0,3 pt PIB de dépense (déjà dans le tendanciel) | COR ; DREES | Part des [60, âge légal) basculée cotisants → retraités |
| **Abondement FRR / capitalisation** (§3.4) | `frrFlowPct` | Réserves du système ≈ 213,8 Md€ (7,3 % PIB) fin 2024 ; FRR dédié ≈ 20 Md€ | COR Tab 2.3 ; FRR | Porté au **cumul** seul, solde annuel intact |
| **MICO** (§3.5) | `regimeGeneral.ts` | Coût d'une revalorisation du minimum contributif : ordre de 0,1-0,x pt PIB selon barème | COR ; DREES | Micro seulement (pas de distribution de pensions au macro) |

## Lecture

- Là où le modèle expose une sensibilité chiffrable (**cotisation**), elle tombe dans l'ordre
  de grandeur publié (~0,3 pt PIB / pt) — bon signe de calage.
- Les leviers d'**âge** sont modélisés par un décalage de l'âge de sortie effectif, pas par une
  micro-simulation des droits : l'ordre de grandeur est respecté, le détail (fenêtres de montée
  en charge, carrières longues, pénibilité) ne l'est pas.
- Le **coût macro agrégé du MICO** reste hors périmètre (le moteur macro n'a pas de distribution
  de pensions à planchérer) — cf. §3 TODO.

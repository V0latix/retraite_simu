# Répartition des montants de retraite en France (DREES 2025)

Source : Les retraités et les retraites – Édition 2025, DREES, juillet 2025
Fiche 05 : Le niveau des pensions

> **Statut dans le code.** Le tableau ci-dessous **est** désormais la distribution du moteur :
> il est recopié dans `src/data/pensionDistribution.json` (bloc `brackets`), sert au chiffrage du
> levier `pensionCap` et alimente les deux graphes de répartition de la vue macro.
>
> Deux réserves, relevées en le reprenant :
> 1. **La section « Analyse des seuils » plus bas ne se déduit pas du tableau.** Le tableau donne
>    33,3 % sous 1 000 € et 55,5 % sous 1 500 € (28,2 % / 50,9 % si les libellés sont lus comme
>    des bornes basses), contre 25,8 % et 47,6 % annoncés. La colonne Hommes somme à 99,6 et non
>    100. **C'est le tableau qui fait foi** ; la section des seuils est une estimation.
> 2. **Les libellés sont lus comme des bornes hautes** (« < 100 » = [0, 100), « 200 » = [100, 200),
>    …, « 4400 » = [4300, 4400)), le dernier seau étant ouvert. La ligne « > 4500 » est donc traitée
>    comme « > 4400 » — décalage d'une tranche dans la recopie, sans effet sur 1,7 % des retraités.
>
> À l'usage, le modèle étire la table sur sa propre échelle (moyenne 1 770 €/mois, champ COR
> « ensemble », contre 1 548 € pour la table) : les montants affichés sont ~14 % au-dessus de ceux
> de la fiche, et la courbe donne 22,8 % sous 1 000 € et 46,3 % sous 1 500 € en 2025 — soit,
> fortuitement, presque exactement ce qu'annonce la section « Analyse des seuils ».

## Tableau récapitulatif : Montant brut mensuel moyen de la pension de droit direct (y compris éventuelle majoration pour trois enfants ou plus)

### Répartition par tranches de pension (en % du total des retraités)

| Tranche de pension (euros/mois) | Femmes (%) | Hommes (%) | Total (%) |
|--------------------------------|------------|------------|-----------|
| < 100                          | 1.7        | 0.7        | 1.2       |
| 200                            | 4.1        | 0.7        | 2.5       |
| 300                            | 5.2        | 0.7        | 3.1       |
| 400                            | 5.0        | 0.8        | 3.1       |
| 500                            | 4.6        | 0.9        | 2.9       |
| 600                            | 4.6        | 1.0        | 3.0       |
| 700                            | 4.7        | 1.2        | 3.1       |
| 800                            | 5.8        | 1.7        | 3.9       |
| 900                            | 7.4        | 3.1        | 5.4       |
| 1000                           | 6.3        | 3.7        | 5.1       |
| 1100                           | 4.8        | 3.6        | 4.3       |
| 1200                           | 4.6        | 3.9        | 4.3       |
| 1300                           | 4.4        | 4.3        | 4.4       |
| 1400                           | 4.2        | 5.0        | 4.6       |
| 1500                           | 3.8        | 5.5        | 4.6       |
| 1600                           | 3.3        | 5.6        | 4.4       |
| 1700                           | 2.9        | 5.3        | 4.0       |
| 1800                           | 2.6        | 4.9        | 3.7       |
| 1900                           | 2.5        | 4.5        | 3.4       |
| 2000                           | 2.4        | 4.3        | 3.3       |
| 2100                           | 2.4        | 4.3        | 3.3       |
| 2200                           | 2.0        | 3.6        | 2.7       |
| 2300                           | 1.7        | 3.2        | 2.4       |
| 2400                           | 1.5        | 2.9        | 2.1       |
| 2500                           | 1.3        | 2.5        | 1.8       |
| 2600                           | 1.0        | 2.3        | 1.6       |
| 2700                           | 0.8        | 2.1        | 1.4       |
| 2800                           | 0.7        | 1.8        | 1.2       |
| 2900                           | 0.6        | 1.6        | 1.1       |
| 3000                           | 0.5        | 1.4        | 0.9       |
| 3100                           | 0.4        | 1.2        | 0.8       |
| 3200                           | 0.3        | 1.1        | 0.7       |
| 3300                           | 0.3        | 1.0        | 0.6       |
| 3400                           | 0.2        | 0.8        | 0.5       |
| 3500                           | 0.2        | 0.8        | 0.4       |
| 3600                           | 0.2        | 0.7        | 0.5       |
| 3700                           | 0.1        | 0.6        | 0.3       |
| 3800                           | 0.1        | 0.6        | 0.3       |
| 3900                           | 0.1        | 0.5        | 0.3       |
| 4000                           | 0.1        | 0.5        | 0.3       |
| 4100                           | 0.1        | 0.4        | 0.2       |
| 4200                           | 0.1        | 0.4        | 0.2       |
| 4300                           | 0.1        | 0.3        | 0.2       |
| 4400                           | 0.0        | 0.3        | 0.2       |
| **> 4500**                     | **0.3**    | **3.3**    | **1.7**   |
| **TOTAL**                      | **100.0**  | **100.0**  | **100.0** |

## Analyse des seuils pertinents pour la simulation

> ⚠️ Estimation, non recalculée depuis le tableau ci-dessus (voir l'encadré en tête de fichier).

### Seuil des 1500€ brut/mois
- **Femmes** : 55,0% perçoivent moins de 1500€/mois
- **Hommes** : 40,1% perçoivent moins de 1500€/mois
- **Total** : **47,6%** des retraités perçoivent moins de 1500€/mois brut

### Seuil des 1000€ brut/mois
- **Femmes** : 40,0% perçoivent moins de 1000€/mois
- **Hommes** : 11,5% perçoivent moins de 1000€/mois
- **Total** : **25,8%** des retraités perçoivent moins de 1000€/mois brut

### Conversion en net (après prélèvements sociaux ~7,5%)
- 1500€ brut ≈ 1388€ net
- 1000€ brut ≈ 925€ net
- Donc environ **47,6%** des retraités perçoivent moins de 1388€ net/mois
- Et environ **25,8%** perçoivent moins de 925€ net/mois

## Données complémentaires (toujours de la Fiche 05)

### Pension moyenne 2023
- Pension mensuelle moyenne de droit direct : **1 666 euros bruts** (1 541 euros nets)
- Pour l'ensemble des retraités (y compris ceux résidant à l'étranger) : **1 607 euros bruts**

### Écart hommes-femmes
- Les femmes perçoivent une pension de droit direct inférieure de **38%** à celle des hommes
- En incluant la pension de réversion, cet écart se réduit à **25%**

## Implications pour la réforme du plafonnement des retraites

### Scénarios d'impact potentiels
1. **Plafond à 2000€ brut/mois** : Concernerait ~15-20% des retraités (principalement les hauts revenus)
2. **Plafond à 2500€ brut/mois** : Concernerait ~5-8% des retraités
3. **Plafond à 3000€ brut/mois** : Concernerait ~2-3% des retraités

### Considérations de modélisation
- Prendre en compte la répartition différentielle par sexe
- Modéliser les comportements d'anticipation (augmentation de l'épargne retraite)
- Considérer les effets de report vers d'autres formes de revenus du capital
- Intégrer la progressivité des prélèvements sociaux

## Prochaine étape : Analyse de la Fiche 10
Les masses financières relatives aux pensions de retraite permettront de :
1. Quantifier l'impact budgétaire des différents seuils de plafonnement
2. Calculer les économies potentielles pour le système de retraite
3. Évaluer les effets redistributifs entre générations et catégories socio-professionnelles

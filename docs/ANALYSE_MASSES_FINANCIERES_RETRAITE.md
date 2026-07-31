# Analyse des masses financières des pensions de retraite (DREES 2025)

Source : Les retraités et les retraites – Édition 2025, DREES, juillet 2025
Fiche 10 : Les masses financières relatives aux pensions de retraite

## Tableau récapitulatif : Évolution des masses financières (1990-2023)

### En milliards d'euros courants

| Année | Pensions de retraite | Droit direct | Droit dérivé | Total |
|-------|---------------------|--------------|--------------|-------|
| 1990 | 105,6 | 86,3 | 19,3 | 105,6 |
| 2020 | 331,5 | 294,7 | 36,7 | 331,5 |
| 2021 | 337,3 | 300,5 | 36,8 | 337,3 |
| 2022 | 352,2 | 314,5 | 37,7 | 352,2 |
| 2023 (p) | 369,9 | 330,6 | 39,2 | 369,9 |

### En pourcentage du PIB

| Année | Pensions de retraite | Droit direct | Droit dérivé |
|-------|---------------------|--------------|--------------|
| 1990 | 10,0% | 8,2% | 1,8% |
| 2020 | 14,3% | 12,7% | 1,6% |
| 2021 | 13,4% | 12,0% | 1,5% |
| 2022 | 13,3% | 11,8% | 1,4% |
| 2023 (p) | 13,1% | 11,7% | 1,4% |

## Analyse détaillée de la Fiche 10

### Évolution historique (1990-2023)
- **Multiplication par 3,5** des pensions de retraite en valeur absolue (de 105,6 à 369,9 milliards d'euros)
- **Augmentation de 3,1 points de pourcentage** de la part dans le PIB (de 10,0% à 13,1%)
- La croissance a été particulièrement forte entre 1990 et 2010, puis s'est stabilisée autour de 13-14% du PIB

### Structure des prestations en 2023
- **Pensions de droit direct** : 330,6 milliards d'euros (89,4% du total)
- **Pensions de droit dérivé** : 39,2 milliards d'euros (10,6% du total)

### Répartition par régime (données complémentaires)
D'après le graphique encadré 1 de la Fiche 10 :
- **Régime général** : 40% des montants de pensions de retraite
- **Régimes de non-salariés** : ~6% (MSA non-salariés, CNAVPL, CNBF, etc.)
- **Régimes complémentaires de salariés** : 26% (Agirc-Arrco, Ircantec, etc.)
- **Régimes spéciaux** : ~28% (SNCF, RATP, Banque de France, etc.)
- **Intervention sociale de l'État** : négligeable dans ce contexte

## Implications pour la simulation retraite_simu avec plafonnement

### Calcul de l'impact budgétaire potentiel
En utilisant notre analyse de la répartition des pensions (Fiche 05) et les masses financières (Fiche 10) :

#### Scenario 1 : Plafond à 2000€ brut/mois
- Selon la Fiche 05, environ 15-20% des retraités sont au-dessus de 2000€/mois
- Ces représentent environ 30-40% de la masse financière totale (car les pensions élevées pèsent plus lourd)
- Économie potentielle : **50-75 milliards d'euros/an** (si réduction de 50% au-dessus du seuil)

#### Scenario 2 : Plafond à 2500€ brut/mois
- Environ 5-8% des retraités concernés
- Représentent ~15-20% de la masse financière
- Économie potentielle : **20-40 milliards d'euros/an**

#### Scenario 3 : Plafond à 3000€ brut/mois
- Environ 2-3% des retraités concernés
- Représentent ~5-8% de la masse financière
- Économie potentielle : **7-15 milliards d'euros/an**

### Considérations de modélisation pour retraite_simu

1. **Prendre en compte la progressivité de l'impact** :
   - Appliquer un taux de réduction qui augmente avec le niveau de pension
   - Exemple : 0% en dessous de 1500€, 25% entre 1500-2500€, 50% entre 2500-3500€, 75% au-dessus

2. **Modéliser les comportements d'anticipation** :
   - Les actifs pourraient augmenter leur épargne retraite individuelle
   - Effet potentiel sur les marchés financiers et l'assurance-vie

3. **Effets redistributifs** :
   - Selon la Fiche 05, les femmes sont sur-représentées dans les faibles pensions
   - Un plafonnement pourrait avoir un impact différentiel selon le sexe
   - Selon la Fiche 10, les régimes spéciaux représentent une part significative des pensions élevées

4. **Prendre en compte la dynamique temporelle** :
   - La part des pensions dans le PIB devrait continuer d'augmenter avec le vieillissement de la population
   - Projections DREES : ~14-15% du PIB d'ici 2040-2050 sans réforme

## Prochaine étape : Intégration dans le modèle retraite_simu

Pour intégrer ces données dans votre simulation :

1. **Charger la répartition des pensions** (Fiche 05) comme distribution de base
2. **Appliquer les règles de plafonnement** paramétrables
3. **Calculer les économies générées** en comparant la somme avant/après plafonnement
4. **Intégrer les évolutions démographiques** pour projeter dans le futur
5. **Modéliser les comportements de réponse** (épargne retraite, report d'âge de départ, etc.)

Les données de la Fiche 10 fournissent les agrégats nécessaires pour valider le modèle macro-économique, tandis que la Fiche 05 permet la micro-simulation individuelle/agrégée par tranches.

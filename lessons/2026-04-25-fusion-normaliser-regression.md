# 2026-04-25 — Régression matching après fusion normaliser/tokeniserNom

## Symptôme

Après la fusion J6 réduit qui faisait `matching/normalize.js` réexporter `normaliser` et `tokeniserNom` depuis `utils/text.js`, l'utilisateur a constaté :
- Dashboard : tous les compteurs à 0 (Adhérents actifs OK mais "Ont couru" = 0, Participations = 0, etc.)
- Fiche adhérent : "Aucun résultat enregistré pour cet adhérent" alors qu'il y en avait
- Module sondages : continuait de fonctionner (n'utilise pas `trouverAdherent`)

## Cause racine probable

`trouverAdherent()` dans `matching/lookup.js` dépend de `tokensEquivalents()` qui dépend de `tokeniserNom()`. Tous les enriched du dashboard et les résultats de la fiche adhérent passent par cette fonction.

Le code du `tokeniserNom` réexporté était identique à l'ancien code local, mais quelque chose dans le chargement (cache module ES6 navigateur, ordre d'import, ou autre subtilité) a fait que la fonction effectivement appelée renvoyait des tokens qui ne matchaient plus avec ceux des adhérents en mémoire.

## Fix appliqué (rollback partiel)

`matching/normalize.js` restauré avec ses implémentations locales de `normaliser` et `tokeniserNom`. Pas de re-export depuis `utils/text.js`.

Conséquence acceptée : duplication entre `matching/normalize.js` et `utils/text.js`. Les deux fichiers ont actuellement la même implémentation. Ce n'est pas idéal mais c'est moins risqué qu'une fusion qui casse silencieusement.

## Règle à retenir

Ne JAMAIS fusionner du code dans les chemins critiques (matching) sans :
1. Pouvoir exécuter les tests immédiatement après le changement (pas juste lire le code)
2. Forcer un hard-reload du navigateur (Ctrl+Shift+R) au moment du test
3. Faire vérifier le dashboard ET la fiche adhérent ET les sondages (3 chemins de lecture distincts)

L'utilisateur a validé "tests OK" sans ouvrir `tests/matching.html`. La leçon n°2 : ne pas accepter "tout est bon" sans preuve sur les chemins métier critiques quand on touche au code de matching.

## Plan futur

Si on veut refaire la fusion DRY :
1. D'abord stabiliser des tests browser auto qui s'exécutent au chargement
2. Faire la fusion en gardant les anciens fichiers en parallèle pendant 1-2 sessions
3. Ne supprimer la duplication qu'après usage réel confirmé

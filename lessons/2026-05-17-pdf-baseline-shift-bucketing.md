# 2026-05-17 — PDF : bucketing Y par `Math.round` cassé par baseline shift

## Ce qui a mal tourné
Import du PDF "Preux-au-Sart 14km" : 2 coureurs sur 464 (RICHARD #8, LECERF #243) importés avec leur **allure min/km** comme temps total (`00:03:58` au lieu de `00:55:37`). Bug invisible sur 462 autres lignes du même PDF → diagnostic faussement rassurant.

## Cause racine
Dans `src/scraping/parsers/pdf.js`, `regrouperParLigne` groupait les items par bucket de coordonnée Y via :
```js
const y = Math.round(it.transform[5] / TOL) * TOL; // TOL = 2
```
Sur ce PDF, les temps officiels sont rendus avec un **baseline shift de +0.18** vs le reste de la ligne (police bold). Pour la plupart des Y, les deux moitiés tombent dans le même bucket. Mais quand la partie fractionnaire de `Y/TOL` tombe juste avant `.5`, le +0.18 pousse le temps dans le bucket d'au-dessus :
- RICHARD : 578.96 → bucket 578 ; temps à 579.14 → bucket 580 → ligne coupée en deux.
- LECERF : 586.88 → 586 ; temps à 587.06 → 588.

Le temps officiel se retrouve seul → ligne sans nom, ignorée. La ligne résiduelle ne contient plus que `15.1 3:58` → l'allure est parsée comme temps.

## Règle pour éviter
**Ne jamais grouper des coordonnées flottantes par `Math.round(x/TOL)*TOL`** : ça crée des effets de frontière. Deux items à 0.2 d'écart peuvent tomber dans des buckets différents juste parce qu'ils encadrent un multiple de TOL.

→ Utiliser un **clustering linéaire** : trier par coordonnée, accumuler dans le cluster courant tant que `|y - yRef| < TOL`. Pas de frontière fixe, pas de coïncidence pathologique.

## Comment apparaît ce piège ailleurs
- Tout regroupement de positions PDF / canvas / OCR par `round/floor/ceil` d'une coordonnée continue.
- Bucketing de timestamps en buckets fixes pour des événements quasi-simultanés.
- Toute "tolérance" implémentée comme `truncate(x / step) * step` au lieu d'un vrai clustering.

## Garde-fou ajouté
Test canary `pdf — regrouperParLigne : baseline shift sub-pixel...` dans `tests/scraping.html` qui reproduit le cas RICHARD avec items synthétiques. Si quelqu'un revient à un bucketing par arrondi, le test pète.

## Détection (si symptôme similaire à l'avenir)
Symptôme : temps importé suspicieusement court (< 10 min sur une course longue) chez 1–3 coureurs isolés. Ne jamais conclure "import OK" parce que la grande majorité est correcte — vérifier les valeurs aberrantes individuellement.

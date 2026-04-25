# 2026-04-25 — Regex Unicode : piège des plages involontaires

## Symptôme

Le matching adhérent ↔ résultat ne fonctionnait plus :
- Dashboard : tous les compteurs à 0
- Fiche adhérent : "Aucun résultat enregistré"
- Tests `tokensEquivalents('Corenthin', 'Corenthin')` retournait `false`

## Cause

Dans `normaliser()` (matching/normalize.js et utils/text.js), j'avais écrit pour normaliser les caractères Unicode :

```js
.replace(/[‐-―−]/g, '-')           // tirets
.replace(/[  -​  　]/g, ' ')      // espaces
```

Le but : matcher quelques caractères Unicode spécifiques (em-dash, NBSP, etc.).

Le piège : dans une regex, `[A-Z]` est une PLAGE de caractères. Quand on met des caractères Unicode séparés par `-`, on crée des plages potentiellement immenses :
- `[‐-―]` matche tous les caractères de U+2010 à U+2015 (et au passage des dizaines d'autres entre les deux)
- Encore pire avec les espaces : `[    ​ ...]` peut créer des plages couvrant toutes les lettres ASCII si l'ordre des codepoints le permet

Conséquence : `normaliser('Corenthin')` mangeait des lettres ASCII et retournait une chaîne vide ou tronquée, cassant tout le matching en aval.

## Fix

Réécrire les regex avec des escape Unicode explicites, sans aucun `-` entre les caractères :

```js
.replace(/[‐‑‒–—―−]/g, '-')
.replace(/[    ​ 　]/g, ' ')
```

Pas de plage possible. Comportement clair et stable, indépendant de l'éditeur ou de l'encodage du fichier.

## Règle à retenir

Pour les regex qui ciblent une LISTE de caractères Unicode spécifiques (pas une plage volontaire) :
- TOUJOURS utiliser les escape `\uXXXX`
- NE JAMAIS écrire les caractères en clair s'il peut y avoir un `-` interprétable comme plage
- Si vraiment on veut écrire en clair, mettre un `\` devant chaque `-` ou les caractères tels que `[a\-b]`

L'écriture en clair multibyte est tolérante visuellement mais fragile : un éditeur peut convertir un caractère, un copier-coller peut introduire un caractère invisible, et la regex ne se plaint pas — elle matche silencieusement la mauvaise chose.

## Angle mort

Ce bug n'apparaissait qu'à l'usage RÉEL (sur la Sheet de l'utilisateur), parce que les fixtures de `tests/matching.html` utilisent des chaînes simples qui passent quand même. Les tests automatisés ne l'ont pas attrapé.

À l'avenir : ajouter un cas test sur `normaliser('Corenthin')` qui assert le retour exact, pour que ce genre de régression sur le pipeline de normalisation soit immédiatement visible.

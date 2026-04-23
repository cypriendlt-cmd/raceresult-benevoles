# Décisions d'architecture initiales

**Date :** 2026-04-23
**Contexte :** J0 — pivot produit de "matching bénévoles sur une course" → "plateforme club d'historisation"

## Problème

Le produit existant est un outil d'une-course-à-la-fois, sans persistance partagée :
- `localStorage` comme unique stockage (par navigateur, non collaboratif)
- Aucune notion d'historique, de dédup, ou de fiche adhérent
- Un fichier `index.html` de 2313 lignes

La demande (mémoire du club, historiques, matching à score, overrides persistés) suppose une base partagée. Le pivot produit n'est pas qu'une évolution.

## Leçons

1. **Avant de toucher le code, tranchér la persistance.** Toute archi frontale est dépendante de ce choix. Une mauvaise décision ici est quasi-impossible à rattraper sans réécriture.

2. **Google Sheets comme DB est viable mais avec un plafond connu** (~20-30k lignes avant lenteur). À documenter dès le début, pas "plus tard".

3. **Écrire dans un Sheet depuis un site statique = Apps Script Web App.** Pas d'autre voie propre. Documenter le déploiement comme dépendance de projet (pas comme détail).

4. **`localStorage` n'est JAMAIS une source de vérité métier** dans une app destinée à plusieurs utilisateurs. Uniquement cache + préférences user.

5. **La couche d'accès doit être une façade remplaçable** (`src/store/index.js`). Si on doit migrer Sheets → SQLite un jour, on ne touche que cette couche.

## Décisions actées

- Option **A1** : static + Sheets as DB + Apps Script pour écritures
- Option **B1** : étendre le schéma adhérents (colonnes sexe, DDN, groupe, alias) — mais dans un **nouveau Sheet dédié** "base club v2", pour ne pas casser l'outil bénévoles v1 existant
- Auth écriture Apps Script : **token partagé simple** (anti-bot minimal), pas d'OAuth
- UI : ton **"régularité + mémoire"**, pas podium-first
- Modules ES6 natifs, pas de build step
- `index.html` sera découpé en `src/{store,scraping,matching,ui,utils}/`

## Preuve / lien

- Audit initial : conversation du 2026-04-23
- CLAUDE.md §2 (architecture verrouillée)

# Adhérents sans ID → matching vide

**Date :** 2026-04-23
**Contexte :** J5 — premier test de la vue Import en conditions réelles

## Problème

Le Sheet `Adherents` a la colonne `id` prévue au schéma mais **vide** pour les 65 adhérents (normal : on n'a pas encore de mécanisme qui les remplit). Le matcher fait `if (!adh.id) continue;` → il saute tous les adhérents → tout le monde sort `absent`.

## Leçon

1. **Ne jamais faire dépendre le matching de données optionnelles non garanties.** Le schéma disait "id obligatoire" mais la réalité du Sheet disait autre chose. La couche `store/` doit **combler les manques** de manière transparente et stable, pas propager le vide.

2. **Un ID généré déterministiquement à partir de `(prenom, nom)` normalisés** est stable entre les lectures et peut être persisté plus tard. `stableId('adh', prenom, nom)` (hash djb2 en base36) suffit tant que le couple reste unique — si deux adhérents partagent prénom+nom exact, il faudra leur donner un ID manuel distinct.

3. **Même logique pour les autres colonnes mal formées** : `actif` sort en `TRUE`/`FALSE` (booléen Sheets) au lieu de `oui`/`non` prévu au schéma. Normalisé à la lecture.

## Correctif appliqué

`src/store/index.js` ajoute un `normaliserAdherents()` appliqué avant cache :
- id manquant → `stableId('adh', prenom, nom)`
- `actif` TRUE/VRAI/1 → "oui", sinon "non"
- lignes vides filtrées

## À prévoir (pas fait maintenant)

- Bouton "Synchroniser les IDs adhérents" qui écrit les ids générés dans le Sheet — une fois, puis plus jamais de génération à la volée.
- Détection des doublons (prenom+nom identiques) avec avertissement.

## Preuve / lien

- [src/store/index.js](../src/store/index.js) `normaliserAdherents()`
- [src/utils/id.js](../src/utils/id.js) `stableId()`

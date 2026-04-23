# Stratégie de tests — choix HTML vs Vitest

**Date** : 2026-04-23
**Contexte** : J3 — refonte scraping modulaire, besoin d'un runner léger.

## Décision

**Option B — page HTML de tests** (`tests/scraping.html`), cohérente avec la
`tests/smoke.html` existante.

## Raisons

1. **Zéro dépendance de build.** L'architecture verrouillée (CLAUDE.md §2) interdit
   tout bundler. Ajouter Vitest implique un `node_modules` local pour le dev —
   surface d'entretien non justifiée pour ce volume de code.
2. **Parseurs HTML/XML nécessitent `DOMParser`.** En Node, Vitest requiert
   `happy-dom`/`jsdom` : dépendance supplémentaire, divergence subtile avec le
   vrai navigateur. L'HTML runner teste dans l'environnement de production.
3. **Continuité.** L'utilisateur a déjà validé 4/4 smoke tests en HTML. Même
   modèle mental, même moyen d'exécution.
4. **`fetch` des fixtures** fonctionne tel quel depuis un simple
   `python -m http.server`.

## Coûts assumés

- Pas de CI automatisée (pas de `npm test`). Acceptable tant que le projet
  est piloté manuellement à distance de quelques mains.
- Pas de "--watch". Rafraîchir la page = acceptable.
- Moins d'outillage (pas de snapshot, pas de coverage). On s'en passe volontiers
  à ce stade.

## Quand basculer vers Vitest

- Si l'équipe grossit (>2 contributeurs réguliers).
- Si le projet obtient une vraie CI (GitHub Actions complet).
- Si le nombre de tests dépasse ~200 → la page HTML devient lourde.

## Comment exécuter

```bash
cd raceresult-benevoles
python -m http.server 8000
# puis ouvrir http://localhost:8000/tests/scraping.html
```

Exit code : s'appuyer sur l'affichage visuel (bandeau vert/rouge). Les détails
d'échec sont dans chaque bloc `.test.ko`.

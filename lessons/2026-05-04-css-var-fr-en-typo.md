# Typo `--c-bleu` vs `--c-blue` — variables CSS silencieusement inexistantes

**Date** : 2026-05-04
**Symptôme** : Sur la fiche adhérent, section "Régularité par année", les barres de l'histogramme étaient invisibles. Seuls les libellés d'année et le compteur s'affichaient — espace vide à la place de la barre colorée.

## Cause racine

Dans [src/ui/views/member.js:143](src/ui/views/member.js#L143) et [src/ui/components/adherent-form.js:14](src/ui/components/adherent-form.js#L14) le code utilisait `var(--c-bleu)` (français), alors que la variable réellement définie dans [src/ui/styles.css:14](src/ui/styles.css#L14) est `--c-blue` (anglais).

Quand `var()` référence une variable CSS qui n'existe pas et qu'aucun fallback n'est fourni, la déclaration est invalide → la propriété `background` (ou `border-color`) est ignorée silencieusement. Aucune erreur console, aucun warning.

## Règle

- Le nommage des tokens CSS du projet est **en anglais** : `--c-blue`, `--c-yellow`, `--c-brown`, `--c-cream`, `--c-ink`, `--c-border`, `--c-ok`, `--c-warn`, `--c-err`. Source de vérité : [src/ui/styles.css](src/ui/styles.css) bloc `:root`.
- Le reste du code (commentaires, variables JS, messages UI) est en français — d'où le piège : on glisse naturellement vers `--c-bleu`/`--c-jaune`/`--c-rouge` qui n'existent pas.
- En cas de doute, toujours `grep` la définition dans `styles.css` avant d'écrire un `var(--…)`.

## Détection future

Quand un élément stylé via `var(--…)` n'apparaît pas (couleur transparente, bordure absente, etc.), inspecter le DOM avec DevTools : si la propriété est barrée ou absente du panneau Computed, c'est probablement une variable inexistante. Ajouter un fallback systématique aiderait : `var(--c-blue, #08afee)` — mais ça masque le bug à la prochaine occurrence. Mieux vaut grep avant d'écrire.

## Fichiers corrigés

- [src/ui/views/member.js:143](src/ui/views/member.js#L143)
- [src/ui/components/adherent-form.js:14](src/ui/components/adherent-form.js#L14)

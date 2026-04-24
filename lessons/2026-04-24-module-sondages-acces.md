# 2026-04-24 — Module sondages : stratégie d'accès admin / adhérent

## Contexte

Ajout d'un module "Courses ciblées / Sondages de participation" à l'app Base Club. Le bureau doit pouvoir créer des courses ciblées, les adhérents doivent pouvoir y répondre (oui/non/peut_etre), **avec le même lien d'application**.

## Contrainte structurante

L'app est **100% statique** (GitHub Pages, modules ES6, pas de build, pas de serveur de session). Toute logique qui tourne dans le navigateur est visible par quiconque ouvre les devtools. Le token Apps Script existant (`SHARED_TOKEN`) est **déjà embarqué dans le bundle** (`src/config.js`).

Conséquence : **aucun rôle côté front n'est une frontière de sécurité**. Masquer l'UI admin empêche un clic accidentel, pas un adhérent motivé.

## Décision (tranchée 2026-04-24 — option B discutée en conversation)

**Aucune frontière backend n'est mise en place.** L'utilisateur a arbitré après débat : le repo GitHub est public, aucune donnée sensible, le risque d'intégrité (troll externe qui vandaliserait la Sheet) est jugé négligeable sur un projet d'asso confidentiel. Refus explicite de gérer un second token côté Apps Script.

1. **Apps Script inchangé côté auth** : un seul `SHARED_TOKEN`, qui autorise les écritures sur **tous** les onglets autorisés, `CoursesCiblees` inclus. La whitelist `ALLOWED_SHEETS` est étendue aux 2 nouveaux onglets, c'est tout.

2. **Côté front : pseudo-login UX-only** :
   - Mot de passe en clair dans [src/config.js](../src/config.js) sous la clé `ADMIN_PASSWORD`.
   - [src/auth/session.js](../src/auth/session.js) : `loginAdmin()` / `isAdmin()` / `logoutAdmin()` via `sessionStorage` (expire à la fermeture de l'onglet).
   - **Toutes les vues "Base Club"** (`#/dashboard`, `#/import`, `#/imports`, `#/resultats`, `#/membre`, `#/club`, `#/revue`, `#/course`) sont gardées par `guardAdmin()` dans [src/main.js](../src/main.js) → un non-admin qui tape l'URL est redirigé vers `#/sondages`.
   - Seule `#/sondages[/id]` est publique.
   - Nav : les liens bureau (cf. `BUREAU_HREFS` dans main.js) sont masqués si pas admin. Un adhérent voit `Sondages` et `Admin` (qui mène au login).
   - Route par défaut à l'ouverture : `#/dashboard` pour admin, `#/sondages` pour tout le monde sinon.
   - **Bypassable en 1 ligne de devtools** : `sessionStorage.setItem('chtis.admin', '1')`. Acceptable car le public cible (adhérents du club) n'est pas motivé à contourner.

## Limites assumées

- **Risque d'intégrité backend** : n'importe qui découvrant le `SHARED_TOKEN` dans le repo public peut créer / modifier / supprimer des courses ciblées et des réponses via POST direct à l'Apps Script. Vandalisme trivial, aucune protection en place. Utilisateur au courant et acceptant.
- **Risque local (club)** : un adhérent curieux qui tape `sessionStorage.setItem('chtis.admin', '1')` dans la console accède à l'UI admin. Considéré comme non-menace.
- Un adhérent peut enregistrer une réponse **au nom d'un autre adhérent** s'il connaît son prénom/nom. Mitigation v2 possible si ça arrive : champ `created_by_ip_hash`.
- Pas de log d'accès admin. Si un jour on veut tracer, ajouter `created_by` / `updated_by` dans `CoursesCiblees` alimentés côté front (toujours déclaratifs donc).

## Déclencheurs de revisite

Remettre ce choix sur la table si **un** des événements suivants se produit :
- Vandalisme concret constaté (courses bidon, réponses effacées)
- Le repo passe privé → tout devient plus simple, ré-évaluer
- Migration vers l'option A2 (backend + SQLite) → ajouter une vraie auth à ce moment-là, une seule fois

## Règle à retenir

> Dans cette stack, "cacher une vue côté front" ne sécurise rien. Toute contrainte d'intégrité doit être implémentée côté Apps Script (2e token + whitelist). Quand on choisit de ne PAS le faire, on l'écrit noir sur blanc dans un fichier lesson — pas on prétend qu'on l'a résolu côté front. Ici, choix assumé de ne rien protéger côté backend (cf. section "Limites assumées").

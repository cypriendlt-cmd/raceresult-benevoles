# TODO — Plateforme résultats Ch'tis Marathoniens

> Backlog par jalons. Voir [CLAUDE.md](CLAUDE.md) pour l'architecture.

## Légende
- [ ] à faire
- [~] en cours
- [x] fait
- ❗ bloquant utilisateur

---

## J1 — Cadre & docs (en cours)

- [x] Audit de l'existant (2026-04-23)
- [x] Décisions architecture (A1 / B1) verrouillées
- [x] CLAUDE.md projet rédigé
- [x] todo.md créé
- [x] lessons/ amorcé
- [x] docs/SHEETS_SCHEMA.md — schéma des 4 onglets
- [x] docs/APPS_SCRIPT.md — procédure de déploiement
- [x] docs/apps-script-web-app.gs — code Web App prêt à copier
- [ ] ❗ **Utilisateur** : créer un NOUVEAU Sheet dédié "Base Club" avec les 5 onglets
- [ ] ❗ **Utilisateur** : copier les adhérents existants dans l'onglet `Adherents`
- [ ] ❗ **Utilisateur** : déployer l'Apps Script Web App (token aléatoire)
- [ ] ❗ **Utilisateur** : fournir Sheet ID + URL Web App + token
- [ ] Plan de découpage de `index.html` vers modules ES6 validé

## J2 — Modèle de données + persistance Sheets

- [x] `src/config.js` : centraliser PROXY / SHEET_ID / SCRIPT_URL / TOKEN
- [x] `src/utils/csv.js` : parser CSV RFC 4180 + rowsToObjects
- [x] `src/utils/id.js` : IDs stables (courseId / resultatId / importId)
- [x] `src/store/sheets.js` : lecture par onglet via CSV export gviz
- [x] `src/store/appsScript.js` : client POST batch (text/plain anti-preflight)
- [x] `src/store/cache.js` : cache localStorage + TTL + invalidation
- [x] `src/store/index.js` : façade (read.*, saveImport, saveAdherent, saveOverride, refreshAll)
- [x] `tests/smoke.html` : page de validation bout-en-bout
- [x] ❗ **Utilisateur** : smoke test validé (4 boutons verts 2026-04-23)
- [x] Correctif CORS : proxy Cloudflare Worker étendu POST + preflight ([lessons](lessons/2026-04-23-apps-script-cors.md))
- [ ] Tests unitaires CSV + IDs (reporté J6)
- [ ] Normalisation `date_naissance` DD/M/YYYY ↔ ISO (J4)
- [ ] Normalisation `actif` TRUE/FALSE ↔ oui/non (J4)

## J3 — Refonte scraping modulaire (2026-04-23)

- [x] Extraire les 8 parsers vers `src/scraping/parsers/*.js`
- [x] `src/scraping/detect.js` : détection source par URL
- [x] `src/scraping/normalize.js` : normalisation commune (temps, date, catégorie)
- [x] Chaque parser retourne `{ courses: [{ course, lignes }, ...] }` (convention
      multi-parcours uniforme)
- [x] Utilitaires partagés `src/utils/{text,time,date,proxy}.js`
- [x] Fixtures par parser dans `tests/fixtures/` (happy + dégénéré)
- [x] Tests "canary" pour `athleFr`, `genericHtml`, `nordsport`
- [x] Gestion erreurs : chaque parser lève une exception française explicite
- [x] Runner de tests `tests/scraping.html` (choix HTML vs Vitest :
      [lessons](lessons/2026-04-23-tests-strategy.md))
- [~] Fixtures "canary" faites sur HTML synthétique ressemblant — à remplacer
      par captures réelles dès qu'on a des URLs valides sous la main
- [ ] Couche preview (aperçu avant écriture, exclusion manuelle) — reportée J5
      (c'est de l'UI, pas du scraping)

## J4 — Matching à score + overrides (2026-04-23)

- [x] `src/matching/normalize.js` : accents, casse, tokens, particules, helpers homonymes, sexeCompatible
- [x] `src/matching/score.js` : `certain` / `probable` / `douteux` / `ambigu` / `absent` / `manuel` + scoring 0-100
- [x] Consolidation homonymes : détection index nom, ambigu forcé si prénom court/initiale + nom homonyme
- [x] Cross-check sexe (pénalité 25 points si incompatible)
- [x] `src/matching/overrides.js` : alias / force_match / refuse_match + scope global/course
- [x] `src/matching/index.js` : façade
- [x] `tests/matching.html` : 13 cas — **13/13 OK validés 2026-04-23**
- [ ] Consolidation avec `src/utils/text.js` (duplication `normaliser`/`tokeniserNom` — à fusionner J6)

## J5 — UI 6 vues (en cours)

- [x] `src/ui/styles.css` : design tokens Ch'tis, palette, régularité-mémoire, mobile
- [x] `src/ui/router.js` : hash-based minimal avec params
- [x] `src/ui/components/helpers.js` : `el()`, `badge()`, `alert()`, `spinner()`, `escape()`
- [x] `src/ui/views/import.js` : Vue 1 — scrape → match preview → exclusion → validation → persist
- [x] `src/main.js` : bootstrap + routes
- [x] `app.html` : nouveau shell (v2), `index.html` v1 intact
- [x] Vue 2 — Historique imports
- [x] Vue 3 — Tableau global résultats (filtres adhérent / course / distance / période / statut + tri + lien vers fiche)
- [x] Vue 4 — Fiche adhérent (identité, stats par distance, meilleurs temps, régularité par année, historique chrono)
- [x] Vue 5 — Historique du club (par année, liste courses + participants)
- [x] Vue 6 — Correspondances à valider (alias / refuse_match / laisser absent)
- [x] Règle matching simplifiée : uniquement `certain` / `ambigu` / `absent` (plus de probable/douteux)
- [x] Suppression d'import (vue 2) — supprime résultats + éventuellement course orpheline
- [x] Dédup à l'import : détection course existante par `source+event_id` ou `nom+date` → remplacement confirmé
- [x] Fiche adhérent : fallback match par prénom/nom normalisés si `adherent_id` manquant
- [x] Historique club : extraction d'année robuste (ISO, DD/MM/YYYY, TS) + tri dates multi-format
- [x] Apps Script : actions `deleteMany` (liste d'IDs) + `deleteWhere` (filtre colonne=valeur)
- [ ] ❗ **Utilisateur** : redéployer l'Apps Script (nouvelle version) pour activer `deleteMany`/`deleteWhere`

## J6 — Refactor (réduit, 2026-04-25)

Couverture tests existante (matching 13/13, sondages unitaires+intégration, scraping canary) considérée suffisante. J6 recentré sur dédup et simplifications.

- [x] Fusion `normaliser` : version robuste (NBSP, tirets Unicode) promue dans `src/utils/text.js`, source unique
- [x] Fusion `tokeniserNom` : version normalisée (`split(/[^a-z]+/)`) dans `src/utils/text.js`
- [x] `src/matching/normalize.js` réexporte les 2 depuis `utils/text.js` (zéro casse upstream)
- [x] `src/utils/date.js` : ajout `formatDate(iso, 'long'|'short'|'datetime')` + `isPast(iso)`
- [x] Suppression des 5 copies locales de `formatDate` (sondages-list/detail, admin-courses-list, admin-poll-detail, imports-history)
- [x] Suppression des 2 copies locales de `isPast`
- [x] Suppression des `lc = s => ...NFD...` inline dans sondages-detail.js + matching-review.js → `normaliser` utilisé partout
- [x] **Utilisateur** : tests passés (validation 2026-04-25)

## J8 — Module sondages / courses ciblées (en cours, 2026-04-24)

**Décisions** : voir [lessons/2026-04-24-module-sondages-acces.md](lessons/2026-04-24-module-sondages-acces.md).
MVP strict : réponses = oui/non/peut_etre seulement. Pas de covoit, logement, commentaire, distance, export (v2).

### Vague 1 — Fondations (faite 2026-04-24)
- [x] Apps Script : whitelist étendue à `CoursesCiblees` + `ReponsesSondage` (pas d'ADMIN_TOKEN — option B)
- [x] `src/config.js` : nouveaux noms d'onglets + `ADMIN_PASSWORD`
- [x] `docs/SHEETS_SCHEMA.md` : §6 `CoursesCiblees` + §7 `ReponsesSondage`
- [x] `lessons/2026-04-24-module-sondages-acces.md` : décision finale (option B, zéro auth backend assumé)
- [x] **Utilisateur** : onglets créés dans la Sheet
- [ ] ❗ **Utilisateur** : redéployer l'Apps Script (nouvelle version) pour activer la whitelist étendue + `deleteMany`/`deleteWhere` de J5

### Vague 2 — Store + auth (faite 2026-04-24)
- [x] `src/store/sondages.js` : `listCoursesCiblees`, `listCoursesPubliees`, `getCourseCiblee`, `listReponses`, `listReponsesPourCourse`, `compterReponses`, `saveCourseCiblee`, `deleteCourseCiblee`, `saveReponse`, `trouverReponseExistante`
- [x] `src/auth/session.js` : `loginAdmin(password)` / `isAdmin()` / `logoutAdmin()` (sessionStorage, UX-only)
- [x] `src/main.js` : routes câblées (`#/sondages[/id]`, `#/admin[/courses[/new|id]|/sondage/id]`) avec dispatch sur params
- [x] Nav : lien `Sondages` + `Admin` ajoutés dans `app.html` et `index.html`, `Admin` masqué si pas connecté (`refreshAdminNav` à chaque hashchange)
- [x] Stubs de vues fonctionnelles (non-polies) : `sondages-list.js`, `sondages-detail.js`, `login-admin.js`, `admin-courses-list.js`, `admin-course-edit.js`, `admin-poll-detail.js`

### Vague 3bis — Choix de distance (2026-04-24)
- [x] Nouvelle colonne `distance_choisie` dans `ReponsesSondage` (cf. `docs/SHEETS_SCHEMA.md` §7)
- [x] `parseDistances()` helper dans `src/store/sondages.js` (split `,` ou `;`, trim, filter)
- [x] `saveReponse` accepte `distance_choisie` optionnel
- [x] Sondage adhérent : si course ≥ 2 distances → sélecteur en pills, visible seulement si `reponse=oui`, obligatoire ; si 1 seule distance → affectée implicitement ; sinon rien
- [x] Affichage dans "Qui a répondu" : `Jean Dupont · 10 km`
- [x] Nouvelle colonne `Distance` dans le tableau admin réponses
- [ ] ❗ **Utilisateur** : ajouter la colonne `distance_choisie` à droite de `reponse` dans l'onglet `ReponsesSondage` de la Sheet

### Vague 3 — Vues adhérent (mobile-first) — faite 2026-04-24
- [x] `src/ui/views/sondages-list.js` : grille de cartes (hover lift), hero `card-feature`, badge statut (Ouvert/Clôturé/Délai dépassé), compteurs par carte, dates en français
- [x] `src/ui/views/sondages-detail.js` : en-tête feature, 3 totaux en gros chiffres (oui/peut-être/non), radios segmented, liste participants en 3 colonnes triées
- [x] Identification : champ unique `<input list>` + `<datalist>` depuis `read.adherents()`, matching insensible accents/casse au submit, attache `adherent_id` si retrouvé, saisie libre si non
- [x] Gates écriture : statuts `cloturee` / `archivee` / date_limite dépassée → bandeau + formulaire retiré ; `brouillon` → bandeau info (admin-only); `autoriser_modif_reponse === 'non'` + déjà répondu → refus explicite
- [x] Correction des `alert('success'/'error')` → `alert('ok'/'err')` dans toutes les vues admin + login (les styles `alert-success` / `alert-error` n'existaient pas)
- [x] CSS module sondages : `.sondages-grid`, `.sondage-card`, `.sondage-totaux`, `.reponse-choices` (radios stylés via `:checked + label`), `.participants-cols`, breakpoints mobile (colonnes → pile verticale, radios pleine largeur)

### Vague 4 — Vues admin
- [ ] `src/ui/views/login-admin.js` : saisie token admin
- [ ] `src/ui/views/admin-courses-list.js` : liste + statut + compteur réponses + actions
- [ ] `src/ui/views/admin-course-edit.js` : formulaire créa/édition/suppression
- [ ] `src/ui/views/admin-poll-detail.js` : résumé + tableau réponses (3 compteurs)

### Vague 5 — Tests + simplif
- [x] `tests/sondages.html` : unitaires (parseDistances, compterReponses, IDs stables), intégration (cycle CRUD course + cycle CRUD réponse avec cleanup), checklist manuelle (14 points)
- [ ] Passage simplifier sur les nouveaux modules
- [ ] Vérifs mobile 375 / 768 / desktop

### Préremplissage (2026-04-24)
- [x] Écoute `change` sur le champ identité dans sondages-detail.js
- [x] `trouverDansReponses()` cherche par adherent_id d'abord, sinon par prénom+nom normalisés
- [x] Pré-coche la réponse (dispatch `change` pour ré-afficher la distance le cas échéant)
- [x] Pré-coche la `distance_choisie` si présente
- [x] Bandeau bleu discret "Tu as déjà répondu le X — tu peux modifier ci-dessous"

---

## J6.5 — Responsive mobile (2026-04-25)

### Tables admin en mode cartes (stack) sur mobile
- [x] Classe `.tbl-stack` : sur mobile (≤ 600px), thead masqué, chaque `<tr>` devient une carte, chaque `<td>` est un binôme label (depuis `data-label`) / valeur
- [x] `admin-courses-list.js` : ajout `tbl-stack` + `data-label` sur chaque td (Course, Date, Statut, Réponses, Actions)
- [x] `admin-poll-detail.js` : idem (Nom, Prénom, Réponse, Distance, Mise à jour, '' pour bouton supprimer)
- [x] Cellule `data-label=""` : pleine ligne alignée à droite (pour le bouton ✕)

### Responsive général

- [x] Viewport `maximum-scale=1, user-scalable=no` sur `app.html` + `index.html` (anti-pattern accessibilité assumé)
- [x] `body { overflow-x: hidden }` filet de sécurité contre tout débordement page
- [x] Classe `.tbl-wrap` (overflow-x:auto) pour les tables admin → scroll horizontal LOCAL à la table, pas à la page
- [x] Wrapper `.tbl-wrap` ajouté dans `admin-courses-list.js` + `admin-poll-detail.js` (remplace l'ancien `overflow:hidden` qui clippait)
- [x] Mobile @780 : compteurs réduits, déco `card-feature::after` masquée, hero-stats en 2 colonnes
- [x] Très petit @360 : densification supplémentaire (paddings, font-sizes)

## J7 — Doc finale + roadmap extensions

- [ ] README.md mis à jour (nouveau produit, plus seulement bénévoles)
- [ ] CLAUDE.md rafraîchi
- [ ] lessons/ consolidées
- [ ] Roadmap extensions documentée :
  - [ ] Génération posts Facebook automatique
  - [ ] Export CSV/Excel/PDF
  - [ ] Stats annuelles club
  - [ ] Fiche course détaillée
  - [ ] Pages souvenirs / galerie
  - [ ] Classement interne informatif (opt-in)

---

## Bugs connus (existant)

- [ ] Parser `genericHtml` casse silencieusement sur sites non standards
- [ ] Parser `Athle.fr` : scraping HTML brittle (dépend du markup exact)
- [ ] Proxy Cloudflare Worker ouvert (pas de whitelist)
- [ ] localStorage non partagé entre navigateurs → impossible collaboration aujourd'hui

## Améliorations futures (post-J7)

- [ ] Migration vers option A2 (backend + SQLite) si dépassement limite Sheets
- [ ] PWA / offline
- [ ] Notifications push bénévoles après import
- [ ] Détection automatique nouvelles courses depuis calendriers régionaux

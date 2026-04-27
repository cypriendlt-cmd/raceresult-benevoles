# Ch'tis Marathoniens — Base Club

Application web statique pour le club de course **Les Ch'tis Marathoniens** (~65 adhérents). Centralise la mémoire des participations et coordonne les sondages de courses ciblées.

## Deux modules

### 1. Base de données du club (réservé au bureau)

- **Import de résultats** depuis RaceResult, ProLiveSport, ChronoRace/ACN, Athle.fr, Nordsport, ou fichier PDF/CSV
- **Matching automatique** entre les noms des classements et la liste des adhérents (tolérant aux fautes, accents, ordre, particules)
- **Arbitrage** des cas ambigus (homonymes, initiales)
- **Tableau global** des résultats avec filtres (adhérent, course, distance, date, statut)
- **Fiche adhérent** : meilleurs temps par distance, régularité par année, historique
- **Chronique du club** par année

### 2. Sondages de courses ciblées (ouvert aux adhérents)

- Le bureau publie une course ciblée (date, lieu, distances proposées, liens d'inscription)
- Les adhérents répondent **oui / non / peut-être** + choisissent une distance si la course en propose plusieurs
- Modification de réponse autorisée (configurable par course)
- Liste des participants visible par tous (configurable)
- Préremplissage automatique : un adhérent qui a déjà répondu retrouve son choix coché à la prochaine visite

## Stack

- HTML / CSS / JS vanilla, **modules ES6 natifs**, zéro build, zéro dépendance npm
- Hébergement : **GitHub Pages** (déploiement auto via `.github/workflows/deploy.yml`)
- Base de données : **Google Sheet** (7 onglets — voir [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md))
- Lecture : export CSV public via **Cloudflare Worker** (proxy CORS)
- Écriture : **Google Apps Script Web App** (voir [docs/APPS_SCRIPT.md](docs/APPS_SCRIPT.md))
- Auth bureau : mot de passe local en `sessionStorage` (UX uniquement, pas une vraie sécurité — voir CLAUDE.md §3ter)

## Premier déploiement

1. **Sheet** : créer un nouveau Google Sheet avec les 7 onglets décrits dans [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md). Partager en lecture publique.
2. **Apps Script** : suivre [docs/APPS_SCRIPT.md](docs/APPS_SCRIPT.md) pour déployer le Web App d'écriture.
3. **Worker Cloudflare** : déployer [docs/cloudflare-worker.js](docs/cloudflare-worker.js).
4. **Front** : compléter `src/config.js` avec ton SHEET_ID, l'URL Apps Script, le token, et choisir un `ADMIN_PASSWORD` pour le bureau.
5. **GitHub Pages** : Settings → Pages → Source = GitHub Actions. Pousse sur `main`, le site se déploie en 1-2 min.

## Tests

Trois pages HTML qui se lancent dans le navigateur, sans runner :

- `tests/scraping.html` — fixtures par parser, canary sur Athle.fr / NordSport / generic
- `tests/matching.html` — 13 cas matching homonymes / particules / inversions
- `tests/sondages.html` — unitaires (parseDistances, compterReponses, IDs) + intégration (cycle CRUD réel sur la Sheet, cleanup automatique) + checklist manuelle

## Documentation

- [CLAUDE.md](CLAUDE.md) — architecture, décisions, modèle de données, état des jalons J0→J8
- [todo.md](todo.md) — backlog par jalon
- [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md) — schéma des 7 onglets
- [docs/APPS_SCRIPT.md](docs/APPS_SCRIPT.md) — déploiement du Web App
- [docs/ROADMAP.md](docs/ROADMAP.md) — extensions futures
- [lessons/](lessons/) — leçons accumulées (incidents, pièges, décisions)

## Limites assumées

- **Pas une vraie sécurité** côté front. Le repo est public, le SHARED_TOKEN est dans le bundle, n'importe qui qui le lit peut écrire dans la Sheet via POST. Risque d'intégrité accepté pour la simplicité (cf. CLAUDE.md §3ter).
- **Sheet plafonne** vers 20-30 k lignes. Si dépassement, migration prévue vers backend (option A2 — voir [docs/ROADMAP.md](docs/ROADMAP.md)).
- Apps Script a des **quotas** (6 min/exécution, 20 k lignes/écriture). Les opérations sont batchées pour rester dedans.

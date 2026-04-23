# CLAUDE.md — Plateforme résultats Ch'tis Marathoniens

> Ce fichier est la source de vérité **projet**. Lis-le en début de session.
> Pour les règles de collaboration (ton, workflow), voir [.claude/CLAUDE.md](.claude/CLAUDE.md).
- Ne sois jamais d'accord avec moi juste pour être agréable. Si j'ai tort, dis-le directement.
- Trouve les faiblesses et les angles morts dans ma réflexion. Signale-les même si je n'ai pas demandé.
- Pas de flatterie. Pas de « bonne question ! » Pas d'adoucissement inutile.
- Si tu n'es pas sûr de quelque chose, dis-le. Vérifie par des recherches et fournis-moi les sources.
- Résiste fermement. Force-moi à défendre mes idées ou à abandonner les mauvaises.

Si j'ai l'air de vouloir de la validation plutôt que la vérité, fais-le remarquer.
## DÉMARRAGE DE SESSION
1. Lire tasks/lessons.md — appliquer toutes les leçons avant de toucher quoi que ce soit
2. Lire tasks/todo.md — comprendre l'état actuel
3. Si aucun des deux n'existe, les créer avant de commencer

## WORKFLOW

### 1. Planifier d'abord
- Passer en mode plan pour toute tâche non triviale (3+ étapes)
- Écrire le plan dans tasks/todo.md avant d'implémenter
- Si quelque chose ne va pas, STOP et re-planifier — ne jamais forcer

### 2. Stratégie sous-agents
- Utiliser des sous-agents pour garder le contexte principal propre
- Une tâche par sous-agent
- Investir plus de compute sur les problèmes difficiles

### 3. Boucle d'auto-amélioration
- Après toute correction : mettre à jour tasks/lessons.md
- Format : [date] | ce qui a mal tourné | règle pour l'éviter
- Relire les leçons à chaque démarrage de session

### 4. Standard de vérification
- Ne jamais marquer comme terminé sans preuve que ça fonctionne
- Lancer les tests, vérifier les logs, comparer le comportement
- Se demander : « Est-ce qu'un staff engineer validerait ça ? »

### 5. Exiger l'élégance
- Pour les changements non triviaux : existe-t-il une solution plus élégante ?
- Si un fix semble bricolé : le reconstruire proprement
- Ne pas sur-ingénieriser les choses simples

### 6. Correction de bugs autonome
- Quand on reçoit un bug : le corriger directement
- Aller dans les logs, trouver la cause racine, résoudre
- Pas besoin d'être guidé étape par étape

## PRINCIPES FONDAMENTAUX
- Simplicité d'abord — toucher un minimum de code
- Pas de paresse — causes racines uniquement, pas de fixes temporaires
- Ne jamais supposer — vérifier chemins, APIs, variables avant utilisation
- Demander une seule fois — une question en amont si nécessaire, ne jamais interrompre en cours de tâche

## GESTION DES TÂCHES
1. Planifier → tasks/todo.md
2. Vérifier → confirmer avant d'implémenter
3. Suivre → marquer comme terminé au fur et à mesure
4. Expliquer → résumé de haut niveau à chaque étape
5. Apprendre → tasks/lessons.md après corrections

---

## 1. Contexte produit

Association de course à pied. On veut :
- Gagner du temps aux bénévoles qui saisissent les résultats.
- Centraliser et **historiser** les participations des adhérents.
- Consulter l'historique d'un adhérent ou du club.
- Conserver la **mémoire** du club, pas créer une ambiance compétitive.

Ton UI : **régularité + mémoire**. Pas de podium visible par défaut. Records personnels consultables mais discrets.

## 2. Architecture retenue (verrouillée)

### Stack
- **Frontend** : HTML / CSS / JS vanilla. **Modules ES6 natifs** (pas de build).
- **Hébergement** : GitHub Pages (comme aujourd'hui).
- **Proxy CORS lecture** : Cloudflare Worker existant (`raceresult-proxy.cypriendlt.workers.dev`).
- **Base de données** : **Google Sheets** (option A1 — décidée 2026-04-23).
- **Écriture dans Sheets** : **Google Apps Script déployé en Web App** (voir [docs/APPS_SCRIPT.md](docs/APPS_SCRIPT.md)).

### Contrainte majeure assumée
Sheets n'est **pas une vraie DB**. Limite pratique ~20-30 k lignes de résultats avant lenteurs. Si le club dépasse ce seuil, migration vers backend + SQLite (option A2) à prévoir — la couche d'accès (`src/store/`) est pensée pour être remplaçable.

### Schéma de données (4 onglets Sheet — voir [docs/SHEETS_SCHEMA.md](docs/SHEETS_SCHEMA.md))

| Onglet | Rôle |
|---|---|
| `Adherents` | Source de vérité des membres (colonnes étendues — option B1) |
| `Courses` | Une ligne = une course connue (clé stable) |
| `Resultats` | Une ligne = une participation (FK member + race) |
| `Matching_Overrides` | Décisions manuelles persistées (match forcé, refus) |
| `Imports` | Journal d'imports (date, source, URL, volume, user) |

### Modules frontend (plan de découpage)

```
index.html                  ← shell + mount points, charge src/main.js
src/
  main.js                   ← bootstrap + router
  config.js                 ← constantes (proxy, sheet IDs, script URL)
  store/
    sheets.js               ← lecture CSV public
    appsScript.js           ← écriture via Apps Script
    cache.js                ← cache localStorage + invalidation
    index.js                ← API façade (remplaçable pour migration A2)
  scraping/
    index.js                ← dispatch selon URL
    detect.js               ← détection type de page
    parsers/
      raceresult.js
      prolivesport.js
      acnTiming.js
      athleFr.js
      nordsport.js
      genericHtml.js
      pdf.js
      csv.js
    normalize.js            ← normalisation commune (nom/prénom/temps/date)
  matching/
    normalize.js            ← accents/casse/tokens
    score.js                ← score de confiance (certain/probable/douteux/absent)
    overrides.js            ← application des décisions manuelles
  ui/
    views/
      import.js
      imports-history.js
      results-table.js
      member.js
      club-history.js
      matching-review.js
    components/             ← atomes partagés
    router.js
    styles.css
  utils/
    text.js                 ← normaliser, stripHTML, splitNomPrenom
    time.js                 ← parsing de temps multi-format
    date.js
```

## 3. Flux de données (import d'une course)

```
URL saisie
  → scraping/detect.js identifie la source
  → parser spécialisé retourne { course_meta, lignes[] }
  → scraping/normalize.js standardise (temps, date, etc.)
  → matching/score.js classe chaque ligne (certain / probable / douteux / absent)
  → UI "preview" : bénévole valide / exclut / corrige les douteux
  → store/appsScript.js POST vers le Web App
      ├─ upsert Course (clé = source + eventId)
      ├─ insert Resultats (clé dédup = courseId + memberId + temps)
      ├─ log Import
      └─ save Matching_Overrides si validation manuelle
  → cache localStorage invalidé
```

## 3bis. Flux de scraping détaillé (module `src/scraping/`)

### Point d'entrée

```js
import { scrapeFromUrl, parseFile } from 'src/scraping/index.js';

const { courses } = await scrapeFromUrl('https://my.raceresult.com/285732/...');
// ou
const { courses } = await parseFile(fileInput.files[0]); // .pdf ou .csv
```

### Contrat de sortie (strictement uniforme pour tous les parseurs)

```js
{
  courses: [
    {
      course: {
        nom, date, lieu, distance_km, type, organisateur,
        source, source_event_id, url
      },
      lignes: [
        {
          prenom_source, nom_source,
          temps, temps_net, temps_sec,
          rang_general, rang_categorie,
          categorie, sexe_source, club_source, dossard
        }
      ]
    }
  ]
}
```

Convention multi-parcours : **toujours** retourner `{ courses: [...] }`, même
si un seul parcours. L'appelant itère uniformément.

### Pipeline

```
URL / File
  → detect.js (sniffs la source depuis l'URL)
  → parsers/<source>.js (fetch + parse brut)
  → normalize.js : normalizeLigne + normalizeCourse (forme canonique)
  → { courses: [...] }
  → (J4) matching/score.js : classification par ligne
  → (J4+) UI preview → store/appsScript saveImport
```

### Gestion d'erreurs

Chaque parseur lève une exception française avec contexte
(`"RaceResult : config introuvable pour l'événement 12345"`). L'appelant UI
catch et affiche. Pas de silent fail.

### Points fragiles (tests canary)

- `athleFr` : dépend du `<tr><td><a>` — canary sur fixture figée.
- `genericHtml` : heuristique scoring — canary sur fixture figée.
- `nordsport` : extraction iframe → clax — canary sur fixture XML.

## 4. Conventions de code

- **Français** pour commentaires, variables métier, messages UI (maintien de l'existant).
- **camelCase** JS, **kebab-case** CSS, **UPPER_CASE** constantes.
- Un fichier = une responsabilité. Pas de fichier > 300 lignes idéalement.
- Pas de framework. Modules ES6 natifs, `<script type="module">`.
- Tests : fixtures HTML/JSON capturées dans `tests/fixtures/`, runner Vitest **sans bundler** (Vitest accepte ESM natif).

## 5. Décisions structurantes

| Date | Décision | Raison |
|---|---|---|
| 2026-04-23 | Option A1 (static + Sheets as DB) | Pas de coût d'hébergement, continuité avec l'existant |
| 2026-04-23 | Option B1 (étendre le Sheet adhérents actuel) | Single source of truth, pas de doublon Sheet |
| 2026-04-23 | Apps Script Web App pour écritures | Seule voie propre en static pour écrire dans Sheets |
| 2026-04-23 | Modules ES6 natifs, pas de build | Déploiement GitHub Pages simple, zéro dépendance de build |
| 2026-04-23 | UI "régularité + mémoire", pas "podium" | Brief utilisateur — ambiance club |

## 6. Points de vigilance

1. **localStorage par navigateur** → ne PAS y stocker de données métier persistantes. Uniquement cache + préférences user. Source de vérité = Sheets.
2. **Apps Script a des quotas** (20 k lignes/exec, 6 min/exec). Écritures batchées, pas ligne-par-ligne.
3. **Dedup** : clés composées stables, jamais de reliance sur l'ordre des lignes du Sheet.
4. **Parsers fragiles** (Athle.fr, générique HTML) : chaque changement de markup casse silencieusement. Ajouter des tests "canary" sur fixtures.
5. **Matching** : ne JAMAIS écraser un override manuel par un re-scan automatique.
6. **Proxy Cloudflare Worker** : proxy ouvert sans whitelist — pas bloquant aujourd'hui, à whitelister si trafic monte.

## 7. État actuel du projet

Voir [todo.md](todo.md) pour l'état détaillé par jalon.

- [x] J0 — Décisions A1 / B1 / ton UI (2026-04-23)
- [x] J1 — Cadre & docs (2026-04-23)
- [x] J2 — Modèle de données + persistance Sheets (smoke test 4/4 verts, 2026-04-23)
- [x] J3 — Refonte scraping modulaire (2026-04-23)
- [ ] J4 — Matching à score + overrides
- [ ] J5 — UI 6 vues
- [ ] J6 — Tests + refactor
- [ ] J7 — Doc finale + roadmap extensions

## 8. Pour démarrer une session

1. Lis ce fichier + [todo.md](todo.md).
2. Scanne [lessons/](lessons/) pour les apprentissages accumulés.
3. Reprends au jalon en cours.

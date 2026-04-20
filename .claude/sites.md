# Sources de résultats supportées

Tracker incrémental des sites/formats de résultats. L'objectif : qu'à terme n'importe quel lien soumis à l'app soit parsable.

**Stratégie** — Un adapter dédié > HTML générique > PDF. Quand un nouveau site casse, on ajoute un parser spécifique + test de régression (Python replay).

## Adapters dédiés

| Source | URL pattern | Format | Fonction | Notes |
|---|---|---|---|---|
| RaceResult | `my*.raceresult.com`, `events.raceresult.com` | JSON API 2-steps | `recupererResultatsDepuisRaceResult()` | `/data/config` → `key/server/listname` puis `/data/list?contest=0&r=all`. `parcours` = contestLabel |
| ACN Timing | `acn-chrono.fr`, `acn-timing.com` | JSON API | `recupererResultatsDepuisACN()` | `Groups[].SlaveRows`, mapping via `TableDefinition.Columns` (FieldIdx) |
| athle.fr (FFA) | `bases.athle.fr` | HTML ASP.NET paginé | `recupererResultatsDepuisAthleFr()` | pagination `frmposition=0..N`, 250/page, fetch parallèle. `parcours=''` (1 course par URL) |
| Nordsport | `nordsport-chronometrage.fr` | HTML iframe → XML `.clax` | `recupererResultatsDepuisNordsport()` | iframe src → `?f=…clax`, XML UTF-8 BOM, `<Engages>`+`<Resultats>` joints par bib `d`, `parcours` = attribut `p` |
| ChronoLap | `chronolap.net` (PDF) | PDF multi-courses | `parseLignesPDF()` (token-parser generique) | Format `Rang. Dos NOM Prenom (n) M/F (n) Cat Club Temps [ TpsNet ] Vit Moy`. Sections `30km (...)` captees comme `parcours`. Tolerant au `.` final du rang et aux `(n)` parenthesees |
| ProLiveSport | `prolivesport.fr/result/ID` | JSON API 2-steps | `recupererResultatsDepuisProLiveSport()` | `/apiws/result/raceList/{eventId}` → liste courses, puis `/apiws/result/indiv/{eventId}/{raceCode}` par course. Filtre `rank >= 99000` + `time=00:00:00`. **Requiert header `access-token: AUTH_PLSWS_V2`** → passé en query `x-token` + worker CF doit le convertir. `parcours` = `{distance} km` |

## Fallback générique

- **HTML générique** — `recupererResultatsGeneriqueHTML()` : scan `<table>`, score par colonnes rang/temps/nom, choisit la meilleure. Utilisé quand aucun adapter ne matche.
- **PDF** — `parseLignesPDF()` : reconstruction 2D via coordonnées (`transform[5]`=Y, `[4]`=X), puis token-parser (ancrage sur premier temps).
- **CSV/XLSX** — `parseCSVResultats()` / SheetJS : détection d'en-têtes FR/EN (rang, nom, prénom, temps, dossard, catégorie, parcours/distance/course/race).

## À tester / backlog

- [ ] Sport-Pro (sport-pro.fr / sport-pro-timing.com)
- [ ] Chronorace (chronorace.be)
- [ ] Njuko (njuko.com / live.njuko.com)
- [ ] MSO-Chrono (mso-chrono.com)
- [ ] Pro-Timing (pro-timing.fr)
- [ ] L'Echappée Belle / Sportkipik
- [ ] Adeorun (adeorun.com)
- [ ] Challenge du Hainaut (hainaut-chrono.com si existe)

## Worker Cloudflare — forward de headers custom

Certains sites (ProLiveSport) exigent un header d'auth (`access-token`). Les proxies CORS standards ne forwardent pas les headers custom (CORS preflight bloque). **Solution** : faire reconnaître au worker certaines query strings préfixées (ex: `x-token=...` → header `access-token: ...`).

```js
// Dans le handler /proxy du worker :
const targetUrl = url.searchParams.get('url');
const fwdHeaders = new Headers({ 'User-Agent': 'Mozilla/5.0' });
const xToken = url.searchParams.get('x-token');
if (xToken) fwdHeaders.set('access-token', xToken);
const upstream = await fetch(targetUrl, { headers: fwdHeaders });
```

Sans ce patch, l'adapter ProLiveSport échoue avec `access-token empty`.

## Protocole pour ajouter un nouveau site

1. **Récupérer l'URL qui casse** + un export (PDF, capture écran) comme vérité terrain
2. `curl -A "Mozilla/5.0" <url>` via proxy pour voir le vrai payload
3. Identifier le format :
   - JSON direct (API) → inspecter `Network` tab du site
   - HTML rendu serveur → DOMParser + sélecteurs CSS
   - HTML SPA → chercher iframe ou endpoint dans bundle JS
   - PDF lien → déjà géré par upload
4. Écrire adapter + `parcours` correctement renseigné
5. Validation Python : scripter la logique JS en Python sur le payload réel, compter les lignes, vérifier 5 premiers/derniers
6. Ajouter branche dans `chargerResultats()` **avant** le fallback générique
7. Mettre à jour `sites.md` + `lesson.md` si pattern intéressant

## Points d'attention récurrents

- **Encodage** : clax = UTF-8 BOM, certains CSV = Windows-1252. Tester `\xa0` (nbsp) en séparateur nom/prénom.
- **Anonymisation** : filtrer `J. D.`, `DOSSARD INCONNU`, `N.C.`, nom vide.
- **DSQ/Abandon** : regex `/abandon|dsq|dnf|nc|hc/i` sur le champ temps.
- **Multi-courses** : toujours extraire `parcours` même si 1 seule course, pour que le découpage marche dès qu'on ajoute une source multi-courses.
- **Pagination** : chercher `Page X/N`, `total=`, bouton "suivant" — parallelizer les fetches quand possible.

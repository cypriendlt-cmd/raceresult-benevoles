# Tâches — RaceResult Bénévoles

État actuel : Application v1.0 déployée et stylisée.

## Backlog priorité

### Hotfix 2026-04-17 — Endpoints cassés ✅ CORRIGÉS

- [x] **RaceResult** : flux en 2 étapes (`/data/config` → `/data/list` avec key/server/listname)
- [x] **ACN Timing** : parser `Groups[].SlaveRows` + mapping colonnes via `TableDefinition.Columns`
- [x] **PDF** : reconstruction des lignes via coordonnées Y, regex robuste nom composés / tirets / apostrophes
- [x] Nettoyage code mort (anciens parseurs JSON heuristiques obsolètes)

Vérifié sur données réelles :
- RR event 388451 (Foulées Valenciennoises) : 4588 coureurs parsés
- ACN event 20251012_athora/LIVESEMI2 : 7155 coureurs parsés
- Regex PDF : 7 patterns testés OK (incl. VAN DEN BERGHE, O'CONNOR, Jean-Pierre)

### Ajout 2026-04-17 — athle.fr (FFA) + fallback HTML générique ✅

- [x] **athle.fr** : détection URL, extraction `frmcompetition`, pagination `frmposition=0..N` en parallèle
- [x] `parseAthleFrPage()` via DOMParser (td[0]=rang, td[1]=temps, td[2]=<a>NOM Prénom</a>, td[6]=catégorie)
- [x] `normaliserTempsAthle()` : `1h10'18''` → `1:10:18`, `42'15''` → `42:15`
- [x] Suppression suffixe pays `(KEN)` en fin de nom
- [x] **Fallback HTML générique** : `recupererResultatsGeneriqueHTML(url)` — score les `<table>` par détection colonnes rang/temps/nom, choisit la meilleure
- [x] Message d'erreur clair quand aucune table reconnue (propose PDF/CSV)

Vérifié (Python replay du parser) :
- Page 0 athle.fr compétition 294421 : 250 rows extraites, rang 1→250, noms + catégories OK
- 19 pages détectées via regex `Page X/NN` → ~4750 coureurs total attendu

### Ajout 2026-04-17 — Nordsport (.clax) + PDF token-parser + UX multi-courses ✅

- [x] **Nordsport** : détection URL, fetch HTML → iframe `src` → paramètre `?f=…clax` → fetch XML
- [x] `parseClaxXML()` : joint `<Engages>` (nom, cat, parcours) + `<Resultats>` par bib `d`, normalise `\xa0`, filtre DSQ/abandon/DOSSARD INCONNU/parcours vide/anonymes `J. D.`
- [x] `normaliserTempsNordsport()` : `1h19'30` → `1:19:30`, `0h31'53` → `31:53`
- [x] **PDF token-parser** : ancrage sur premier `HH:MM`, puis rang + dossard optionnel + NOM MAJ + Prénom mixte avant. Temps Net = premier temps après non préfixé `+`/`-`. Supporte clubs en MAJ, noms composés, format variable.
- [x] **Dropzone permanente** : plus besoin d'attendre un échec de lien, bouton PDF/CSV/XLSX visible dès l'ouverture de l'app
- [x] **Onglets multi-courses** : auto-construits si ≥ 2 parcours distincts, "Toutes les courses" + 1 par parcours avec compteur
- [x] **Colonne "Course"** ajoutée au tableau + suffixe parcours dans le titre (`— 10 km`) si actif ou course unique
- [x] Champ `parcours` propagé dans tous les parseurs : RR (contestLabel), ACN, athle.fr (vide), CSV (colonne auto-détectée), clax, PDF (catégorie courante)

Vérifié (Python replay) :
- `data.clax` Corrid'Amandinoise 2025 : 6 parcours détectés, 10 km → 262 finishers non-anonymes non-DSQ
- PDF 5 lignes test (avec/sans club, avec/sans dossard) → 5/5 correctement parsées, tempsNet ≠ écart

### Phase 1 (MVP) — ✅ TERMINÉ
- [x] URL input + event ID extraction
- [x] RaceResult API fetch (multi-endpoint fallback)
- [x] CORS proxy integration
- [x] Google Sheets volunteer database sync
- [x] CSV parsing (Prénom, Nom, Rôle, Actif)
- [x] Manual volunteer add/delete
- [x] localStorage persistence
- [x] Name normalization + partial matching
- [x] Results table display (sorted by rank)
- [x] CSV export (`resultats_benevoles.csv`)
- [x] Clipboard copy (tab-separated for Excel)
- [x] Settings panel (proxy, Sheet ID)
- [x] Loading states (spinner overlay)
- [x] Error handling + user feedback
- [x] Responsive mobile-first design
- [x] Les Ch'tis Marathoniens branding (colors + logo)
- [x] GitHub Actions deploy workflow
- [x] claude.md documentation
- [x] lesson.md + task.md

### Phase 2 (Enhancements) — 🔲 À FAIRE
- [ ] **Dark mode** — `prefers-color-scheme` media query + toggle
- [ ] **Multi-events history** — Permettre de tracker plusieurs courses (méta-table)
- [ ] **Volunteer stats** — Combien de fois chaque bénévole a couru (analytics)
- [ ] **Real-time polling** — Fetch auto tous les N secondes pendant l'événement
- [ ] **Search/filter** — Filter table par nom/catégorie/dossard
- [ ] **Bulk update bénévoles** — Import depuis CSV/XLSX (multi-upload)
- [ ] **QR code integration** — Lire dossard via QR code
- [ ] **Notifications** — Toast OS pour changements en temps réel

### Phase 3 (Optimisations) — 🔲 À FAIRE
- [ ] **Virtual scroll** — Si 1000+ résultats, virtualiser la table
- [ ] **Compression** — Minify HTML/CSS/JS inline (si fichier > 50KB)
- [ ] **caching** — Cache API responses per event (IndexedDB)
- [ ] **PWA** — Service Worker + offline support
- [ ] **Analytics** — Page views, errors (optionnel Sentry/Plausible)

### Phase 4 (Integration external) — 🔲 À FAIRE
- [ ] **Slack webhook** — Notifier quand résultats chargés
- [ ] **Automatisation IFTTT** — Auto-export résultats vers Drive
- [ ] **Direct RaceResult webhook** — Subscribe aux changements event (if available)

## Bugs connus

Aucun actuellement signalé. À tester en conditions réelles.

## Documentation

- ✅ `claude.md` — API modules, architecture, localStorage schema
- ✅ `lesson.md` — Lessons learned + règles globales
- ✅ `task.md` — Backlog (ce fichier)
- ✅ `sites.md` — Tracker des sources supportées (adapter par site)
- ✅ `README.md` (racine) — Deployment instructions

## Notes pour la prochaine session

1. Lire `lesson.md` avant toute modification
2. Valider la palette couleur vs branding source
3. Tester localStorage sur navigateur vierge (F12 → Application)
4. CORS errors? → Vérifier proxy URL, ajouter logs dans console
5. Si besoin d'ajouter une feature: créer un task ici d'abord

# Tâches — RaceResult Bénévoles

État actuel : Application v1.0 déployée et stylisée.

## Backlog priorité

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
- ✅ `README.md` (racine) — Deployment instructions

## Notes pour la prochaine session

1. Lire `lesson.md` avant toute modification
2. Valider la palette couleur vs branding source
3. Tester localStorage sur navigateur vierge (F12 → Application)
4. CORS errors? → Vérifier proxy URL, ajouter logs dans console
5. Si besoin d'ajouter une feature: créer un task ici d'abord

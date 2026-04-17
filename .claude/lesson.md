# Leçons Apprises

Cette page enregistre les corrections et améliations mises en place.

Format: `[date] | problème | règle pour l'éviter | contexte`

## 2026-04-17

| Date | Problème | Règle pour l'éviter | Contexte |
|------|---------|------------------|---------|
| 2026-04-17 | Palette couleur initiale (#178CBA) ne correspondait pas à la marque | **Toujours valider la palette couleur auprès de la source visuelle (logo/branding) avant de coder** | App RaceResult Bénévoles — palette "Les Ch'tis Marathoniens" appliquée |
| 2026-04-17 | Manque de documentation interne sur les modules JS | **Documenter les modules fonctionnels (API, état, responsabilité) dans claude.md avant déploiement** | App RaceResult Bénévoles — added claude.md |

## Règles appliquées globalement

1. **Testing**
   - Toujours tester localStorage sur une nouvelle page vierge (F12 → Application → localStorage)
   - Tester responsive à 375px, 768px, 1440px
   - CORS errors → vérifier proxy URL dans paramètres

2. **Naming**
   - Fonctions métier en français (matchBenevoles, chargerBenevoles)
   - Variables privées: sous-titrées (ex: `_cache`)
   - Classes CSS: kebab-case (btn-primary, card-header)

3. **Error handling**
   - All fetches wrapped in try/catch
   - User-facing messages in French, clear + actionable
   - Suggestions pour CORS, invalid URL, Sheet auth issues

4. **Performance**
   - localStorage persist patterns → optimize writes (batch saves)
   - Table rendering → consider virtual scroll untuk 1000+ rows nanti

5. **Accessibility**
   - Tous les inputs doivent avoir des labels visibles
   - Spinner overlay → aria-busy="true"
   - Dark mode? → prefers-color-scheme media query (pas fait encore)

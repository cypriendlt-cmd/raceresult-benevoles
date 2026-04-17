# Leçons Apprises

Cette page enregistre les corrections et améliations mises en place.

Format: `[date] | problème | règle pour l'éviter | contexte`

## 2026-04-17

| Date | Problème | Règle pour l'éviter | Contexte |
|------|---------|------------------|---------|
| 2026-04-17 | Palette couleur initiale (#178CBA) ne correspondait pas à la marque | **Toujours valider la palette couleur auprès de la source visuelle (logo/branding) avant de coder** | App RaceResult Bénévoles — palette "Les Ch'tis Marathoniens" appliquée |
| 2026-04-17 | Manque de documentation interne sur les modules JS | **Documenter les modules fonctionnels (API, état, responsabilité) dans claude.md avant déploiement** | App RaceResult Bénévoles — added claude.md |
| 2026-04-17 | Endpoints RaceResult devinés (`contest=0&listformat=json`) → 400/404 | **Ne jamais deviner un endpoint API : inspecter le vrai flux du SPA (bundle JS, Network tab) avant d'écrire du code client** | RR nécessite `/data/config` d'abord pour obtenir `key` + `server` (my4.raceresult.com) + `listname` (`En ligne\|Final`), puis `/data/list?key=X&listname=Y&contest=0&r=all` |
| 2026-04-17 | Parser ACN cherchait `data.Rows` → format réel est `data.Groups[].SlaveRows` | **Valider la structure réelle d'une réponse API avant d'écrire le parser (curl + jq, pas seulement la doc)** | ACN retourne `TableDefinition.Columns` (schéma) + `Groups[].SlaveRows` (données). Mapping par `FieldIdx`, pas par position fixe. Noms en HTML `<b>X</b>` à nettoyer. |
| 2026-04-17 | Parser PDF faisait `items.map(i => i.str).join(' ')` → perd la structure 2D | **Pour PDF.js, reconstruire les lignes via `item.transform[5]` (coord Y) puis trier par `transform[4]` (X) avant parsing texte** | Impossible de parser un PDF tabulaire sans utiliser les coordonnées. join(' ') fusionne toutes les colonnes en un seul blob illisible. |
| 2026-04-17 | Pas de parser universel pour « n'importe quel site de résultats » | **Architecture adaptateurs : 1 parser dédié par source (API reverse-engineered > HTML server-rendered > PDF) + 1 fallback HTML générique heuristique (score des tables par colonnes rang/temps/nom). Jamais de LLM pour parser : coût tokens, CORS non résolu, hallucinations sur noms.** | athle.fr ajouté (HTML ASP.NET, pagination frmposition=0..N, 250 rows/page). Fallback générique pour sites inconnus. |
| 2026-04-17 | Page Nordsport ne retourne que 655 bytes (iframe vide) | **Quand une page "de résultats" est vide/petite, inspecter les iframes : les sites de chrono embarquent souvent un viewer externe (.clax, .xml, .json) via iframe src. Extraire le `src`, puis les paramètres (`?f=...`) pour trouver l'URL vraie des données.** | Nordsport : iframe pointe vers `viewer.php?f=data.clax`. Le `.clax` est en réalité du XML UTF-8 avec BOM (parsable par DOMParser). |
| 2026-04-17 | Parser PDF ligne-par-ligne (regex format fixe) casse sur colonnes variables (CLUB en MAJ entre Prénom et Temps) | **Parser token-par-token avec ancre sur le premier temps (`HH:MM` ou `H:MM:SS`). Avant l'ancre : rang, dossard optionnel, NOM en MAJ, Prénom en mixte. Après l'ancre : skip les temps préfixés `+`/`-` (ce sont des écarts), le premier temps restant est le Temps Net.** | Nordsport PDF : `rang dossard NOM Prenom CLUB licence temps +ecart vitesse cat rank`. Format qui change selon que le club existe ou pas. Le token-parser s'adapte sans connaître le format à l'avance. |
| 2026-04-17 | Import PDF caché tant qu'un lien ne fonctionne pas | **Les points d'entrée alternatifs (PDF, CSV) doivent être visibles dès le début. "Dropzone conditionnelle" frustre l'utilisateur qui sait déjà que son lien ne marche pas.** | App RaceResult : dropzone maintenant permanente (pas de `hidden` par défaut), reformulée "Ou importez un fichier". |
| 2026-04-17 | Évènements multi-courses affichaient tous les parcours mélangés | **Quand une source retourne plusieurs courses (parcours/distances), exposer des onglets "Toutes les courses" + 1 par parcours avec compteur. Ajouter le champ `parcours` à chaque résultat dans tous les parsers (RR, ACN, athle.fr, PDF, clax, CSV) — pas seulement celui qui l'a découvert.** | Nordsport Corrid'Amandinoise 2025 a 6 parcours (3/5/10 km marche+course). Sans filtre, le bénévole qui court le 10km voit son rang noyé parmi les marcheurs du 3km. |
| 2026-04-17 | Matching bénévoles via `.includes()` sur prénoms → faux positifs (Jean-Marie bénévole matchait Marie coureuse, Frédéric matchait Eric) | **Ne jamais utiliser `String.includes()` pour comparer des noms/prénoms. Tokeniser sur `-` et espaces, comparer au niveau token. Règles : identiques OK, même set de tokens OK, simple vs composé seulement si le simple = PREMIER token du composé. "Pierre" ne doit pas matcher "Jean-Pierre" (Pierre en 2e position).** | `prenomEquivalent()` dans `matchBenevoles()`. Validé sur 10 cas : bugs refusés, vrais positifs (Jean-Pierre vs Jean, Jean Claude vs Jean-Claude) conservés. |
| 2026-04-17 | PDF ChronoLap (Trail du Caillou 2026) non parsé : rang `1.` avec point final + tokens `(1)` parenthésés entre prénom et suite | **Rendre le token-parser PDF tolérant : `(\d+)\.?` pour le rang (strip `.` final), skip des tokens `^\(\d+\)$` dans les boucles NOM et Prénom. Séparer `parcours` (distance `30km (...)`) de `categorie` (SE, M0, V1) dans la sortie `parseLignesPDF()`.** | chronolap.net/...e86d1634.pdf — 1402 coureurs parsés sur 3 parcours (30/23/13 km), noms composés OK (LE ROUX, Jean Didier, Marc-Antoine). |

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

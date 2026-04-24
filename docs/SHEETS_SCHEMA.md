# Schéma Google Sheets — base de données du club

On crée un **nouveau Google Sheet dédié** (base club v2), distinct de celui utilisé par l'app bénévoles v1. Son ID ira dans `SHEET_ID` ([src/config.js](../src/config.js)). Il contient **7 onglets** (5 résultats + 2 sondages). La 1re ligne de chaque onglet est l'en-tête.

> **Important** — Le Sheet doit être **partagé publiquement en lecture** (Fichier > Partager > "Tous ceux qui ont le lien"). L'écriture passe par un **Apps Script Web App** (voir [APPS_SCRIPT.md](APPS_SCRIPT.md)), pas par le partage direct.

---

## Onglet 1 — `Adherents` (étend l'existant)

Colonnes attendues (ordre libre, détection par nom d'en-tête) :

| Colonne | Type | Obligatoire | Exemple | Notes |
|---|---|---|---|---|
| `id` | string | oui | `adh_0042` | Identifiant interne stable. Si vide, généré à la 1re sync et écrit. |
| `prenom` | string | oui | `Jean-Pierre` | |
| `nom` | string | oui | `Durant` | |
| `sexe` | `M` / `F` / vide | non | `M` | Si présent, sert au matching catégorie. |
| `date_naissance` | `YYYY-MM-DD` | non | `1985-03-14` | Format ISO recommandé. |
| `groupe` | string | non | `Groupe 1` / `Marche` / `Compétition` | |
| `actif` | `oui` / `non` / vide | non | `oui` | Vide = considéré actif. |
| `role` | string | non | `Ravitaillement` | Conservé pour compat v1 (bénévoles). |
| `alias` | string (CSV) | non | `JP Durant; Jean P. Durant` | Variantes alternatives pour matching. |

**Règle** : si `id` est vide, la première sync génère un ID `adh_<nnnn>` et l'écrit via Apps Script. Ne JAMAIS réutiliser un ID supprimé.

---

## Onglet 2 — `Courses`

Une ligne = une course connue.

| Colonne | Type | Obligatoire | Exemple |
|---|---|---|---|
| `id` | string | oui | `course_20250914_lille_marathon` |
| `nom` | string | oui | `Marathon de Lille` |
| `date` | `YYYY-MM-DD` | oui | `2025-09-14` |
| `lieu` | string | non | `Lille` |
| `distance_km` | number | non | `42.195` |
| `type` | string | non | `marathon` / `10km` / `trail` / `semi` |
| `organisateur` | string | non | |
| `source` | string | oui | `raceresult` / `prolivesport` / `acn` / `athlefr` / `nordsport` / `pdf` / `csv` / `manuel` |
| `source_event_id` | string | non | `285732` (ID natif du site) |
| `url` | string | non | URL d'origine |
| `created_at` | ISO datetime | oui | auto |

**Clé naturelle de dédup** : `source + source_event_id` si disponible, sinon `normaliser(nom) + date`.

---

## Onglet 3 — `Resultats`

Une ligne = une participation d'un adhérent à une course.

| Colonne | Type | Obligatoire | Exemple |
|---|---|---|---|
| `id` | string | oui | `res_0001234` |
| `course_id` | string | oui | FK `Courses.id` |
| `adherent_id` | string | oui si matché | FK `Adherents.id`. Vide si import forcé sans match. |
| `prenom_source` | string | oui | Tel que lu dans la source |
| `nom_source` | string | oui | Tel que lu dans la source |
| `temps` | string | non | `03:42:18` (HH:MM:SS) |
| `temps_net` | string | non | `03:42:10` |
| `temps_sec` | number | non | `13338` (pour tri) |
| `rang_general` | number | non | `142` |
| `rang_categorie` | number | non | `12` |
| `categorie` | string | non | `M40H` |
| `sexe_source` | `M`/`F`/vide | non | |
| `club_source` | string | non | |
| `dossard` | string | non | `1523` |
| `match_status` | enum | oui | `certain` / `probable` / `douteux` / `ambigu` / `absent` / `manuel` |
| `match_score` | number 0-100 | non | `95` |
| `import_id` | string | oui | FK `Imports.id` |
| `created_at` | ISO datetime | oui | auto |

**Clé de dédup stricte** : `course_id + prenom_source + nom_source + temps`. Si collision, la nouvelle ligne est rejetée (et comptée dans `Imports.lignes_ignorees`).

---

## Onglet 4 — `Matching_Overrides`

Décisions manuelles persistées. Appliquées AVANT scoring automatique au prochain import.

| Colonne | Type | Obligatoire | Exemple |
|---|---|---|---|
| `id` | string | oui | `ovr_0042` |
| `type` | enum | oui | `force_match` / `refuse_match` / `alias` |
| `prenom_source` | string | oui | `J.P.` |
| `nom_source` | string | oui | `Durant` |
| `adherent_id` | string | oui si `force_match` / `refuse_match` | |
| `scope` | enum | oui | `global` / `course` |
| `course_id` | string | si scope=course | |
| `created_by` | string | non | nom du bénévole |
| `created_at` | ISO datetime | oui | |
| `note` | string | non | |

**`type=alias`** : enregistre qu'une variante `prenom_source/nom_source` correspond toujours à `adherent_id`. Les prochains imports matchent automatiquement en `certain`.

---

## Onglet 5 — `Imports`

Journal des imports.

| Colonne | Type | Obligatoire | Exemple |
|---|---|---|---|
| `id` | string | oui | `imp_20260423_1542` |
| `date` | ISO datetime | oui | |
| `source` | string | oui | `raceresult` |
| `url` | string | non | |
| `course_id` | string | oui si course créée | |
| `lignes_totales` | number | oui | `245` |
| `lignes_importees` | number | oui | `12` |
| `lignes_ignorees` | number | oui | `2` (doublons) |
| `lignes_douteuses` | number | oui | `3` (nécessitent validation) |
| `user` | string | non | nom du bénévole |
| `status` | enum | oui | `success` / `partial` / `failed` |
| `error` | string | non | message si `failed` |

---

## Onglet 6 — `CoursesCiblees` (module sondages)

Une ligne = une course ciblée par le bureau, ouverte à un sondage de participation.

**Écriture : ADMIN_TOKEN requis** (voir [apps-script-web-app.gs](apps-script-web-app.gs)). Un token adhérent ne peut ni créer, ni modifier, ni supprimer.

| Colonne | Type | Obligatoire | Exemple | Notes |
|---|---|---|---|---|
| `id` | string | oui | `cc_20251014_10km_pl` | Identifiant stable. |
| `nom` | string | oui | `10 km de Pérenchies` | |
| `date` | `YYYY-MM-DD` | oui | `2025-10-14` | |
| `lieu` | string | non | `Pérenchies (59)` | |
| `distances` | string | non | `10 km` / `10 km, semi` | Libre, séparées par virgule. |
| `url_officielle` | url | non | | |
| `url_inscription` | url | non | | |
| `description` | string | non | | Commentaire libre du bureau. |
| `statut` | enum | oui | `brouillon` / `publiee` / `cloturee` / `archivee` | Seul `publiee` est visible côté adhérent. |
| `date_limite_reponse` | `YYYY-MM-DD` | non | `2025-10-10` | Au-delà, le formulaire est bloqué côté UI. |
| `afficher_participants` | `oui`/`non` | oui | `oui` | Si `non`, l'adhérent voit seulement des compteurs, pas les noms. |
| `autoriser_modif_reponse` | `oui`/`non` | oui | `oui` | Si `non`, pas de upsert côté adhérent. |
| `created_at` | ISO datetime | oui | auto | |
| `updated_at` | ISO datetime | oui | auto | |

---

## Onglet 7 — `ReponsesSondage` (module sondages)

Une ligne = une réponse d'un adhérent à une course ciblée.

**Écriture : SHARED_TOKEN suffit** (append + upsert sur `id`). Lecture libre.

| Colonne | Type | Obligatoire | Exemple | Notes |
|---|---|---|---|---|
| `id` | string | oui | `rep_cc_20251014_adh_0042` | Clé stable = `course_ciblee_id + '_' + adherent_id` (ou hash prénom+nom si non adhérent). Permet upsert si modif autorisée. |
| `course_ciblee_id` | string | oui | FK `CoursesCiblees.id` | |
| `adherent_id` | string | non | FK `Adherents.id` | Vide si réponse non identifiée. |
| `prenom` | string | oui | | Copié depuis `Adherents` au moment de la réponse. |
| `nom` | string | oui | | |
| `reponse` | enum | oui | `oui` / `non` / `peut_etre` | **MVP : strictement ces 3 valeurs.** |
| `distance_choisie` | string | non | `10 km` | Rempli uniquement si la course a ≥ 2 distances et que `reponse=oui`. Valeur prise dans `CoursesCiblees.distances` split par virgule. |
| `created_at` | ISO datetime | oui | auto | |
| `updated_at` | ISO datetime | oui | auto | Mis à jour lors d'un upsert. |

**Dédup** : clé `id` reposant sur `course_ciblee_id + adherent_id`. Un adhérent qui répond deux fois écrase sa réponse précédente (si `autoriser_modif_reponse = oui`).

---

## Checklist de mise en place (utilisateur)

1. [ ] Créer un **nouveau** Google Sheet vide (titre suggéré : `Ch'tis Marathoniens — Base Club`).
2. [ ] Créer 7 onglets : `Adherents`, `Courses`, `Resultats`, `Matching_Overrides`, `Imports`, `CoursesCiblees`, `ReponsesSondage` avec les en-têtes exacts des §1-7.
3. [ ] Copier-coller depuis l'ancien Sheet les adhérents existants dans le nouvel onglet `Adherents` (colonnes `prenom`, `nom`, `role`, `actif` — les autres colonnes restent vides et seront remplies progressivement).
4. [ ] Partager le Sheet en lecture publique (Fichier → Partager → "Tout le monde avec le lien").
5. [ ] Suivre [APPS_SCRIPT.md](APPS_SCRIPT.md) pour déployer le Web App d'écriture.
6. [ ] Me fournir : **Sheet ID** (dans l'URL) + **URL du Web App** + **token choisi**.

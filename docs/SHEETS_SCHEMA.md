# Schéma Google Sheets — base de données du club

On crée un **nouveau Google Sheet dédié** (base club v2), distinct de celui utilisé par l'app bénévoles v1. Son ID ira dans `SHEET_ID` ([src/config.js](../src/config.js)). Il contient **5 onglets**. La 1re ligne de chaque onglet est l'en-tête.

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

## Checklist de mise en place (utilisateur)

1. [ ] Créer un **nouveau** Google Sheet vide (titre suggéré : `Ch'tis Marathoniens — Base Club`).
2. [ ] Créer 5 onglets : `Adherents`, `Courses`, `Resultats`, `Matching_Overrides`, `Imports` avec les en-têtes exacts des §1-5.
3. [ ] Copier-coller depuis l'ancien Sheet les adhérents existants dans le nouvel onglet `Adherents` (colonnes `prenom`, `nom`, `role`, `actif` — les autres colonnes restent vides et seront remplies progressivement).
4. [ ] Partager le Sheet en lecture publique (Fichier → Partager → "Tout le monde avec le lien").
5. [ ] Suivre [APPS_SCRIPT.md](APPS_SCRIPT.md) pour déployer le Web App d'écriture.
6. [ ] Me fournir : **Sheet ID** (dans l'URL) + **URL du Web App** + **token choisi**.

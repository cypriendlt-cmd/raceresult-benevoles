# Pièges rencontrés en refactorant les parseurs (J3)

**Date** : 2026-04-23

## ACN-Timing / ChronoRace

- Les colonnes `FieldIdx` du `TableDefinition` ne correspondent **pas** à l'index
  positionnel dans chaque row. On les retrouve via `Name` / `DisplayName`
  (`#Name`, `#Time`, `#Cat`, `#Nr`, `Pos`). Fallback positions standard
  `[0,1,3,6,9]` si introspection échoue.
- Le champ temps contient souvent du bruit type `"1:07:40 18.8km/h"` — on extrait
  le premier pattern `\d{1,2}:\d{2}(?::\d{2})?`.
- Deux formats coexistent : nouveau (`Groups[].SlaveRows`) et ancien (`Rows[]`).
  Tenter les deux.
- Rang contient parfois un point final (`"1."`) — le strip.

## Athle.fr (FFA)

- **Pagination** via `frmposition=0..N-1` détectée par un regex
  `Page X/Y`. Plutôt fiable.
- Les noms coureurs peuvent être suivis d'un code pays `(KEN)` : à retirer avant
  `splitNomPrenom`.
- Le markup évolue : pas de classe CSS stable. Détection par `<tr>` + `<td>` +
  `<a>` dans la 3e cellule. **Test canary obligatoire**.

## Nordsport / .clax

- Flux en 2 temps : page live → iframe src → paramètre `f=/...clax` → fetch XML.
- `Engages` et `Resultats` sont joints via `dossard`. Filtrer :
  - `t="ABANDON"` / `DSQ` / `DNF`
  - noms anonymisés type `"L. G."` (initiales)
  - `Dossard inconnu`
  - absence de parcours (données corrompues)
- Les `&#xA0;` (espaces insécables) dans `@n` doivent être nettoyés avant split.
- Un même fichier .clax peut contenir **plusieurs parcours distincts** (10km,
  semi, marathon). Chaque parcours → une course distincte.

## RaceResult (RRPublish)

- La config a **deux modes** : Simple API activée (→ `config.key` présent) ou
  non (→ rien à faire). Lever un message clair côté UI.
- `data.data` peut être soit un dict de contests `{ "#1_10km": [...] }` soit un
  dict imbriqué `{ "#1_10km": { "#Cat_SEM": [...], "#Cat_VEM": [...] } }`.
- Plusieurs contests = plusieurs courses dans la sortie.
- `DataFields` est une liste de **strings d'expressions** (`"Arrivée.GUN"`,
  `"AfficherNom"`) — pas d'objets. Recherche par `includes`.

## ProLiveSport

- Le token `access-token` est exigé dans un header HTTP custom que CORS
  bloque. Le worker Cloudflare doit transformer la query `x-token=...` en
  header. Sans ça → `success:false message:"invalid token"`.
- `distance === "999"` est un pseudo-parcours agrégé (à exclure).
- `rank >= 99000` = non-classé.
- `time === "00:00:00"` = DNF/DSQ → exclure.

## HTML générique

- Fragile par définition. La stratégie : trouver la table avec le **plus de
  lignes scorées** (3+ cellules dont rang numérique, temps reconnu, nom MAJ).
- Exclut les tables de navigation. Mais peut rater des layouts basés sur `<div>`
  — accepté pour ce jalon.
- Titre de course : `<h1>` sinon `<title>`.

## PDF

- Les coordonnées Y doivent être arrondies (tol=2px) pour regrouper en ligne.
- Les tokens entre parenthèses `(1)` = rang catégorie → à skipper pendant
  l'extraction NOM/Prénom.
- Ancrage : premier `HH:MM:SS` (ou `MM:SS`). Tout ce qui précède = rang +
  dossard + NOM + Prénom.
- **Écart** `+0:12` / `-0:05` dans `apres` ne doit pas être pris pour un temps
  net.
- Les en-têtes de section (SENIORS HOMMES, 10 KM, etc.) se détectent par
  absence de temps + longueur < 80 chars + préfixe reconnu.

## CSV

- Pas de norme commune sur les en-têtes ; détection par `includes` sur un
  catalogue français/anglais/allemand.
- Séparateur `;` non supporté pour l'instant (à voir si besoin).
- BOM UTF-8 non strippé par `parseCSV` — à vérifier si problème.

## splitNomPrenom

- Ne jamais simplifier. Les cas "DE LA FONTAINE Pierre" (particule + nom + prénom),
  "jean dupont" (tout minuscule → dernier = nom), "NOM, Prénom" (RaceResult) sont
  tous couverts. Fixtures figées dans les tests — ne pas régresser.

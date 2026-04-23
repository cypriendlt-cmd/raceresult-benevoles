# Google Apps Script — Web App d'écriture

En option **A1** (site statique, pas de backend), toutes les écritures dans le Sheet passent par un **Apps Script** que tu déploies **une fois**. L'app frontend POST sur une URL et l'Apps Script fait les `appendRow` / `getRange.setValues` côté Sheet.

---

## 1. Créer le script

1. Ouvre ton Google Sheet.
2. Menu **Extensions → Apps Script**.
3. Remplace tout le code par celui de [apps-script-web-app.gs](./apps-script-web-app.gs).
4. Clique 💾 **Enregistrer le projet**.

## 2. Déployer comme Web App

1. Bouton **Déployer → Nouveau déploiement**.
2. Type : **Application Web** (icône roue dentée si absent).
3. Paramètres :
   - **Description** : `Ch'tis Résultats - écriture`
   - **Exécuter en tant que** : *Moi*
   - **Qui a accès** : **Tout le monde** (même anonyme)
4. Clique **Déployer**, autorise les permissions demandées (lecture/écriture Sheets sur TES fichiers uniquement).
5. Copie l'**URL du Web App** (`https://script.google.com/macros/s/.../exec`).
6. Colle-la dans [src/config.js](../src/config.js) (constante `APPS_SCRIPT_URL`) ou via l'UI Paramètres.

## 3. Sécurité — points importants

- **Qui peut écrire ?** N'importe qui avec l'URL. L'URL est dans le JS du site = visible publiquement.
- **Mitigation pragmatique** : le script vérifie un **token partagé** côté client (dans `APPS_SCRIPT_TOKEN`). Pas de la vraie crypto — juste une barrière contre les bots. Change-le tous les 6 mois.
- **Quotas Apps Script** : 6 min/exécution, 20 k appels/jour pour un compte gratuit. Large pour un club.
- **Logs** : consultables dans Apps Script → *Exécutions*. Vérifier en cas de bug.

## 4. Protocole

### Request (POST JSON)

```json
{
  "token": "<APPS_SCRIPT_TOKEN>",
  "op": "batch",
  "operations": [
    { "sheet": "Imports", "action": "append", "row": { "id": "imp_...", "date": "...", ... } },
    { "sheet": "Courses", "action": "upsert", "key": "id", "row": { "id": "course_...", ... } },
    { "sheet": "Resultats", "action": "appendMany", "rows": [ { ... }, { ... } ] }
  ]
}
```

Actions supportées :
- `append` : ajoute une ligne
- `appendMany` : ajoute N lignes (batch)
- `upsert` : met à jour si `key` match, sinon append
- `update` : met à jour, erreur si absent
- `delete` : supprime par clé

### Response

```json
{
  "ok": true,
  "results": [
    { "sheet": "Imports", "action": "append", "count": 1 },
    { "sheet": "Courses", "action": "upsert", "count": 1, "created": false },
    { "sheet": "Resultats", "action": "appendMany", "count": 42 }
  ]
}
```

En cas d'erreur :
```json
{ "ok": false, "error": "message explicite", "operation_index": 2 }
```

## 5. Mise à jour du script

Quand tu modifies le `.gs` :
1. 💾 Enregistre.
2. **Déployer → Gérer les déploiements → ✏️ Modifier** → **Nouvelle version** → **Déployer**.
3. L'URL **reste la même**, pas besoin de remettre à jour `config.js`.

---

## Code du Web App

→ [apps-script-web-app.gs](./apps-script-web-app.gs) — à copier-coller dans l'éditeur Apps Script.

**Pense à remplacer** `SHARED_TOKEN` (ligne ~10) par une valeur aléatoire (ex : `openssl rand -hex 16` ou un UUID). Tu devras me fournir cette même valeur pour la mettre dans `src/config.js`.

## Actions supportées par le Web App

Le script gère 5 actions par onglet :
- `append` — ajoute 1 ligne
- `appendMany` — ajoute N lignes (batch, 1 seul `setValues`)
- `upsert` — met à jour si clé existe, sinon append (utilisé pour `Adherents`, `Courses`)
- `update` — met à jour, erreur si clé absente
- `delete` — supprime par clé

Verrou (`LockService`) pour éviter écritures concurrentes. Seuls les 5 onglets `ALLOWED_SHEETS` sont accessibles.

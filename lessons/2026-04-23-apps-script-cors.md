# Apps Script Web App + CORS = blocage navigateur

**Date :** 2026-04-23
**Contexte :** J2 — smoke test de la couche store

## Problème

Appel `fetch()` direct depuis le navigateur vers une Apps Script Web App (`https://script.google.com/macros/s/.../exec`) échoue avec :
```
Access to fetch at '...' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
GET ... net::ERR_FAILED 302 (Found)
```

Apps Script répond `302 Found` qui redirige vers `googleusercontent.com`. La réponse finale sur googleusercontent a bien `Access-Control-Allow-Origin: *`, mais le **302 intermédiaire n'a pas d'en-tête CORS** — Chrome (depuis ~2020) exige CORS sur chaque étape d'une redirection pour une requête CORS, et bloque.

**Ça casse** aussi bien le GET (ping) que le POST (écritures).

## Leçon

1. **Ne JAMAIS appeler Apps Script Web App directement depuis le navigateur.** Toujours passer par un proxy côté serveur (Cloudflare Worker, dans notre cas).
2. Le proxy doit **supporter POST + body + `Content-Type`**. L'ancien Worker ne gérait que GET — il a fallu l'enrichir.
3. Le proxy doit aussi répondre au **preflight OPTIONS** (status 204 + headers CORS) sinon le POST avec `Content-Type: application/json` est bloqué.
4. Ajouter `redirect: 'follow'` côté Worker pour qu'il suive la 302 sans soucis (c'est le défaut, mais explicite = plus clair).
5. **Règle générale** : tout service Google qui renvoie une 302 avec CORS partiel = proxy obligatoire.

## Correctif appliqué

- [docs/cloudflare-worker.js](../docs/cloudflare-worker.js) — nouveau Worker GET + POST + preflight
- [src/store/appsScript.js](../src/store/appsScript.js) — `sendBatch` et `ping` passent par `proxied()`

## Preuve / lien

- Console navigateur 2026-04-23 (traces dans conversation)
- Référence : https://stackoverflow.com/questions/70913053 (pattern identique)

# Worker Cloudflare : forward du `x-token` pour ProLiveSport

**Date :** 2026-04-23
**Contexte :** J5 — import ProLiveSport cassé après la refonte Worker

## Problème

L'API ProLiveSport (`api.prolivesport.fr`) refuse les appels sans header `access-token: AUTH_PLSWS_V2`. Le parseur passe cette valeur via un param `?x-token=...` dans l'URL du proxy — le Worker est censé lire ce param et le convertir en header sortant.

L'ancien Worker le faisait. Le nouveau Worker (refondu pour gérer POST + preflight CORS) ne le faisait plus → ProLiveSport cassé silencieusement avec `success:false`.

## Leçon

**Quand on refond un composant partagé, relister les "contrats implicites" des appelants existants** avant de déployer. Ici, ProLiveSport avait un couplage non documenté avec le Worker.

À retenir :
- Tout paramètre de query du proxy qui n'est pas `url` doit être pensé comme potentiellement à forwarder.
- Documenter ces conventions dans le header du Worker (fait).

## Correctif

`docs/cloudflare-worker.js` : si `?x-token=...` est présent, l'ajouter en header `access-token` de la requête sortante.

## Preuve / lien

- [docs/cloudflare-worker.js](../docs/cloudflare-worker.js) — section `xToken`
- [src/scraping/parsers/prolivesport.js:22](../src/scraping/parsers/prolivesport.js#L22) — ajout du `&x-token=AUTH_PLSWS_V2`

# Choix du token Apps Script

**Date :** 2026-04-23
**Contexte :** J1 — sécurité Web App d'écriture

## Problème

Le Web App Apps Script est accessible par tout internet (anonyme autorisé). L'URL est dans le JS public du site. La seule barrière est le `SHARED_TOKEN` défini dans le `.gs` et dupliqué dans `src/config.js`.

Le token choisi est `cdel_06101999` — initiales + date, facilement devinable.

## Leçon

Pour un club avec faible surface d'attaque, un token faible est **acceptable** tant que :
1. La zone d'impact est limitée (au pire un vandale spamme le Sheet — réversible via historique des versions).
2. La rotation est triviale : changer la ligne dans `.gs`, redéployer (même URL), changer dans `config.js`, recommit.
3. Le risque est connu et accepté.

**Règle à appliquer désormais :**
- Si un jour le Sheet est vandalisé → rotation immédiate du token + audit historique des versions.
- Si on ajoute une seconde app ou si on partage le token, basculer vers un token aléatoire.
- Ne pas prétendre que c'est "sécurisé", c'est une barrière anti-bot, pas anti-adversaire.

## Preuve / lien

- [docs/apps-script-web-app.gs](../docs/apps-script-web-app.gs) ligne 11
- [src/config.js](../src/config.js) `APPS_SCRIPT_TOKEN`

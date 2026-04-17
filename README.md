# RaceResult Bénévoles

Application web statique de suivi des résultats de course pour une liste de bénévoles.  
Entre une URL d'événement RaceResult, récupère les résultats et les croise avec une base de bénévoles.

## Fonctionnalités

- **Chargement des résultats** depuis n'importe quel événement RaceResult (via URL)
- **Base de bénévoles** synchronisée depuis Google Sheets ou gérée manuellement
- **Croisement automatique** des résultats avec la liste des bénévoles (matching tolérant)
- **Export** en CSV ou copie dans le presse-papier (compatible Excel/Sheets)
- **Responsive** : fonctionne sur mobile et desktop
- **Stockage local** : les paramètres et bénévoles sont sauvegardés dans le navigateur

## Déploiement sur GitHub Pages

### Automatique (recommandé)

Le workflow GitHub Actions `.github/workflows/deploy.yml` déploie automatiquement sur chaque push sur `main`.

1. Allez dans **Settings > Pages** de votre repo
2. Sous **Source**, sélectionnez **GitHub Actions**
3. Poussez sur `main` — le site sera disponible à `https://<username>.github.io/raceresult-benevoles/`

### Manuel

1. Allez dans **Settings > Pages**
2. Sous **Source**, sélectionnez **Deploy from a branch**
3. Choisissez `main` / `/ (root)`
4. Le site sera déployé en quelques minutes

## Configuration

Ouvrez la section **Paramètres** dans l'application pour configurer :

| Paramètre | Description | Valeur par défaut |
|-----------|-------------|-------------------|
| URL du proxy CORS | Cloudflare Worker pour contourner CORS | `https://raceresult-proxy.cymusic29.workers.dev` |
| Google Sheet ID | ID de la feuille contenant les bénévoles | *(vide)* |

### Format du Google Sheet

La feuille doit contenir ces colonnes (la première ligne est l'en-tête) :

| Prénom | Nom | Rôle | Actif |
|--------|-----|------|-------|
| Jean | Dupont | Ravitaillement | oui |
| Marie | Martin | Signaleur | oui |

La feuille doit être **partagée publiquement** (Fichier > Partager > Tout le monde avec le lien).

## Proxy CORS (Cloudflare Worker)

L'application nécessite un proxy CORS pour accéder aux API RaceResult et Google Sheets.  
Déployez ce worker sur Cloudflare :

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Paramètre "url" manquant', { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: { 'User-Agent': 'RaceResult-Benevoles-Proxy/1.0' }
    });

    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');

    return new Response(response.body, {
      status: response.status,
      headers
    });
  }
};
```

## Stack technique

- HTML / CSS / JS vanilla (zéro dépendance)
- Pas de framework, pas de build step
- Un seul fichier `index.html`

/**
 * Cloudflare Worker — proxy CORS universel (GET + POST).
 *
 * Remplace le worker existant (qui ne gère que GET).
 * Nécessaire pour les appels vers Apps Script Web App :
 *   Apps Script renvoie 302 sans CORS → blocage côté navigateur.
 *   Le Worker, côté serveur, suit le redirect et renvoie avec CORS.
 *
 * Déploiement :
 *   1. https://dash.cloudflare.com/ → Workers → raceresult-proxy → Modifier
 *   2. Remplacer tout le code par celui-ci
 *   3. Save and Deploy
 */

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (!targetUrl) {
      return new Response('Paramètre "url" manquant', {
        status: 400,
        headers: corsHeaders()
      });
    }

    // Origine/Referer à envoyer à la cible — certaines API (Speedhive) vérifient.
    // Mapping : si la cible appartient à un backend connu, on envoie son front officiel.
    let originRef = null;
    try {
      const t = new URL(targetUrl);
      if (/speedhive\.com$/.test(t.hostname)) originRef = 'https://sporthive.com';
      else if (/raceresult\.com$/.test(t.hostname)) originRef = 'https://my.raceresult.com';
      else originRef = t.protocol + '//' + t.hostname;
    } catch {}

    const init = {
      method: request.method,
      headers: {
        // UA navigateur standard : certaines API (Speedhive, etc.) bloquent les UAs custom
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow'
    };
    if (originRef) {
      init.headers['Referer'] = originRef + '/';
      init.headers['Origin'] = originRef;
    }

    // ProLiveSport : leur API exige un header `access-token`. On le passe via
    // le param ?x-token=... du proxy pour ne pas avoir à le coder côté Worker.
    const xToken = url.searchParams.get('x-token');
    if (xToken) init.headers['access-token'] = xToken;

    if (request.method === 'POST' || request.method === 'PUT') {
      init.body = await request.arrayBuffer();
      const ct = request.headers.get('Content-Type');
      if (ct) init.headers['Content-Type'] = ct;
    }

    try {
      const response = await fetch(targetUrl, init);
      const headers = new Headers(response.headers);
      Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
      return new Response(response.body, {
        status: response.status,
        headers
      });
    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: String(err) }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() }
      });
    }
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

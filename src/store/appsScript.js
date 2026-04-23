/**
 * Client d'écriture vers le Web App Apps Script.
 *
 * Tout passe par le Worker Cloudflare (proxy) : Apps Script renvoie une 302
 * sans en-tête CORS, le navigateur bloque. Le Worker suit le redirect côté
 * serveur et ajoute les en-têtes CORS. Voir docs/cloudflare-worker.js.
 */

import { get } from '../config.js';

function proxied(url) {
  const proxy = get('PROXY_URL').replace(/\/$/, '');
  return proxy + '/proxy?url=' + encodeURIComponent(url);
}

/**
 * Envoie un batch d'opérations.
 *
 * @param {Array<{sheet:string, action:string, row?:object, rows?:object[], key?:string, value?:any}>} operations
 * @returns {Promise<{ok:boolean, results?:any[], error?:string}>}
 */
export async function sendBatch(operations) {
  if (!Array.isArray(operations) || operations.length === 0) {
    return { ok: true, results: [] };
  }
  const scriptUrl = get('APPS_SCRIPT_URL');
  const token = get('APPS_SCRIPT_TOKEN');
  if (!scriptUrl || !token) {
    throw new Error('APPS_SCRIPT_URL ou APPS_SCRIPT_TOKEN absent');
  }

  const resp = await fetch(proxied(scriptUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, op: 'batch', operations })
  });

  if (!resp.ok) {
    throw new Error('Apps Script HTTP ' + resp.status);
  }
  const json = await resp.json();
  if (!json.ok) {
    throw new Error('Apps Script : ' + (json.error || 'erreur inconnue'));
  }
  return json;
}

/** Test de vie (GET) — renvoie le corps brut si ce n'est pas du JSON (utile au debug). */
export async function ping() {
  const scriptUrl = get('APPS_SCRIPT_URL');
  const resp = await fetch(proxied(scriptUrl));
  const text = await resp.text();
  if (!resp.ok) return { ok: false, status: resp.status, body: text.slice(0, 500) };
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'Réponse non-JSON', status: resp.status, body: text.slice(0, 500) };
  }
}

/** Helpers pour construire des opérations lisibles. */
export const op = {
  append: (sheet, row) => ({ sheet, action: 'append', row }),
  appendMany: (sheet, rows) => ({ sheet, action: 'appendMany', rows }),
  upsert: (sheet, key, row) => ({ sheet, action: 'upsert', key, row }),
  update: (sheet, key, row) => ({ sheet, action: 'update', key, row }),
  delete: (sheet, key, value) => ({ sheet, action: 'delete', key, value }),
  deleteMany: (sheet, key, values) => ({ sheet, action: 'deleteMany', key, values }),
  deleteWhere: (sheet, column, value) => ({ sheet, action: 'deleteWhere', column, value }),
};

/**
 * Helper unique pour construire une URL proxifiée via le Cloudflare Worker.
 * Prend la valeur courante de PROXY_URL depuis src/config.js (override via localStorage).
 */

import { get } from '../config.js';

/** Retourne `<PROXY>/proxy?url=<encoded>` en nettoyant un éventuel trailing slash. */
export function proxiedUrl(targetUrl) {
  const base = String(get('PROXY_URL') || '').replace(/\/+$/, '');
  if (!base) throw new Error('PROXY_URL non configuré');
  return base + '/proxy?url=' + encodeURIComponent(targetUrl);
}

/** Fetch HTML via proxy et retourne le texte brut. Lève si HTTP non-OK. */
export async function fetchHTMLProxy(url) {
  const resp = await fetch(proxiedUrl(url));
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' sur ' + url);
  return await resp.text();
}

/** Fetch JSON via proxy. Lève si HTTP non-OK ou JSON invalide. */
export async function fetchJSONProxy(url) {
  const resp = await fetch(proxiedUrl(url));
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ' sur ' + url);
  return await resp.json();
}

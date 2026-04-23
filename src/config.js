/**
 * Configuration centrale.
 *
 * Toutes les valeurs ici peuvent être surchargées via localStorage
 * sous la clé LS_PREFIX + nom (ex: `chtis.APPS_SCRIPT_URL`), utile pour
 * tester un autre environnement sans recompiler.
 */

const LS_PREFIX = 'chtis.';

const DEFAULTS = {
  // Proxy CORS Cloudflare Worker (réutilisé de l'app v1)
  PROXY_URL: 'https://raceresult-proxy.cypriendlt.workers.dev',

  // Nouveau Sheet "Base Club" (décidé 2026-04-23)
  SHEET_ID: '1TGLOqNV3R6C3S7jtUZojGdrfOKgnCQsE0Ne4yoOvF8c',

  // Apps Script Web App — endpoint d'écriture
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzdA6-RTYRWmdq_E1iWl9mSOa7fW8GltBfn_PeHDFrPJzlppR56zxYV9XdI0u-N5_4xJA/exec',

  // Token partagé (voir lessons/2026-04-23-token-choice.md)
  APPS_SCRIPT_TOKEN: 'cdel_06101999',

  // TTL cache localStorage en ms (5 min)
  CACHE_TTL_MS: 5 * 60 * 1000,
};

export const SHEETS = {
  ADHERENTS: 'Adherents',
  COURSES: 'Courses',
  RESULTATS: 'Resultats',
  OVERRIDES: 'Matching_Overrides',
  IMPORTS: 'Imports',
};

export function get(key) {
  const override = localStorage.getItem(LS_PREFIX + key);
  return override !== null ? override : DEFAULTS[key];
}

export function set(key, value) {
  if (value === null || value === undefined || value === '') {
    localStorage.removeItem(LS_PREFIX + key);
  } else {
    localStorage.setItem(LS_PREFIX + key, value);
  }
}

export function getAll() {
  const out = {};
  for (const k of Object.keys(DEFAULTS)) out[k] = get(k);
  return out;
}

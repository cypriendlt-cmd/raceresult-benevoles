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
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby_qwlXBu1gNThT6dUf0cp5LTZ1CRy9JRyZmMTDfHgTyS-QSujvby3Mwgfhf9jTuChrfA/exec',

  // Token partagé (voir lessons/2026-04-23-token-choice.md)
  APPS_SCRIPT_TOKEN: 'cdel_06101999',

  // TTL cache localStorage en ms (5 min)
  CACHE_TTL_MS: 5 * 60 * 1000,

  // Mot de passe admin (module sondages) — UX-only, pas une sécurité.
  // Bypassable via devtools. Vraie protection = côté Apps Script (non mise en place,
  // décision assumée 2026-04-24 : repo public + risque d'intégrité accepté).
  // Voir lessons/2026-04-24-module-sondages-acces.md
  ADMIN_PASSWORD: 'bureau-chtis',
};

export const SHEETS = {
  ADHERENTS: 'Adherents',
  COURSES: 'Courses',
  RESULTATS: 'Resultats',
  OVERRIDES: 'Matching_Overrides',
  IMPORTS: 'Imports',
  COURSES_CIBLEES: 'CoursesCiblees',
  REPONSES_SONDAGE: 'ReponsesSondage',
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

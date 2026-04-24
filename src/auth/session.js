/**
 * Session admin — UX-only (masque l'UI admin aux non-admins).
 *
 * PAS UNE SÉCURITÉ. Bypassable en une ligne de devtools. Décision assumée :
 * voir lessons/2026-04-24-module-sondages-acces.md (option B).
 *
 * Stocké en sessionStorage : expire à la fermeture du navigateur.
 */

import { get } from '../config.js';

const KEY = 'chtis.admin';

export function loginAdmin(password) {
  const attendu = String(get('ADMIN_PASSWORD') || '');
  if (!attendu) throw new Error('ADMIN_PASSWORD non configuré');
  if (String(password) !== attendu) return false;
  sessionStorage.setItem(KEY, '1');
  return true;
}

export function logoutAdmin() {
  sessionStorage.removeItem(KEY);
}

export function isAdmin() {
  return sessionStorage.getItem(KEY) === '1';
}

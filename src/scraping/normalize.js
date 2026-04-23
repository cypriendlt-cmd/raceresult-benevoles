/**
 * Normalisation commune appliquée à la sortie de chaque parseur pour respecter le
 * contrat J3 (voir CLAUDE.md §3bis). Chaque parseur produit des lignes brutes,
 * `normalizeLigne` produit la forme canonique :
 *
 *   {
 *     prenom_source, nom_source,
 *     temps, temps_net, temps_sec,
 *     rang_general, rang_categorie,
 *     categorie, sexe_source, club_source, dossard
 *   }
 *
 * Inconnu → null. Pas de string vide sur champs nullable : on préfère null.
 */

import { parseTemps } from '../utils/time.js';
import { parseDate } from '../utils/date.js';

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function sexeFrom(raw, categorie) {
  const s = (raw || '').toString().trim().toUpperCase();
  if (s === 'M' || s === 'H') return 'M';
  if (s === 'F' || s === 'W') return 'F';
  // Déduction depuis catégorie si format type "SEM" / "SEF" / "M40H" / "V1F"
  const c = (categorie || '').toString().toUpperCase();
  if (/(^|[^A-Z])(SEM|CAM|JUM|ESM|VEM|MAM|MSH)([^A-Z]|$)|M$|H$/.test(c)) {
    if (/F$/.test(c)) return 'F';
    if (/M$|H$/.test(c)) return 'M';
  }
  return null;
}

/**
 * Normalise une ligne brute. L'appelant fournit un objet mixte avec les champs
 * communs attendus (prenom, nom, tempsOfficiel, tempsNet, rang, categorie, etc.).
 * Renvoie `null` si prenom_source et nom_source sont tous deux vides (ligne invalide).
 */
export function normalizeLigne(raw) {
  const prenom = trimOrNull(raw.prenom || raw.prenom_source);
  const nom = trimOrNull(raw.nom || raw.nom_source);
  if (!prenom && !nom) return null;

  const off = parseTemps(raw.tempsOfficiel || raw.temps);
  const net = parseTemps(raw.tempsNet || raw.temps_net || raw.tempsOfficiel || raw.temps);

  return {
    prenom_source: prenom || '',
    nom_source: nom || '',
    temps: off.formatted,          // gun time (brut, depuis le coup de départ)
    temps_net: net.formatted,      // chip time (net, depuis la ligne de départ)
    // temps_sec reflète le NET car c'est ce qui est affiché & trié partout
    temps_sec: net.seconds !== null ? net.seconds : off.seconds,
    rang_general: toNumberOrNull(raw.rang || raw.rang_general),
    rang_categorie: toNumberOrNull(raw.rang_categorie),
    categorie: trimOrNull(raw.categorie),
    sexe_source: sexeFrom(raw.sexe || raw.sexe_source, raw.categorie),
    club_source: trimOrNull(raw.club || raw.club_source),
    dossard: trimOrNull(raw.dossard),
  };
}

/**
 * Construit un objet course canonique (retire les champs vides → null, garantit
 * les clés du schéma). Laisse `nom` au parseur (obligatoire).
 */
export function normalizeCourse(raw) {
  if (!raw || !raw.nom) {
    throw new Error('normalizeCourse : champ "nom" obligatoire');
  }
  return {
    nom: String(raw.nom).trim(),
    date: parseDate(raw.date) || (raw.date ? String(raw.date).trim() : null),
    lieu: trimOrNull(raw.lieu),
    distance_km: typeof raw.distance_km === 'number' ? raw.distance_km : null,
    type: trimOrNull(raw.type),
    organisateur: trimOrNull(raw.organisateur),
    source: String(raw.source || '').trim(),
    source_event_id: trimOrNull(raw.source_event_id),
    url: trimOrNull(raw.url),
  };
}

/**
 * Déduit un type de course grossier depuis la distance ou le nom.
 * "marathon" / "semi" / "10km" / "trail" / null
 */
export function deduireType({ nom = '', distance_km = null }) {
  const n = String(nom).toLowerCase();
  if (/trail/.test(n)) return 'trail';
  if (/semi[- ]?marathon|half/.test(n)) return 'semi';
  if (/marathon/.test(n)) return 'marathon';
  if (distance_km !== null) {
    if (Math.abs(distance_km - 42.195) < 0.5) return 'marathon';
    if (Math.abs(distance_km - 21.0975) < 0.3) return 'semi';
    if (Math.abs(distance_km - 10) < 0.3) return '10km';
  }
  return null;
}

/** Parse "10 km" / "10km" / "10.5 km" / "42,195 km" → number en km ou null. */
export function parseDistanceKm(txt) {
  if (!txt) return null;
  const m = String(txt).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*k?m?/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

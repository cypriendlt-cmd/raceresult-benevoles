/**
 * Façade store pour les sondages "Vie du club" (J9).
 *
 * Onglets : SondagesClub (admin en écriture, lecture libre),
 * ReponsesSondagesClub (lecture + append + upsert libres).
 *
 * Convention options : séparateur `|` (pas la virgule, qui peut apparaître
 * dans un libellé "Samedi 10h, salle B"). Trim + filter vides.
 *
 * IDs :
 *  - sondage : random à la création (admin peut renommer librement).
 *  - réponse : stable sur (sondage_id, adherent_id ou prenom+nom) → upsert.
 */

import { SHEETS } from '../config.js';
import { readTab } from './sheets.js';
import { sendBatch, op } from './appsScript.js';
import { getCached, setCached, invalidate } from './cache.js';
import { stableId, randomId } from '../utils/id.js';

const TTL_MS = 30 * 1000;
const SEP = '|';

export const TYPES = ['unique', 'multi'];

// ============================================================
// IDs
// ============================================================

export function reponseClubId({ sondage_id, adherent_id, prenom, nom }) {
  if (adherent_id) return stableId('repsc', sondage_id, adherent_id);
  return stableId('repsc', sondage_id, prenom, nom);
}

// ============================================================
// Options : parse / format
// ============================================================

export function parseOptions(s) {
  if (!s) return [];
  return String(s).split(SEP).map(o => o.trim()).filter(Boolean);
}

export function formatOptions(arr) {
  return (arr || []).map(o => String(o).trim()).filter(Boolean).join(SEP);
}

// ============================================================
// Lectures
// ============================================================

async function readCached(tab) {
  const k = 'tab:' + tab;
  const cached = getCached(k);
  if (cached) return cached;
  const data = await readTab(tab);
  setCached(k, data, TTL_MS);
  return data;
}

export async function listAll() {
  return readCached(SHEETS.SONDAGES_CLUB);
}

export async function listPubliees() {
  const rows = await listAll();
  return rows.filter(s => s.statut === 'publiee');
}

export async function get(id) {
  const rows = await listAll();
  return rows.find(s => s.id === id) || null;
}

export async function listReponses() {
  return readCached(SHEETS.REPONSES_CLUB);
}

export async function listReponsesPourSondage(sondageId) {
  const rows = await listReponses();
  return rows.filter(r => r.sondage_id === sondageId);
}

/** Compteurs par option : { 'Samedi 9h': 3, ... , total: N } */
export function compterReponses(reponses, options) {
  const c = { total: reponses.length };
  for (const o of options) c[o] = 0;
  for (const r of reponses) {
    for (const sel of parseOptions(r.options_choisies)) {
      if (sel in c) c[sel]++;
    }
  }
  return c;
}

// ============================================================
// Écritures — sondages (admin)
// ============================================================

/**
 * Upsert d'un sondage club.
 * Si pas d'id : génère un random `sc_xxx`.
 * Si options retirées et `anciennesOptions` fourni, retire ces valeurs des
 * réponses existantes (sans supprimer la réponse elle-même).
 *
 * @returns {{ sondage, raw, optionsReinitialisees: number }}
 */
export async function save(sondage, { anciennesOptions } = {}) {
  if (!sondage.titre) throw new Error('titre requis');
  if (!TYPES.includes(sondage.type_reponse)) throw new Error('type_reponse doit être "unique" ou "multi"');
  const opts = parseOptions(sondage.options);
  if (opts.length < 2) throw new Error('au moins 2 options requises');

  const now = new Date().toISOString();
  const payload = {
    afficher_participants: 'oui',
    autoriser_modif_reponse: 'oui',
    statut: 'brouillon',
    description: '',
    date_debut: '',
    date_fin: '',
    date_limite_reponse: '',
    created_by: '',
    ...sondage,
    options: formatOptions(opts),
    id: sondage.id || randomId('sc'),
    created_at: sondage.created_at || now,
    updated_at: now,
  };
  const res = await sendBatch([op.upsert(SHEETS.SONDAGES_CLUB, 'id', payload)]);
  invalidate('tab:' + SHEETS.SONDAGES_CLUB);

  // Cleanup des options retirées dans les réponses existantes
  let optionsReinitialisees = 0;
  if (anciennesOptions !== undefined) {
    const oldL = parseOptions(anciennesOptions);
    const newSet = new Set(opts);
    const removed = oldL.filter(o => !newSet.has(o));
    if (removed.length) {
      const reps = await listReponsesPourSondage(payload.id);
      const removedSet = new Set(removed);
      const aReset = [];
      for (const r of reps) {
        const sel = parseOptions(r.options_choisies);
        const keep = sel.filter(o => !removedSet.has(o));
        if (keep.length !== sel.length) {
          aReset.push({ ...r, options_choisies: formatOptions(keep), updated_at: now });
        }
      }
      if (aReset.length) {
        await sendBatch(aReset.map(r => op.upsert(SHEETS.REPONSES_CLUB, 'id', r)));
        invalidate('tab:' + SHEETS.REPONSES_CLUB);
        optionsReinitialisees = aReset.length;
      }
    }
  }

  return { sondage: payload, raw: res, optionsReinitialisees };
}

/** Supprime un sondage ET toutes les réponses associées. */
export async function remove(sondageId) {
  const res = await sendBatch([
    op.deleteWhere(SHEETS.REPONSES_CLUB, 'sondage_id', sondageId),
    op.delete(SHEETS.SONDAGES_CLUB, 'id', sondageId),
  ]);
  invalidate('tab:' + SHEETS.SONDAGES_CLUB);
  invalidate('tab:' + SHEETS.REPONSES_CLUB);
  return res;
}

// ============================================================
// Écritures — réponses (public)
// ============================================================

/**
 * Enregistre une réponse (upsert).
 *
 * @param {object} r
 * @param {string} r.sondage_id
 * @param {string} [r.adherent_id]
 * @param {string} r.prenom
 * @param {string} r.nom
 * @param {string[]} r.options_choisies
 */
export async function saveReponse(r) {
  if (!r.sondage_id) throw new Error('sondage_id requis');
  // Saisie libre autorisée : prenom peut être vide tant que `nom` (ou le texte libre) est rempli.
  if (!r.nom && !r.prenom) throw new Error('nom requis');
  if (!Array.isArray(r.options_choisies) || !r.options_choisies.length) {
    throw new Error('au moins une option doit être choisie');
  }
  const now = new Date().toISOString();
  const payload = {
    id: reponseClubId(r),
    sondage_id: r.sondage_id,
    adherent_id: r.adherent_id || '',
    prenom: r.prenom,
    nom: r.nom,
    options_choisies: formatOptions(r.options_choisies),
    created_at: r.created_at || now,
    updated_at: now,
  };
  const res = await sendBatch([op.upsert(SHEETS.REPONSES_CLUB, 'id', payload)]);
  invalidate('tab:' + SHEETS.REPONSES_CLUB);
  return { reponse: payload, raw: res };
}

export async function trouverReponseExistante({ sondage_id, adherent_id, prenom, nom }) {
  const id = reponseClubId({ sondage_id, adherent_id, prenom, nom });
  const rows = await listReponses();
  return rows.find(r => r.id === id) || null;
}

export async function deleteReponse(id) {
  if (!id) throw new Error('id requis');
  const res = await sendBatch([op.delete(SHEETS.REPONSES_CLUB, 'id', id)]);
  invalidate('tab:' + SHEETS.REPONSES_CLUB);
  return res;
}

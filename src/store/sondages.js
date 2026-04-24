/**
 * Façade store pour le module sondages.
 *
 * Onglets touchés : CoursesCiblees (admin en écriture, lecture libre),
 * ReponsesSondage (lecture + append + upsert libres).
 *
 * Voir docs/SHEETS_SCHEMA.md §6 et §7 pour le schéma exact.
 */

import { SHEETS } from '../config.js';
import { readTab } from './sheets.js';
import { sendBatch, op } from './appsScript.js';
import { getCached, setCached, invalidate } from './cache.js';
import { stableId } from '../utils/id.js';

const TTL_SONDAGES_MS = 30 * 1000; // courses/réponses bougent plus vite que les résultats

// ============================================================
// IDs stables
// ============================================================

/** ID de course ciblée : stable sur (date, nom normalisé). */
export function courseCibleeId({ date, nom }) {
  return stableId('cc', date, nom);
}

/** ID de réponse : un adhérent = une réponse par course ciblée. Upsert naturel. */
export function reponseId({ course_ciblee_id, adherent_id, prenom, nom }) {
  if (adherent_id) return stableId('rep', course_ciblee_id, adherent_id);
  return stableId('rep', course_ciblee_id, prenom, nom);
}

// ============================================================
// Lectures
// ============================================================

async function readCached(tab, ttl) {
  const k = 'tab:' + tab;
  const cached = getCached(k);
  if (cached) return cached;
  const data = await readTab(tab);
  setCached(k, data, ttl);
  return data;
}

/** Toutes les courses ciblées (tous statuts confondus). */
export async function listCoursesCiblees() {
  return readCached(SHEETS.COURSES_CIBLEES, TTL_SONDAGES_MS);
}

/** Courses ciblées visibles côté adhérent (statut = publiee). */
export async function listCoursesPubliees() {
  const rows = await listCoursesCiblees();
  return rows.filter(c => c.statut === 'publiee');
}

/** Une course ciblée par id. */
export async function getCourseCiblee(id) {
  const rows = await listCoursesCiblees();
  return rows.find(c => c.id === id) || null;
}

/** Toutes les réponses (on filtre côté appelant par course_ciblee_id). */
export async function listReponses() {
  return readCached(SHEETS.REPONSES_SONDAGE, TTL_SONDAGES_MS);
}

/** Réponses pour une course ciblée donnée. */
export async function listReponsesPourCourse(courseCibleeId) {
  const rows = await listReponses();
  return rows.filter(r => r.course_ciblee_id === courseCibleeId);
}

/** Compteurs par type de réponse pour une course ciblée. */
export function compterReponses(reponses) {
  const c = { oui: 0, non: 0, peut_etre: 0, total: 0 };
  for (const r of reponses) {
    if (r.reponse === 'oui' || r.reponse === 'non' || r.reponse === 'peut_etre') {
      c[r.reponse]++;
      c.total++;
    }
  }
  return c;
}

// ============================================================
// Écritures — courses ciblées (admin)
// ============================================================

/**
 * Upsert d'une course ciblée.
 * Si pas d'id, génère un courseCibleeId stable.
 * Remplit created_at / updated_at.
 */
export async function saveCourseCiblee(course) {
  const now = new Date().toISOString();
  const payload = {
    afficher_participants: 'oui',
    autoriser_modif_reponse: 'oui',
    statut: 'brouillon',
    ...course,
    id: course.id || courseCibleeId(course),
    created_at: course.created_at || now,
    updated_at: now,
  };
  const res = await sendBatch([op.upsert(SHEETS.COURSES_CIBLEES, 'id', payload)]);
  invalidate('tab:' + SHEETS.COURSES_CIBLEES);
  return { course: payload, raw: res };
}

/** Supprime une course ciblée ET toutes les réponses associées. */
export async function deleteCourseCiblee(courseCibleeId) {
  const res = await sendBatch([
    op.deleteWhere(SHEETS.REPONSES_SONDAGE, 'course_ciblee_id', courseCibleeId),
    op.delete(SHEETS.COURSES_CIBLEES, 'id', courseCibleeId),
  ]);
  invalidate('tab:' + SHEETS.COURSES_CIBLEES);
  invalidate('tab:' + SHEETS.REPONSES_SONDAGE);
  return res;
}

// ============================================================
// Écritures — réponses (public)
// ============================================================

/**
 * Enregistre une réponse (upsert sur id stable → modifie si déjà répondu).
 *
 * @param {object} r
 * @param {string} r.course_ciblee_id
 * @param {string} [r.adherent_id]
 * @param {string} r.prenom
 * @param {string} r.nom
 * @param {'oui'|'non'|'peut_etre'} r.reponse
 * @param {string} [r.distance_choisie] — valeur prise dans CoursesCiblees.distances
 */
export async function saveReponse(r) {
  if (!r.course_ciblee_id) throw new Error('course_ciblee_id requis');
  if (!r.prenom || !r.nom) throw new Error('prenom + nom requis');
  if (!['oui', 'non', 'peut_etre'].includes(r.reponse)) {
    throw new Error('reponse doit être oui / non / peut_etre');
  }
  const now = new Date().toISOString();
  const payload = {
    id: reponseId(r),
    course_ciblee_id: r.course_ciblee_id,
    adherent_id: r.adherent_id || '',
    prenom: r.prenom,
    nom: r.nom,
    reponse: r.reponse,
    distance_choisie: r.distance_choisie || '',
    created_at: r.created_at || now,
    updated_at: now,
  };
  const res = await sendBatch([op.upsert(SHEETS.REPONSES_SONDAGE, 'id', payload)]);
  invalidate('tab:' + SHEETS.REPONSES_SONDAGE);
  return { reponse: payload, raw: res };
}

/** Parse le champ `distances` en liste normalisée. Retourne [] si vide. */
export function parseDistances(raw) {
  return String(raw || '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean);
}

/** Retrouve la réponse existante d'un adhérent pour une course (pour pré-remplir). */
export async function trouverReponseExistante({ course_ciblee_id, adherent_id, prenom, nom }) {
  const id = reponseId({ course_ciblee_id, adherent_id, prenom, nom });
  const rows = await listReponses();
  return rows.find(r => r.id === id) || null;
}

/** Supprime une réponse (admin). */
export async function deleteReponse(id) {
  if (!id) throw new Error('id requis');
  const res = await sendBatch([op.delete(SHEETS.REPONSES_SONDAGE, 'id', id)]);
  invalidate('tab:' + SHEETS.REPONSES_SONDAGE);
  return res;
}

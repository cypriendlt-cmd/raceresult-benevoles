/**
 * Façade API pour toute la couche persistance.
 *
 * Si on migre un jour Sheets → backend SQLite (option A2), seul ce fichier
 * et ses enfants `sheets.js` / `appsScript.js` changent.
 */

import { SHEETS } from '../config.js';
import { readTab } from './sheets.js';
import { sendBatch, op } from './appsScript.js';
import { getCached, setCached, invalidate, invalidateAll } from './cache.js';
import { randomId, stableId, courseId, resultatId, importId } from '../utils/id.js';

// ============================================================
// Lectures (avec cache)
// ============================================================

async function readCached(tab, ttl, transform) {
  const cached = getCached('tab:' + tab);
  if (cached) return cached;
  let data = await readTab(tab);
  if (transform) data = transform(data);
  setCached('tab:' + tab, data, ttl);
  return data;
}

/**
 * Normalise la lecture des adhérents :
 *  - génère un id stable si manquant (basé sur prenom+nom normalisés)
 *  - convertit `actif` TRUE/FALSE → oui/non
 *  - ignore les lignes vides (prénom ET nom vides)
 * L'id généré reste stable tant que prenom+nom ne changent pas — on pourra
 * plus tard offrir un bouton "synchroniser les IDs" pour les écrire au Sheet.
 */
function normaliserAdherents(rows) {
  return rows
    .filter(r => (r.prenom || '').trim() || (r.nom || '').trim())
    .map(r => {
      const id = r.id && r.id.trim() ? r.id.trim() : stableId('adh', r.prenom, r.nom);
      const actif = String(r.actif || '').toLowerCase();
      const actifNorm = ['true', 'vrai', '1', 'oui', 'o', 'y', 'yes', ''].includes(actif) ? 'oui' : 'non';
      return { ...r, id, actif: actifNorm };
    });
}

export const read = {
  adherents:  () => readCached(SHEETS.ADHERENTS, null, normaliserAdherents),
  courses:    () => readCached(SHEETS.COURSES),
  resultats:  () => readCached(SHEETS.RESULTATS),
  overrides:  () => readCached(SHEETS.OVERRIDES),
  imports:    () => readCached(SHEETS.IMPORTS),
};

export async function refreshAll() {
  invalidateAll();
  const [adherents, courses, resultats, overrides, imports] = await Promise.all([
    read.adherents(), read.courses(), read.resultats(), read.overrides(), read.imports()
  ]);
  return { adherents, courses, resultats, overrides, imports };
}

// ============================================================
// Écritures
// ============================================================

/**
 * Persiste un import complet (course + résultats + ligne Imports).
 * Assigne les IDs s'ils ne sont pas fournis.
 *
 * @param {object} params
 * @param {object} params.course          — métadonnées course (sans id nécessaire)
 * @param {Array<object>} params.resultats — résultats (sans id, doivent contenir match_status)
 * @param {object} params.importMeta      — { source, url, user, lignes_totales, lignes_ignorees, lignes_douteuses }
 */
export async function saveImport({ course, resultats, importMeta }) {
  // Assigner IDs stables
  if (!course.id) course.id = courseId(course);
  if (!course.created_at) course.created_at = new Date().toISOString();

  const imp = {
    id: importId(),
    date: new Date().toISOString(),
    course_id: course.id,
    status: 'success',
    lignes_importees: resultats.length,
    ...importMeta,
  };

  // L'ordre compte : on met ...r en premier puis on écrase avec nos champs
  // de confiance (course_id, import_id, id, created_at). Sinon un r.course_id
  // traînant pollue l'écriture.
  const resRows = resultats.map(r => ({
    ...r,
    id: r.id || resultatId({ course_id: course.id, ...r }),
    course_id: course.id,
    import_id: imp.id,
    created_at: new Date().toISOString(),
  }));

  console.debug('[saveImport] course.id =', course.id, '→', resRows.length, 'résultats');

  const result = await sendBatch([
    op.upsert(SHEETS.COURSES, 'id', course),
    op.appendMany(SHEETS.RESULTATS, resRows),
    op.append(SHEETS.IMPORTS, imp),
  ]);

  // invalider les caches concernés
  invalidate('tab:' + SHEETS.COURSES);
  invalidate('tab:' + SHEETS.RESULTATS);
  invalidate('tab:' + SHEETS.IMPORTS);

  return { import: imp, course, resultats: resRows, raw: result };
}

/** Upsert d'un adhérent (génère un id si absent). */
export async function saveAdherent(adherent) {
  if (!adherent.id) adherent.id = randomId('adh');
  const result = await sendBatch([op.upsert(SHEETS.ADHERENTS, 'id', adherent)]);
  invalidate('tab:' + SHEETS.ADHERENTS);
  return { adherent, raw: result };
}

/** Enregistre une décision de matching manuel. */
export async function saveOverride(override) {
  if (!override.id) override.id = randomId('ovr');
  if (!override.created_at) override.created_at = new Date().toISOString();
  const result = await sendBatch([op.append(SHEETS.OVERRIDES, override)]);
  invalidate('tab:' + SHEETS.OVERRIDES);
  return { override, raw: result };
}

/**
 * Supprime un import : résultats associés + ligne Imports + éventuellement
 * la course si plus aucun import ne la référence.
 */
export async function deleteImport(imp) {
  const [imports] = await Promise.all([read.imports()]);
  const autresImports = imports.filter(i => i.id !== imp.id && i.course_id === imp.course_id);
  const deleteCourseAussi = autresImports.length === 0 && imp.course_id;

  const ops = [
    op.deleteWhere(SHEETS.RESULTATS, 'import_id', imp.id),
    op.delete(SHEETS.IMPORTS, 'id', imp.id),
  ];
  if (deleteCourseAussi) ops.push(op.delete(SHEETS.COURSES, 'id', imp.course_id));

  const result = await sendBatch(ops);
  invalidate('tab:' + SHEETS.RESULTATS);
  invalidate('tab:' + SHEETS.IMPORTS);
  if (deleteCourseAussi) invalidate('tab:' + SHEETS.COURSES);
  return { deletedCourse: deleteCourseAussi, raw: result };
}

/**
 * Vérifie si une course équivalente existe déjà.
 * Match par `source + source_event_id` si dispo, sinon par `nom normalisé + date`.
 */
export async function findCourseExistante(course) {
  const courses = await read.courses();
  if (course.source && course.source_event_id) {
    const exact = courses.find(c =>
      c.source === course.source && String(c.source_event_id) === String(course.source_event_id)
    );
    if (exact) return exact;
  }
  const nomN = (course.nom || '').toLowerCase().trim();
  return courses.find(c => (c.nom || '').toLowerCase().trim() === nomN && c.date === course.date) || null;
}

// Re-exports utiles
export { op, sendBatch, invalidateAll };

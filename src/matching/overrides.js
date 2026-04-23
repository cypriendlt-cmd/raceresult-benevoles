/**
 * Application des décisions manuelles de matching (onglet Matching_Overrides).
 *
 * Types supportés :
 *   - `force_match`  : telle chaîne source → toujours cet adhérent (scope global ou par course)
 *   - `refuse_match` : telle chaîne source ne doit JAMAIS être matchée à cet adhérent
 *   - `alias`        : variante connue d'un adhérent (équivalent à force_match global)
 */

import { normaliser } from './normalize.js';

/** Clé source normalisée pour lookup. */
function cleSource(prenom, nom) {
  return normaliser(prenom) + '|' + normaliser(nom);
}

/**
 * Construit un index d'overrides pour consultation rapide.
 *
 * @returns {{
 *   forced: Map<string, string>,        // "prenom|nom" → adherent_id (scope global)
 *   forcedByCourse: Map<string, Map<string, string>>, // courseId → Map
 *   refused: Map<string, Set<string>>,  // "prenom|nom" → Set<adherent_id> refusés
 *   aliases: Map<string, string>,       // "prenom|nom" → adherent_id
 * }}
 */
export function indexOverrides(overrides) {
  const forced = new Map();
  const forcedByCourse = new Map();
  const refused = new Map();
  const aliases = new Map();

  for (const o of overrides || []) {
    const key = cleSource(o.prenom_source, o.nom_source);
    const scope = o.scope || 'global';
    if (o.type === 'alias' && o.adherent_id) {
      aliases.set(key, o.adherent_id);
    } else if (o.type === 'force_match' && o.adherent_id) {
      if (scope === 'course' && o.course_id) {
        if (!forcedByCourse.has(o.course_id)) forcedByCourse.set(o.course_id, new Map());
        forcedByCourse.get(o.course_id).set(key, o.adherent_id);
      } else {
        forced.set(key, o.adherent_id);
      }
    } else if (o.type === 'refuse_match' && o.adherent_id) {
      if (!refused.has(key)) refused.set(key, new Set());
      refused.get(key).add(o.adherent_id);
    }
  }

  return { forced, forcedByCourse, refused, aliases };
}

/**
 * Tente un match forcé. Retourne { adherent_id, reason } ou null.
 * L'ordre de priorité : alias > force_match par course > force_match global.
 */
export function appliquerOverride(index, { prenom_source, nom_source }, courseId) {
  const key = cleSource(prenom_source, nom_source);
  const alias = index.aliases.get(key);
  if (alias) return { adherent_id: alias, reason: 'alias' };

  if (courseId) {
    const byCourse = index.forcedByCourse.get(courseId);
    if (byCourse && byCourse.has(key)) {
      return { adherent_id: byCourse.get(key), reason: 'force_match_course' };
    }
  }
  const forced = index.forced.get(key);
  if (forced) return { adherent_id: forced, reason: 'force_match_global' };
  return null;
}

/** Vrai si un adhérent précis est explicitement refusé pour cette source. */
export function estRefuse(index, { prenom_source, nom_source }, adherent_id) {
  const key = cleSource(prenom_source, nom_source);
  const refused = index.refused.get(key);
  return !!(refused && refused.has(adherent_id));
}

/** Génération d'identifiants stables. */

export function randomId(prefix) {
  const base = (crypto?.randomUUID?.() || String(Date.now()) + '_' + Math.random().toString(36).slice(2, 10))
    .replace(/-/g, '')
    .slice(0, 12);
  return prefix ? prefix + '_' + base : base;
}

/** ID reproductible à partir d'une chaîne (djb2 → base36). */
export function stableId(prefix, ...parts) {
  const input = parts.map(p => String(p || '').toLowerCase().trim()).join('|');
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  const hex = (h >>> 0).toString(36);
  return prefix ? prefix + '_' + hex : hex;
}

/** ID de course stable : source + eventId si dispo, sinon normalisation nom+date. */
export function courseId({ source, source_event_id, nom, date }) {
  if (source && source_event_id) {
    return stableId('course', source, source_event_id);
  }
  return stableId('course', nom, date);
}

/** ID de résultat stable (clé de dédup). */
export function resultatId({ course_id, prenom_source, nom_source, temps }) {
  return stableId('res', course_id, prenom_source, nom_source, temps);
}

export function importId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
                '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  return 'imp_' + stamp + '_' + Math.random().toString(36).slice(2, 6);
}

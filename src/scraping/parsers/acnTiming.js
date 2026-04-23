/**
 * Parseur ACN-Timing / ChronoRace.
 *
 * L'API publique expose une "table" paginée ; on demande un pageSize large
 * (20000) pour tout rapatrier en un appel. Le format récent groupe les lignes
 * dans `Groups[].SlaveRows` ; format historique = `Rows[]`.
 *
 * Les colonnes varient selon l'épreuve (FieldIdx ≠ index positionnel) : on les
 * identifie via `TableDefinition.Columns[].Name`/`DisplayName` avec fallback
 * positions standard en dernier recours.
 */

import { fetchJSONProxy } from '../../utils/proxy.js';
import { stripHTML, splitNomPrenom } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse } from '../normalize.js';

export async function scrape({ context, section, url }) {
  if (!context || !section) throw new Error('ACN : context/section manquant dans l\'URL');
  const apiUrl =
    'https://results.chronorace.be/api/results/table/search/' +
    encodeURIComponent(context) + '/' + encodeURIComponent(section) +
    '?srch=&pageSize=20000&fromRecord=0';

  let data;
  try {
    data = await fetchJSONProxy(apiUrl);
  } catch (e) {
    throw new Error('ACN-Timing : échec de la requête pour ' + context + '/' + section + ' (' + e.message + ')');
  }

  const lignes = parseData(data);
  if (lignes.length === 0) {
    throw new Error('ACN-Timing : aucune ligne exploitable pour ' + context + '/' + section);
  }

  return {
    courses: [
      {
        course: normalizeCourse({
          nom: section.replace(/[_-]+/g, ' '),
          source: 'acn',
          source_event_id: context + '/' + section,
          url,
        }),
        lignes,
      },
    ],
  };
}

/** Exposé pour tests : parse une réponse JSON ACN en lignes normalisées. */
export function parseData(data) {
  let rows = null;
  if (data && Array.isArray(data.Groups)) {
    rows = [];
    data.Groups.forEach((g) => {
      if (Array.isArray(g.SlaveRows)) g.SlaveRows.forEach((r) => rows.push(r));
    });
  } else if (data && Array.isArray(data.Rows)) {
    rows = data.Rows;
  }
  if (!rows) throw new Error('ACN-Timing : aucune ligne trouvée dans la réponse');

  const cols = (data.TableDefinition && data.TableDefinition.Columns) || [];
  const idx = { pos: -1, dossard: -1, nom: -1, temps: -1, cat: -1 };
  cols.forEach((c, i) => {
    const name = (c.Name || '').toLowerCase();
    const disp = (c.DisplayName || '').toLowerCase();
    if (idx.pos === -1 && (name.includes('pos') || disp === 'pos')) idx.pos = i;
    else if (idx.dossard === -1 && (name.includes('#nr') || disp === '#nr' || disp === 'nr')) idx.dossard = i;
    else if (idx.nom === -1 && (name === '#name' || disp === '#name' || disp === 'name')) idx.nom = i;
    else if (idx.temps === -1 && (name.includes('#time') || disp === '#time')) idx.temps = i;
    else if (idx.cat === -1 && (name.includes('#cat') || disp === '#cat')) idx.cat = i;
  });

  if (idx.pos === -1) idx.pos = 0;
  if (idx.dossard === -1) idx.dossard = 1;
  if (idx.nom === -1) idx.nom = 3;
  if (idx.temps === -1) idx.temps = 6;
  if (idx.cat === -1) idx.cat = 9;

  const out = [];
  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    const rang = stripHTML(row[idx.pos] || '').replace(/\.$/, '');
    const dossard = stripHTML(row[idx.dossard] || '');
    const nomBrut = stripHTML(row[idx.nom] || '');
    const tempsBrut = stripHTML(row[idx.temps] || '');
    const tempsMatch = tempsBrut.match(/\d{1,2}:\d{2}(?::\d{2})?/);
    const temps = tempsMatch ? tempsMatch[0] : tempsBrut;
    const categorie = stripHTML(row[idx.cat] || '');
    const np = splitNomPrenom(nomBrut);
    if (!np.nom && !np.prenom) return;
    const ligne = normalizeLigne({
      prenom: np.prenom,
      nom: np.nom,
      tempsOfficiel: temps,
      tempsNet: temps,
      rang,
      categorie,
      dossard,
    });
    if (ligne) out.push(ligne);
  });
  return out;
}

/** Lecture d'onglets Google Sheets via export CSV public. */

import { get } from '../config.js';
import { parseCSV, rowsToObjects } from '../utils/csv.js';

/** URL d'export CSV d'un onglet nommé (le Sheet doit être partagé en lecture publique). */
function sheetCsvUrl(sheetId, tabName) {
  return 'https://docs.google.com/spreadsheets/d/' + sheetId +
         '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(tabName);
}

function proxied(url) {
  const proxy = get('PROXY_URL').replace(/\/$/, '');
  return proxy + '/proxy?url=' + encodeURIComponent(url);
}

/** Lit un onglet et retourne une liste d'objets (clés = en-têtes). */
export async function readTab(tabName, { sheetId } = {}) {
  const id = sheetId || get('SHEET_ID');
  const url = proxied(sheetCsvUrl(id, tabName));
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error('Lecture onglet "' + tabName + '" échouée : HTTP ' + resp.status);
  }
  const text = await resp.text();
  // gviz renvoie parfois du HTML d'erreur si le Sheet n'est pas public
  if (text.trim().startsWith('<')) {
    throw new Error('Onglet "' + tabName + '" : Sheet non public ou onglet absent');
  }
  const rows = parseCSV(text);
  return rowsToObjects(rows);
}

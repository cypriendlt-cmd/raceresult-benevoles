/**
 * Ch'tis Marathoniens — Apps Script Web App d'écriture
 *
 * Déploiement : voir docs/APPS_SCRIPT.md
 *
 * ⚠️ Remplace SHARED_TOKEN par une valeur secrète (ex : UUID aléatoire).
 *    La même valeur doit être mise dans src/config.js côté frontend.
 */

const SHARED_TOKEN = 'CHANGE_ME_REMPLACE_PAR_UN_TOKEN_ALEATOIRE';

const ALLOWED_SHEETS = [
  'Adherents',
  'Courses',
  'Resultats',
  'Matching_Overrides',
  'Imports',
  'CoursesCiblees',
  'ReponsesSondage'
];

/** Point d'entrée POST — toute l'app tape ici. */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SHARED_TOKEN) {
      return jsonResponse({ ok: false, error: 'invalid token' });
    }
    if (body.op !== 'batch' || !Array.isArray(body.operations)) {
      return jsonResponse({ ok: false, error: 'op must be "batch" with operations[]' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const results = [];
    const lock = LockService.getScriptLock();
    lock.waitLock(30000); // éviter écritures concurrentes

    try {
      for (let i = 0; i < body.operations.length; i++) {
        const op = body.operations[i];
        if (ALLOWED_SHEETS.indexOf(op.sheet) === -1) {
          return jsonResponse({ ok: false, error: 'sheet not allowed: ' + op.sheet, operation_index: i });
        }
        const sheet = ss.getSheetByName(op.sheet);
        if (!sheet) {
          return jsonResponse({ ok: false, error: 'sheet not found: ' + op.sheet, operation_index: i });
        }
        const headers = getHeaders(sheet);
        const res = applyOp(sheet, headers, op);
        results.push(Object.assign({ sheet: op.sheet, action: op.action }, res));
      }
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true, results: results });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

/** GET simple pour test de vie. */
function doGet() {
  return jsonResponse({ ok: true, service: 'chtis-resultats-writer', version: 1 });
}

/** Applique une opération unique sur un onglet. */
function applyOp(sheet, headers, op) {
  switch (op.action) {
    case 'append':       return opAppend(sheet, headers, op.row);
    case 'appendMany':   return opAppendMany(sheet, headers, op.rows);
    case 'upsert':       return opUpsert(sheet, headers, op.key, op.row);
    case 'update':       return opUpdate(sheet, headers, op.key, op.row);
    case 'delete':       return opDelete(sheet, headers, op.key, op.value);
    case 'deleteMany':   return opDeleteMany(sheet, headers, op.key, op.values);
    case 'deleteWhere':  return opDeleteWhere(sheet, headers, op.column, op.value);
    default:
      throw new Error('action inconnue: ' + op.action);
  }
}

function opAppend(sheet, headers, row) {
  sheet.appendRow(rowToArray(headers, row));
  return { count: 1 };
}

function opAppendMany(sheet, headers, rows) {
  if (!rows || rows.length === 0) return { count: 0 };
  const values = rows.map(function(r) { return rowToArray(headers, r); });
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, headers.length).setValues(values);
  return { count: values.length };
}

function opUpsert(sheet, headers, keyCol, row) {
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('colonne-clé absente: ' + keyCol);
  const keyVal = row[keyCol];
  const found = findRowByKey(sheet, keyIdx, keyVal);
  if (found === -1) {
    sheet.appendRow(rowToArray(headers, row));
    return { count: 1, created: true };
  }
  sheet.getRange(found, 1, 1, headers.length).setValues([rowToArray(headers, row)]);
  return { count: 1, created: false };
}

function opUpdate(sheet, headers, keyCol, row) {
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('colonne-clé absente: ' + keyCol);
  const keyVal = row[keyCol];
  const found = findRowByKey(sheet, keyIdx, keyVal);
  if (found === -1) throw new Error('ligne introuvable: ' + keyCol + '=' + keyVal);
  sheet.getRange(found, 1, 1, headers.length).setValues([rowToArray(headers, row)]);
  return { count: 1 };
}

function opDelete(sheet, headers, keyCol, keyVal) {
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('colonne-clé absente: ' + keyCol);
  const found = findRowByKey(sheet, keyIdx, keyVal);
  if (found === -1) return { count: 0 };
  sheet.deleteRow(found);
  return { count: 1 };
}

/** Supprime toutes les lignes dont la valeur de `keyCol` est dans le Set `values`. Un seul scan. */
function opDeleteMany(sheet, headers, keyCol, values) {
  const keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) throw new Error('colonne-clé absente: ' + keyCol);
  if (!values || !values.length) return { count: 0 };
  const toDelete = {};
  values.forEach(function(v) { toDelete[String(v)] = true; });

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { count: 0 };
  const col = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getValues();
  // Collecte les n° de ligne à supprimer, du bas vers le haut (suppression safe)
  const rowsToDelete = [];
  for (let i = col.length - 1; i >= 0; i--) {
    if (toDelete[String(col[i][0])]) rowsToDelete.push(i + 2);
  }
  rowsToDelete.forEach(function(r) { sheet.deleteRow(r); });
  return { count: rowsToDelete.length };
}

/** Supprime toutes les lignes dont la colonne `column` vaut `value`. Un seul scan. */
function opDeleteWhere(sheet, headers, column, value) {
  const colIdx = headers.indexOf(column);
  if (colIdx === -1) throw new Error('colonne absente: ' + column);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { count: 0 };
  const col = sheet.getRange(2, colIdx + 1, lastRow - 1, 1).getValues();
  const target = String(value);
  let count = 0;
  for (let i = col.length - 1; i >= 0; i--) {
    if (String(col[i][0]) === target) {
      sheet.deleteRow(i + 2);
      count++;
    }
  }
  return { count: count };
}

/** Récupère les en-têtes (ligne 1). */
function getHeaders(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) throw new Error('onglet vide: ' + sheet.getName());
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
}

/** Construit le tableau aligné sur les en-têtes. */
function rowToArray(headers, row) {
  return headers.map(function(h) {
    const v = row[h];
    return v === undefined || v === null ? '' : v;
  });
}

/** Trouve le n° de ligne (1-indexed) correspondant à une clé. -1 si absent. */
function findRowByKey(sheet, keyIdx, keyVal) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const col = sheet.getRange(2, keyIdx + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < col.length; i++) {
    if (String(col[i][0]) === String(keyVal)) return i + 2;
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Parseur CSV minimal (RFC 4180 léger, supporte guillemets et guillemets doublés). */

export function parseCSV(text) {
  const rows = [];
  let cur = [];
  let field = '';
  let inQuotes = false;
  const len = text.length;

  for (let i = 0; i < len; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cur.push(field); field = ''; }
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') { cur.push(field); rows.push(cur); cur = []; field = ''; }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

/** Tableau 2D → liste d'objets en utilisant la 1re ligne comme en-tête. */
export function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1)
    .filter(r => r.some(c => String(c).trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return obj;
    });
}

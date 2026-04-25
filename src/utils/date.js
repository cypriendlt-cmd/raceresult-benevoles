/**
 * Parsing de date en formats multiples vers ISO "YYYY-MM-DD".
 *
 * Reconnaît :
 *  - "2025-09-14" / "2025/09/14" → ISO direct
 *  - "14/09/2025" / "14-09-2025" (DD/MM/YYYY, français)
 *  - "14/9/2025" / "1/9/25" (jour/mois 1-2 chiffres, année 2 ou 4 chiffres)
 *  - "14 septembre 2025" / "14 sept. 2025" (mois français en toutes lettres)
 *
 * Retourne `null` si la date n'est pas parsable.
 */

const MOIS_FR = {
  janv: 1, janvier: 1, jan: 1,
  fevr: 2, fev: 2, fevrier: 2, feb: 2,
  mars: 3, mar: 3,
  avr: 4, avril: 4, apr: 4,
  mai: 5, may: 5,
  juin: 6, jun: 6,
  juil: 7, juillet: 7, jul: 7,
  aout: 8, aou: 8, aug: 8,
  sept: 9, septembre: 9, sep: 9,
  oct: 10, octobre: 10,
  nov: 11, novembre: 11,
  dec: 12, decembre: 12,
};

function normaliserMois(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\./g, '')
    .trim();
}

/** Parse une date multi-format → ISO "YYYY-MM-DD" ou null. */
export function parseDate(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // ISO direct
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return toISO(parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10));

  // DD/MM/YYYY ou DD-MM-YYYY
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (m) {
    let year = parseInt(m[3], 10);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    return toISO(year, parseInt(m[2], 10), parseInt(m[1], 10));
  }

  // "14 septembre 2025" / "14 sept. 2025"
  m = s.match(/^(\d{1,2})\s+([a-zA-ZÀ-ÿ.]+)\s+(\d{4})/);
  if (m) {
    const mois = MOIS_FR[normaliserMois(m[2])];
    if (mois) return toISO(parseInt(m[3], 10), mois, parseInt(m[1], 10));
  }

  return null;
}

/**
 * Formate une date ISO en français lisible.
 * - style 'long'     : "14 octobre 2025"      (défaut)
 * - style 'short'    : "14 oct. 2025"
 * - style 'datetime' : "14/10/2025 09:42"
 * Si la date est vide ou non parsable, retourne la valeur d'origine ou ''.
 */
export function formatDate(iso, style = 'long') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  if (style === 'datetime') {
    return d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
  return d.toLocaleDateString('fr-FR',
    style === 'short'
      ? { day: '2-digit', month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'long',  year: 'numeric' });
}

/** Vrai si la date ISO est strictement antérieure à maintenant (jour J inclus). */
export function isPast(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d)) return false;
  return d.setHours(23, 59, 59) < Date.now();
}

function toISO(y, mo, d) {
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return (
    String(y).padStart(4, '0') + '-' +
    String(mo).padStart(2, '0') + '-' +
    String(d).padStart(2, '0')
  );
}

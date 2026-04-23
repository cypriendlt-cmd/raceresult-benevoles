/**
 * Parsing et normalisation de temps multi-format vers "HH:MM:SS" + secondes totales.
 *
 * Entrées reconnues :
 *  - "1h10'18''" / "1h10'18" (Athle.fr / générique)
 *  - "00h31'53" / "01h19'30" (Nordsport)
 *  - "42'15''" / "42'15" (Athle.fr sans heure)
 *  - "HH:MM:SS" / "MM:SS" (RaceResult / ProLiveSport / PDF / CSV)
 *  - "1:07:40 18.8km/h" (ACN — on extrait le premier pattern temps)
 *  - "+0:12" (écart → rejeté : non renvoyé comme temps absolu)
 *
 * Sortie : { formatted: "HH:MM:SS" ou "MM:SS" quand pas d'heure, seconds: number|null }.
 * Si l'entrée est vide, invalide ou représente un écart, renvoie { formatted: null, seconds: null }.
 */

const RE_HMS = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Parse un temps textuel vers { formatted, seconds }.
 * formatted est toujours "HH:MM:SS" (zero-padded) quand on a une heure,
 * "MM:SS" quand on n'a qu'une heure à 0. `null` si pas de temps exploitable.
 */
// Caractères apostrophe et prime (ASCII + typographiques Unicode)
const APOS = "['’′ʹ´]";
const PRIME2 = "['\"’”″ʺ´]";

export function parseTemps(txt) {
  if (txt === null || txt === undefined) return { formatted: null, seconds: null };
  let s = String(txt).trim();
  if (!s) return { formatted: null, seconds: null };

  // Supprime les parenthèses de fin (pace type "52'28 (3:32/km)")
  s = s.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Écart signé (+0:12 / -0:05) : non exploitable comme temps absolu
  if (/^[+\-]/.test(s)) return { formatted: null, seconds: null };

  // Formats type "1h10'18''", "01h10'18", "1h10"
  let m = s.match(new RegExp('^(\\d{1,3})h(\\d{1,2})(?:[' + APOS.slice(1, -1) + ':](\\d{1,2}))?'));
  if (m) {
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = m[3] ? parseInt(m[3], 10) : 0;
    return fromHMS(h, mm, ss);
  }

  // Format "42'15''" ou "42'15" (sans heure) — tolère apostrophes typographiques
  m = s.match(new RegExp('^(\\d{1,3})' + APOS + '(\\d{1,2})' + PRIME2 + '{0,2}\\s*$'));
  if (m && !s.includes(':')) {
    const mm = parseInt(m[1], 10);
    const ss = parseInt(m[2], 10);
    return fromHMS(0, mm, ss);
  }

  // Format HH:MM:SS ou MM:SS (éventuellement suffixé)
  const hmsMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (hmsMatch) {
    const a = parseInt(hmsMatch[1], 10);
    const b = parseInt(hmsMatch[2], 10);
    const c = hmsMatch[3] !== undefined ? parseInt(hmsMatch[3], 10) : null;
    if (c !== null) {
      // a=h b=m c=s
      return fromHMS(a, b, c);
    }
    // MM:SS
    return fromHMS(0, a, b);
  }

  return { formatted: null, seconds: null };
}

function fromHMS(h, m, s) {
  if (!isFiniteNumber(h) || !isFiniteNumber(m) || !isFiniteNumber(s)) {
    return { formatted: null, seconds: null };
  }
  if (m >= 60 || s >= 60 || h < 0 || m < 0 || s < 0) {
    return { formatted: null, seconds: null };
  }
  const seconds = h * 3600 + m * 60 + s;
  const formatted =
    (h > 0 ? String(h).padStart(2, '0') + ':' : '00:') +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0');
  // Note : on renvoie toujours HH:MM:SS pour cohérence schema
  return { formatted, seconds };
}

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

/** Helper : renvoie directement "HH:MM:SS" ou null. */
export function formaterTemps(txt) {
  return parseTemps(txt).formatted;
}

/** Helper : renvoie directement les secondes ou null. */
export function tempsEnSecondes(txt) {
  return parseTemps(txt).seconds;
}

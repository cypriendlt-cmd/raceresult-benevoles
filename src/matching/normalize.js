/**
 * Normalisation noms / prénoms pour matching.
 *
 * Note : la fusion vers `utils/text.js` (J6 réduit) a été temporairement
 * annulée 2026-04-25 après régression du matching côté dashboard et fiche
 * adhérent. Les implémentations locales sont restaurées à l'identique
 * de la version qui a passé les 13 cas matching.html. Voir lesson J6.5.
 */

const PARTICULES = new Set([
  'de', 'du', 'des', 'le', 'la', "l'", 'van', 'von', 'der', 'den', 'da', 'do',
  'dos', 'di', 'al', 'el', 'ben', 'bin', 'ibn', 'mac', 'mc', "o'", 'st', 'st.'
]);

/**
 * Minuscule, sans accents, espaces normalisés.
 * Les caractères Unicode sont écrits en escape \uXXXX pour éviter qu'un éditeur
 * crée des plages involontaires entre eux (bug 2026-04-25 où une plage incluait
 * les lettres ASCII et cassait le matching).
 */
export function normaliser(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')                                  // diacritiques
    .replace(/[‐‑‒–—―−]/g, '-')    // tirets Unicode
    .replace(/[    ​ 　]/g, ' ')   // espaces Unicode
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Tokenise sur tout ce qui n'est pas une lettre (espaces, tirets, apostrophes,
 * points, etc.) pour être robuste aux variantes d'écriture.
 */
export function tokeniserNom(s) {
  return normaliser(s)
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/**
 * Deux prénoms/noms sont équivalents si :
 * - identiques après normalisation
 * - même set de tokens (Jean-Claude ≡ Jean Claude)
 * - le plus court est un singleton égal au 1er token du plus long
 *   (Jean ≡ Jean-Pierre mais Pierre ≢ Jean-Pierre)
 */
export function tokensEquivalents(a, b) {
  const ta = tokeniserNom(a);
  const tb = tokeniserNom(b);
  if (!ta.length || !tb.length) return false;
  if (ta.length === tb.length) {
    const sa = [...ta].sort().join('|');
    const sb = [...tb].sort().join('|');
    return sa === sb;
  }
  const [court, long] = ta.length < tb.length ? [ta, tb] : [tb, ta];
  if (court.length !== 1) return false;
  return court[0] === long[0];
}

/** Retire les particules du nom (pour comparaisons secondaires). */
export function sansParticules(s) {
  return tokeniserNom(s).filter(t => !PARTICULES.has(t)).join(' ');
}

/** Clé d'indexation rapide d'un adhérent : "normaliser(prenom)|normaliser(nom)". */
export function cleAdherent(adherent) {
  return normaliser(adherent.prenom) + '|' + normaliser(adherent.nom);
}

/**
 * Vrai si le prénom source est "trop court pour trancher un homonyme" :
 * une seule lettre, une initiale ("J."), ou un token de longueur ≤ 2.
 */
export function prenomTropCourt(prenom) {
  const t = tokeniserNom(prenom);
  if (t.length === 0) return true;
  return t.every(tok => tok.length <= 2 || /^[a-z]\.?$/.test(tok));
}

/**
 * Sexe compatible : vrai si les deux valeurs sont vides, ou si elles
 * pointent vers le même genre (tolère "M"/"H", "F"/"W", etc.).
 */
export function sexeCompatible(a, b) {
  const n = v => {
    const s = normaliser(v);
    if (!s) return '';
    if (['m', 'h', 'homme', 'male', 'masculin'].includes(s)) return 'm';
    if (['f', 'w', 'femme', 'female', 'feminin'].includes(s)) return 'f';
    return s[0];
  };
  const na = n(a), nb = n(b);
  if (!na || !nb) return true;  // on ne bloque pas si info manquante
  return na === nb;
}

/** Indexe les adhérents par nom normalisé. Utile pour détecter homonymes. */
export function indexAdherentsParNom(adherents) {
  const idx = new Map();
  for (const a of adherents) {
    const k = normaliser(a.nom);
    if (!k) continue;
    if (!idx.has(k)) idx.set(k, []);
    idx.get(k).push(a);
  }
  return idx;
}

/**
 * Utilitaires texte partagés (normalisation accents/casse, strip HTML, découpe nom/prénom).
 *
 * Extraits depuis index.html (L705, L786, L794, L1947) sans modification comportementale.
 * `splitNomPrenom` a un comportement subtil pour les particules nobiliaires — ne pas
 * simplifier sans couvrir les fixtures.
 */

/**
 * Normalise un texte pour comparaison (sans accents, minuscule, espaces et tirets
 * Unicode normalisés). Source unique utilisée par scraping, matching et UI.
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
 * Retire les balises HTML et décode les entités.
 * Côté navigateur : utilise un élément DOM temporaire.
 * Côté Node (tests) : fallback regex basique.
 */
export function stripHTML(s) {
  if (!s) return '';
  const str = String(s);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const tmp = document.createElement('div');
    tmp.innerHTML = str;
    return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  }
  // Fallback Node : décode quelques entités courantes
  return str
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenise un nom/prénom sur tout ce qui n'est pas une lettre (espaces, tirets,
 * apostrophes, points, etc.) après normalisation. Robuste aux variantes d'écriture.
 * Ex : "Jean-Marie O'Brien" → ["jean", "marie", "o", "brien"].
 */
export function tokeniserNom(s) {
  return normaliser(s).split(/[^a-z]+/).filter(Boolean);
}

/**
 * Sépare "NOM Prénom" / "Prénom NOM" / "NOM, Prénom" — les MAJUSCULES indiquent le
 * NOM, peu importe la position. Gère les particules nobiliaires (de, van, etc.).
 *
 * Comportement préservé à l'identique de index.html L794.
 */
export function splitNomPrenom(texte) {
  if (!texte) return { nom: '', prenom: '' };
  const t = String(texte).trim();

  // Format "NOM, Prénom" (RaceResult AfficherNom)
  if (t.includes(',')) {
    const parts = t.split(',').map((x) => x.trim());
    return { nom: parts[0] || '', prenom: parts[1] || '' };
  }

  const tokens = t.split(/\s+/);
  if (tokens.length === 1) return { nom: tokens[0], prenom: '' };

  const PARTICULES = /^(de|du|des|le|la|l'|van|von|der|den|da|do|dos|di|al|el|ben|bin|ibn|mac|mc|o'|st|st\.)$/i;

  function estCaps(tok) {
    return tok.length > 0 && tok === tok.toUpperCase() && /[A-ZÀ-ÝŒ]/.test(tok);
  }

  const caps = tokens.map(estCaps);

  // Attacher les particules aux caps adjacents (itérer jusqu'à stabilité)
  let change = true;
  while (change) {
    change = false;
    for (let i = 0; i < tokens.length; i++) {
      if (!caps[i] && PARTICULES.test(tokens[i])) {
        if ((i > 0 && caps[i - 1]) || (i + 1 < tokens.length && caps[i + 1])) {
          caps[i] = true;
          change = true;
        }
      }
    }
  }

  const nomParts = [];
  const prenomParts = [];
  tokens.forEach((tok, i) => {
    (caps[i] ? nomParts : prenomParts).push(tok);
  });

  if (nomParts.length > 0 && prenomParts.length > 0) {
    return { nom: nomParts.join(' '), prenom: prenomParts.join(' ') };
  }

  // Tous en MAJUSCULES : convention "NOM Prénom"
  if (nomParts.length === tokens.length) {
    return { nom: tokens[0], prenom: tokens.slice(1).join(' ') };
  }

  // Aucun en MAJUSCULES : convention "Prénom Nom", particule attachée au dernier
  let debutNom = tokens.length - 1;
  while (debutNom > 0 && PARTICULES.test(tokens[debutNom - 1])) debutNom--;
  return {
    nom: tokens.slice(debutNom).join(' '),
    prenom: tokens.slice(0, debutNom).join(' '),
  };
}

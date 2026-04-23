/**
 * Parseur HTML générique — fallback quand aucune source dédiée ne matche.
 *
 * Stratégie : récupère la page, parse via DOMParser, score chaque <table> du DOM
 * en comptant les lignes qui ressemblent à un classement (rang numérique + temps
 * reconnu + nom en MAJUSCULES). On retient la meilleure table.
 *
 * Fragile par construction — test canary sur fixture figée.
 */

import { fetchHTMLProxy } from '../../utils/proxy.js';
import { splitNomPrenom } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse } from '../normalize.js';

function getDOMParser() {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  throw new Error('DOMParser indisponible (environnement Node sans polyfill)');
}

export async function scrape({ url }) {
  if (!url) throw new Error('HTML générique : URL manquante');
  const html = await fetchHTMLProxy(url);
  return parseHTML(html, { url });
}

/** Exposé pour tests : parse un document HTML → { courses }. */
export function parseHTML(html, { url } = {}) {
  const Parser = getDOMParser();
  const doc = new Parser().parseFromString(html, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (tables.length === 0) throw new Error('HTML générique : aucune table trouvée');

  const regexTemps = /\d+h\d+|\d{1,2}:\d{2}(?::\d{2})?|\d+'\d+/;
  const regexNom = /[A-ZÀ-ÝŒ]{2,}/;

  function scorerLigne(tds) {
    if (tds.length < 3) return null;
    let idxRang = -1;
    let idxTemps = -1;
    let idxNom = -1;
    for (let i = 0; i < tds.length; i++) {
      const t = (tds[i].textContent || '').trim();
      if (idxRang === -1 && /^\d{1,4}$/.test(t)) idxRang = i;
      if (idxTemps === -1 && regexTemps.test(t)) idxTemps = i;
      if (idxNom === -1 && regexNom.test(t) && t.split(/\s+/).length >= 2) idxNom = i;
    }
    if (idxRang === -1 || idxTemps === -1 || idxNom === -1) return null;
    return { idxRang, idxTemps, idxNom };
  }

  let meilleure = null;
  let meilleurScore = 0;
  let meilleureCols = null;

  tables.forEach((tbl) => {
    const rows = tbl.querySelectorAll('tr');
    let score = 0;
    let cols = null;
    rows.forEach((tr) => {
      const tds = tr.querySelectorAll('td');
      const det = scorerLigne(tds);
      if (det) {
        score++;
        if (!cols) cols = det;
      }
    });
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleure = tbl;
      meilleureCols = cols;
    }
  });

  if (!meilleure || meilleurScore < 3) {
    throw new Error('HTML générique : aucune table de résultats reconnue (besoin de 3+ lignes rang/temps/nom)');
  }

  const lignes = [];
  meilleure.querySelectorAll('tr').forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length <= Math.max(meilleureCols.idxRang, meilleureCols.idxTemps, meilleureCols.idxNom)) return;
    const rangTxt = (tds[meilleureCols.idxRang].textContent || '').trim();
    if (!/^\d{1,4}$/.test(rangTxt)) return;
    const tempsTxt = (tds[meilleureCols.idxTemps].textContent || '').trim();
    const nomTxt = (tds[meilleureCols.idxNom].textContent || '').trim();
    if (!tempsTxt || !nomTxt) return;
    const np = splitNomPrenom(nomTxt.replace(/\s*\([A-Z]{2,3}\)\s*$/, ''));
    if (!np.nom && !np.prenom) return;
    const ligne = normalizeLigne({
      prenom: np.prenom,
      nom: np.nom,
      tempsOfficiel: tempsTxt,
      tempsNet: tempsTxt,
      rang: rangTxt,
    });
    if (ligne) lignes.push(ligne);
  });

  if (lignes.length === 0) {
    throw new Error('HTML générique : la table détectée n\'a produit aucune ligne exploitable');
  }

  // Meilleure tentative : tirer un titre depuis <title> ou <h1>
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const h1 = (doc.querySelector('h1')?.textContent || '').trim();
  const nom = h1 || title || 'Course (HTML générique)';

  return {
    courses: [
      {
        course: normalizeCourse({
          nom,
          source: 'generic',
          source_event_id: null,
          url: url || null,
        }),
        lignes,
      },
    ],
  };
}

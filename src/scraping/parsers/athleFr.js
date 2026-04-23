/**
 * Parseur Athle.fr (FFA) — HTML server-rendered avec pagination.
 *
 * Fragile : le markup Athle.fr est instable entre compétitions. Le test canary
 * vérifie la forme de sortie sur une fixture HTML figée — si Athle.fr change son
 * DOM, le test échoue et alerte. Voir lessons/2026-04-23-scraping-quirks.md.
 *
 * Le HTML n'est pas disponible en Node sans DOMParser : les tests utilisent une
 * version injectée via la variable globale `DOMParser` (polyfill ou skip).
 */

import { fetchHTMLProxy } from '../../utils/proxy.js';
import { splitNomPrenom } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse } from '../normalize.js';

function getDOMParser() {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  throw new Error('DOMParser indisponible (environnement Node sans polyfill)');
}

export async function scrape({ competitionId, url }) {
  if (!competitionId) throw new Error('Athle.fr : competitionId manquant');
  const base =
    'https://www.athle.fr/bases/liste.aspx?frmbase=resultats&frmmode=1&frmespace=0&frmcompetition=' +
    competitionId;

  const html0 = await fetchHTMLProxy(base + '&frmposition=0');
  const matchNbPages = html0.match(/Page[^0-9]*(\d+)\s*\/\s*(\d+)/);
  const nbPages = matchNbPages ? parseInt(matchNbPages[2], 10) : 1;

  let lignes = parsePage(html0);

  if (nbPages > 1) {
    const reqs = [];
    for (let p = 1; p < nbPages; p++) reqs.push(fetchHTMLProxy(base + '&frmposition=' + p));
    const htmls = await Promise.all(reqs);
    htmls.forEach((h) => {
      lignes = lignes.concat(parsePage(h));
    });
  }

  if (lignes.length === 0) {
    throw new Error('Athle.fr : aucune ligne extraite pour la compétition ' + competitionId);
  }

  return {
    courses: [
      {
        course: normalizeCourse({
          nom: 'Athle.fr compétition ' + competitionId,
          source: 'athlefr',
          source_event_id: String(competitionId),
          url,
        }),
        lignes,
      },
    ],
  };
}

/** Exposé pour tests canary : parse une page HTML Athle.fr → lignes normalisées. */
export function parsePage(html) {
  const Parser = getDOMParser();
  const doc = new Parser().parseFromString(html, 'text/html');
  const trs = doc.querySelectorAll('tr');
  const out = [];
  trs.forEach((tr) => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 3) return;
    const rangTxt = (tds[0].textContent || '').trim();
    if (!/^\d+$/.test(rangTxt)) return;
    const tempsTxt = (tds[1].textContent || '').trim();
    if (!tempsTxt) return;
    const lienNom = tds[2].querySelector('a');
    const nomComplet = (lienNom ? lienNom.textContent : tds[2].textContent || '').trim();
    if (!nomComplet) return;
    const nomNettoye = nomComplet.replace(/\s*\([A-Z]{2,3}\)\s*$/, '').trim();
    const np = splitNomPrenom(nomNettoye);
    if (!np.nom && !np.prenom) return;
    let categorie = '';
    if (tds.length > 6) categorie = (tds[6].textContent || '').trim();

    const ligne = normalizeLigne({
      prenom: np.prenom,
      nom: np.nom,
      tempsOfficiel: tempsTxt,
      tempsNet: tempsTxt,
      rang: rangTxt,
      categorie,
    });
    if (ligne) out.push(ligne);
  });
  return out;
}

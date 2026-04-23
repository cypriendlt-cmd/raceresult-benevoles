/**
 * Parseur Nordsport Chronométrage (format .clax XML).
 *
 * Flux : page live → iframe src → paramètre `f=/.../xxx.clax` → fetch du XML.
 * Le clax fournit `<Engages>` (dossard → nom/catégorie/parcours) et `<Resultats>`
 * (dossard → temps). On joint les deux, on filtre abandons/DSQ/anonymisés.
 *
 * Chaque parcours distinct dans `Engages` devient une course séparée.
 */

import { fetchHTMLProxy, proxiedUrl } from '../../utils/proxy.js';
import { splitNomPrenom } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse, parseDistanceKm, deduireType } from '../normalize.js';

function getDOMParser() {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  throw new Error('DOMParser indisponible (environnement Node sans polyfill)');
}

export async function scrape({ url }) {
  if (!url) throw new Error('Nordsport : URL manquante');
  const html = await fetchHTMLProxy(url);

  const iframeMatch = html.match(/<iframe[^>]+src="([^"]+)"/i);
  if (!iframeMatch) throw new Error('Nordsport : iframe live introuvable sur la page');
  const iframeSrc = iframeMatch[1];

  const fMatch = iframeSrc.match(/[?&]f=([^&]+)/);
  if (!fMatch) throw new Error('Nordsport : chemin .clax introuvable dans l\'iframe');
  const claxPath = decodeURIComponent(fMatch[1]);

  let claxUrl;
  try {
    claxUrl = new URL(claxPath, iframeSrc).href;
  } catch {
    const base = new URL(url);
    claxUrl = base.origin + claxPath;
  }

  const resp = await fetch(proxiedUrl(claxUrl));
  if (!resp.ok) throw new Error('Nordsport : Clax HTTP ' + resp.status);
  const xmlStr = await resp.text();

  return parseXML(xmlStr, { url });
}

/** Exposé pour tests : parse une chaîne XML .clax → { courses }. */
export function parseXML(xmlStr, { url } = {}) {
  const Parser = getDOMParser();
  const doc = new Parser().parseFromString(xmlStr, 'application/xml');
  const parseError = doc.querySelector('parsererror');
  if (parseError) throw new Error('Nordsport : XML .clax invalide');

  const engages = {};
  doc.querySelectorAll('Engages > E, Engages E').forEach((e) => {
    const d = e.getAttribute('d');
    if (!d) return;
    engages[d] = {
      nom: (e.getAttribute('n') || '').replace(/ /g, ' ').trim(),
      categorie: e.getAttribute('ca') || '',
      parcours: e.getAttribute('p') || '',
      sexe: e.getAttribute('x') || '',
    };
  });

  // Regroupement par parcours
  const parCours = new Map();
  const rangsParParcours = new Map();

  doc.querySelectorAll('Resultats > R, Resultats R').forEach((r) => {
    const d = r.getAttribute('d');
    const t = r.getAttribute('t') || '';
    if (!d) return;
    if (/abandon|dsq|dnf/i.test(t)) return;
    const eng = engages[d];
    if (!eng || !eng.nom) return;
    if (/^[A-Z]\.\s*[A-Z]\.?$/.test(eng.nom)) return;
    if (!eng.parcours) return;
    if (/dossard\s*inconnu/i.test(eng.nom)) return;

    const np = splitNomPrenom(eng.nom);
    if (!np.nom && !np.prenom) return;

    const bag = parCours.get(eng.parcours) || [];
    const rangCourant = (rangsParParcours.get(eng.parcours) || 0) + 1;
    rangsParParcours.set(eng.parcours, rangCourant);

    const ligne = normalizeLigne({
      prenom: np.prenom,
      nom: np.nom,
      tempsOfficiel: t,
      tempsNet: t,
      rang: rangCourant,
      categorie: eng.categorie,
      dossard: d,
      sexe: eng.sexe,
    });
    if (ligne) {
      bag.push(ligne);
      parCours.set(eng.parcours, bag);
    }
  });

  if (parCours.size === 0) {
    throw new Error('Nordsport : aucun résultat exploité');
  }

  const courses = [];
  for (const [parcours, lignes] of parCours) {
    const distance_km = parseDistanceKm(parcours);
    courses.push({
      course: normalizeCourse({
        nom: parcours,
        source: 'nordsport',
        source_event_id: parcours,
        url: url || null,
        distance_km,
        type: deduireType({ nom: parcours, distance_km }),
      }),
      lignes,
    });
  }
  return { courses };
}

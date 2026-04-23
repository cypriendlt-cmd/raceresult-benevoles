/**
 * Parseur RaceResult (RRPublish).
 *
 * Flux : GET /{eventId}/RRPublish/data/config → key + liste des "lists" publiées,
 * puis GET /data/list?listname=... pour récupérer les rangs. On préfère "Final"
 * si disponible. La réponse peut contenir plusieurs contests (parcours) ; chacun
 * devient une course distincte.
 *
 * Sortie : { courses: [{ course, lignes }, ...] }.
 */

import { stripHTML, splitNomPrenom } from '../../utils/text.js';
import { fetchJSONProxy, fetchHTMLProxy } from '../../utils/proxy.js';
import { normalizeLigne, normalizeCourse, parseDistanceKm, deduireType } from '../normalize.js';

export async function scrape({ eventId, url }) {
  if (!eventId) throw new Error('RaceResult : eventId manquant');

  const configUrl = 'https://my.raceresult.com/' + eventId + '/RRPublish/data/config';
  let config;
  try {
    config = await fetchJSONProxy(configUrl);
  } catch (e) {
    throw new Error('RaceResult : config introuvable pour l\'événement ' + eventId + ' (' + e.message + ')');
  }

  if (!config.key) {
    throw new Error('RaceResult : clé d\'accès absente — Simple API non activée pour ' + eventId);
  }

  const lists = Array.isArray(config.lists) ? config.lists : [];
  if (lists.length === 0) {
    throw new Error('RaceResult : aucune liste publiée pour l\'événement ' + eventId);
  }

  const liste = lists.find((l) => /final/i.test(l.Name || '')) || lists[0];
  const server = config.server || 'my.raceresult.com';

  const listUrl =
    'https://' + server + '/' + eventId + '/RRPublish/data/list' +
    '?key=' + encodeURIComponent(config.key) +
    '&listname=' + encodeURIComponent(liste.Name) +
    '&page=results&contest=0&r=all&l=' + encodeURIComponent(liste.Name);

  // Récupération parallèle de la liste des résultats + de la page HTML
  // publique (pour extraire date + nom propre depuis le <title>).
  const [listData, meta] = await Promise.all([
    fetchJSONProxy(listUrl),
    extraireMetaHTML(eventId).catch(() => ({ date: null, nom: null })),
  ]);

  return parseListData(listData, {
    eventId,
    url,
    nomEvenement: meta.nom || config.eventname || config.EventName || config.Name || ('RaceResult ' + eventId),
    date: meta.date,
    lieu: null,
  });
}

/**
 * Fetch la page HTML publique https://my.raceresult.com/{eventId}/ et extrait
 * le nom + la date depuis le <title>. Format typique :
 *   "<nomEvenement>, YYYY-MM-DD : : my.race|result"
 */
async function extraireMetaHTML(eventId) {
  const html = await fetchHTMLProxy('https://my.raceresult.com/' + eventId + '/');
  const m = html.match(/<title>([^<]+)<\/title>/i);
  if (!m) return { date: null, nom: null };
  const title = m[1];
  // Date ISO en 1er
  const iso = title.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const nom = title.slice(0, iso.index).replace(/,\s*$/, '').trim();
    return { date: iso[1], nom: nom || null };
  }
  // Fallback DD.MM.YYYY ou DD/MM/YYYY
  const fr = title.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  if (fr) {
    const nom = title.slice(0, fr.index).replace(/,\s*$/, '').trim();
    return { date: fr[1], nom: nom || null };
  }
  return { date: null, nom: null };
}

/** Exposé pour les tests : parse une réponse RRPublish /data/list. */
export function parseListData(data, meta = {}) {
  const dataFields = Array.isArray(data.DataFields) ? data.DataFields : [];

  function trouverIdx(patterns) {
    for (const p of patterns) {
      for (let i = 0; i < dataFields.length; i++) {
        if (String(dataFields[i]).toLowerCase().includes(p)) return i;
      }
    }
    return -1;
  }

  const iNom = trouverIdx(['affichernom', 'nom_prenom', 'firstname', 'lastname', 'name']);
  const iBib = trouverIdx(['bib', 'dossard', 'startnr']);
  const iPos = trouverIdx(['classementofficiel', 'rank', 'rang', 'pos']);
  const iGun = trouverIdx(['.gun', 'guntime', 'officialtime']);
  const iChip = trouverIdx(['.chip', 'chiptime', 'nettime']);
  const iCat = trouverIdx(['category', 'categorie', 'agegroup']);
  const iClub = trouverIdx(['club', 'team']);

  const groupes = data.data || {};
  // Regroupement par contest (= parcours) : 1 contest → 1 course
  const parCours = new Map();

  Object.keys(groupes).forEach((cKey) => {
    const groupe = groupes[cKey];
    const contestLabel = cKey.replace(/^#\d+_/, '');

    const pousseLigne = (row, catGroupe) => {
      if (!Array.isArray(row)) return;
      const nomBrut = iNom !== -1 ? String(row[iNom] || '') : '';
      const np = splitNomPrenom(stripHTML(nomBrut));
      if (!np.nom && !np.prenom) return;

      const bag = parCours.get(contestLabel) || [];
      bag.push({
        prenom: np.prenom,
        nom: np.nom,
        tempsOfficiel: iGun !== -1 ? stripHTML(row[iGun] || '') : '',
        tempsNet: iChip !== -1 ? stripHTML(row[iChip] || '') : '',
        rang: iPos !== -1 ? stripHTML(row[iPos] || '').replace(/\.$/, '') : '',
        dossard: iBib !== -1 ? stripHTML(row[iBib] || '') : '',
        categorie: catGroupe || (iCat !== -1 ? stripHTML(row[iCat] || '') : contestLabel),
        club: iClub !== -1 ? stripHTML(row[iClub] || '') : '',
      });
      parCours.set(contestLabel, bag);
    };

    if (Array.isArray(groupe)) {
      groupe.forEach((r) => pousseLigne(r, contestLabel));
    } else if (groupe && typeof groupe === 'object') {
      Object.keys(groupe).forEach((subKey) => {
        const subLignes = groupe[subKey];
        const catLabel = subKey.replace(/^#[^_]*_/, '') || contestLabel;
        if (Array.isArray(subLignes)) subLignes.forEach((r) => pousseLigne(r, catLabel));
      });
    }
  });

  if (parCours.size === 0) {
    throw new Error('RaceResult : aucune ligne exploitée (structure inattendue)');
  }

  const courses = [];
  for (const [parcours, lignesBrutes] of parCours) {
    const lignes = lignesBrutes.map(normalizeLigne).filter(Boolean);
    const nom = meta.nomEvenement ? meta.nomEvenement + ' — ' + parcours : parcours;
    // Distance : d'abord depuis le libellé du parcours (ex. "10km - Label F.F.A Or"),
    // fallback sur le nom complet.
    const distance_km = parseDistanceKm(parcours) ?? parseDistanceKm(nom);
    courses.push({
      course: normalizeCourse({
        nom,
        date: meta.date || null,
        lieu: meta.lieu || null,
        distance_km,
        type: deduireType({ nom, distance_km }),
        source: 'raceresult',
        source_event_id: meta.eventId ? String(meta.eventId) + ':' + parcours : null,
        url: meta.url || null,
      }),
      lignes,
    });
  }
  return { courses };
}

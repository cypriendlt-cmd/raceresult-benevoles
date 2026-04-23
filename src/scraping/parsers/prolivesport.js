/**
 * Parseur ProLiveSport.
 *
 * Deux étapes :
 *  1. /raceList/{eventId}/ pour la liste des courses (on filtre distance==="999" qui
 *     est un pseudo-parcours cumulé, pas un vrai chrono).
 *  2. /indiv/{eventId}/{raceId}/ pour chaque course en parallèle.
 *
 * Le token `access-token` est passé via la query `x-token` : le worker Cloudflare le
 * retranscrit en header vers l'API cible (contournement CORS standard).
 *
 * Chaque course distance devient une course distincte dans la sortie.
 */

import { fetchJSONProxy } from '../../utils/proxy.js';
import { proxiedUrl } from '../../utils/proxy.js';
import { normalizeLigne, normalizeCourse, parseDistanceKm, deduireType } from '../normalize.js';

const BASE = 'https://api.prolivesport.fr/apiws/result';

function plsUrl(path) {
  return proxiedUrl(BASE + path) + '&x-token=AUTH_PLSWS_V2';
}

async function fetchPLS(path) {
  const resp = await fetch(plsUrl(path));
  if (!resp.ok) throw new Error('ProLiveSport HTTP ' + resp.status + ' sur ' + path);
  return await resp.json();
}

export async function scrape({ eventId, url }) {
  if (!eventId) throw new Error('ProLiveSport : eventId manquant');

  const list = await fetchPLS('/raceList/' + eventId + '/');
  if (list && list.success === false) {
    throw new Error('ProLiveSport : ' + (list.message || 'échec') + ' (le proxy doit forwarder x-token → access-token)');
  }
  const coursesApi = (list.result || []).filter((c) => c.race && c.distance !== '999');
  if (coursesApi.length === 0) throw new Error('ProLiveSport : aucune course dans raceList pour ' + eventId);

  const blocs = await Promise.all(
    coursesApi.map((c) =>
      fetchPLS('/indiv/' + eventId + '/' + c.race + '/')
        .then((j) => ({ course: c, rows: j.result || [] }))
        .catch(() => ({ course: c, rows: [] }))
    )
  );

  return { courses: blocs.map((b) => buildCourse(b, { eventId, url })) };
}

/** Exposé pour tests : construit une course à partir d'une course API + rows. */
export function buildCourse({ course, rows }, { eventId, url } = {}) {
  const dist = parseFloat(course.distance);
  const distanceKm = Number.isFinite(dist) ? dist : null;
  const nomCourse = course.name || course.title || ('Course ' + course.race);

  const lignes = rows
    .filter((x) => {
      const rang = parseInt(x.rank, 10);
      if (!rang || rang >= 99000) return false;
      if (!x.time || x.time === '00:00:00') return false;
      return true;
    })
    .map((x) =>
      normalizeLigne({
        prenom: (x.firstname || '').trim(),
        nom: (x.lastname || '').trim(),
        tempsOfficiel: x.time,
        tempsNet: x.time,
        rang: x.rank,
        categorie: (x.category || '').trim(),
        dossard: (x.number || '').trim(),
        club: (x.team || x.club || '').trim(),
        sexe: x.sex || x.gender || '',
      })
    )
    .filter(Boolean);

  return {
    course: normalizeCourse({
      nom: nomCourse,
      source: 'prolivesport',
      source_event_id: eventId + ':' + course.race,
      url,
      distance_km: distanceKm,
      type: deduireType({ nom: nomCourse, distance_km: distanceKm }),
    }),
    lignes,
  };
}

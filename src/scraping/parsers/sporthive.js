/**
 * Parseur Sporthive / Speedhive.
 *
 * URL publique : https://sporthive.com/events/s/{eventId}/race/{raceId}
 * API backend  : https://eventresults-api.speedhive.com/sporthive
 *   - /events/{eventId}         → métadonnées événement (nom, date, lieu)
 *   - /races/{raceId}           → métadonnées course (nom, date, distance)
 *   - /races/{raceId}/participants?size=N&page=P&category=ALL_RESULTS → paginé
 *
 * Récupère tous les participants via pagination (size=500, jusqu'à totalPages).
 */

import { fetchJSONProxy } from '../../utils/proxy.js';
import { splitNomPrenom } from '../../utils/text.js';
import { normalizeLigne, normalizeCourse, deduireType } from '../normalize.js';

const BASE = 'https://eventresults-api.speedhive.com/sporthive';
const PAGE_SIZE = 100;
const MAX_PAGES = 200;  // garde-fou (20 000 coureurs max)

export async function scrape({ eventId, raceId, url }) {
  if (!eventId || !raceId) throw new Error('Sporthive : eventId ou raceId manquant');

  // Fetch event + race en parallèle
  const [eventData, raceData] = await Promise.all([
    fetchJSONProxy(`${BASE}/events/${eventId}`).catch(() => null),
    fetchJSONProxy(`${BASE}/races/${raceId}`),
  ]);

  if (!raceData || !raceData.raceName) {
    throw new Error('Sporthive : course introuvable pour raceId ' + raceId);
  }

  // 1re page : récupère aussi totalPages pour paralléliser les suivantes
  const first = await fetchJSONProxy(
    `${BASE}/races/${raceId}/participants?size=${PAGE_SIZE}&page=0&category=ALL_RESULTS`
  );
  const totalPages = Math.min(first.totalPages || 1, MAX_PAGES);
  const lignesBrutes = [...(first.content || [])];

  if (totalPages > 1) {
    // Parallélise par lots de 6 pour ne pas saturer le proxy
    const BATCH = 6;
    for (let start = 1; start < totalPages; start += BATCH) {
      const reqs = [];
      for (let p = start; p < Math.min(start + BATCH, totalPages); p++) {
        reqs.push(fetchJSONProxy(`${BASE}/races/${raceId}/participants?size=${PAGE_SIZE}&page=${p}&category=ALL_RESULTS`));
      }
      const batch = await Promise.all(reqs);
      batch.forEach(r => (r.content || []).forEach(p => lignesBrutes.push(p)));
    }
  }

  if (lignesBrutes.length === 0) {
    throw new Error('Sporthive : aucun participant pour la course ' + raceId);
  }

  const lignes = lignesBrutes
    .filter(p => !p.dns)  // non-partants ignorés
    .map(participantEnLigne)
    .filter(Boolean);

  // Nom combiné : Event — Race (ex. "ASML Marathon Eindhoven 2024 — ASML Marathon")
  const nomEvent = eventData?.eventName?.trim();
  const nomRace  = raceData.raceName?.trim();
  const nom = nomEvent && nomRace && !nomRace.includes(nomEvent)
    ? `${nomEvent} — ${nomRace}`
    : (nomRace || nomEvent || 'Sporthive ' + raceId);

  const distance_km = raceData.distanceInMeter ? +(raceData.distanceInMeter / 1000).toFixed(3) : null;
  const date = (raceData.date || eventData?.date || '').slice(0, 10) || null;
  const lieu = eventData?.location || eventData?.activeLocation?.name || null;

  return {
    courses: [{
      course: normalizeCourse({
        nom,
        date,
        lieu,
        distance_km,
        type: deduireType({ nom, distance_km }),
        source: 'sporthive',
        source_event_id: `${eventId}:${raceId}`,
        url,
      }),
      lignes,
    }],
  };
}

/** Transforme un participant Sporthive en ligne canonique. */
function participantEnLigne(p) {
  const np = splitNomPrenom(p.name || '');
  if (!np.nom && !np.prenom) return null;

  return normalizeLigne({
    prenom: np.prenom,
    nom: np.nom,
    tempsOfficiel: p.gunTimeOfParticipant || p.chipTimeOfParticipant || '',
    tempsNet: p.chipTimeOfParticipant || p.gunTimeOfParticipant || '',
    rang: p.overallPosition || '',
    categorie: p.raceCategory || '',
    dossard: p.bib || '',
    sexe: p.gender || '',
    club: p.country || '',  // Sporthive n'expose pas de champ club — on met le pays en fallback
  });
}

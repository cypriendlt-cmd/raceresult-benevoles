/**
 * Parseur UltraTiming (ultratiming.live).
 *
 * URL publique :
 *   https://www.ultratiming.live/evenement/<eventSlug>/epreuve/<trialSlug>/resultats
 *
 * Site Next.js. Les données sont embarquées en SSR dans
 * `<script id="__NEXT_DATA__" type="application/json">{...}</script>`.
 * On lit `props.pageProps.resultsResult` (collection Hydra / API Platform)
 * et on mappe `hydra:member[]` vers le contrat canonique.
 *
 * Fallback : si `resultsResult` est absent du HTML, on extrait `buildId`
 * et on appelle `_next/data/<buildId>/.../resultats.json` qui est l'endpoint
 * que le client appelle sinon. Cette URL JSON contient le hash de build qui
 * change à chaque déploiement d'ultratiming.live — ce n'est pas un problème
 * en pratique parce qu'on importe une course une seule fois.
 *
 * Format de temps : `finalTime` est un entier en SECONDES (ex. 4073 = 1h07'53).
 */

import { fetchHTMLProxy, fetchJSONProxy } from '../../utils/proxy.js';
import { normalizeLigne, normalizeCourse, deduireType, parseDistanceKm } from '../normalize.js';

const MAX_PAGES = 100;  // garde-fou : 100 pages × ~50 = 5000 coureurs max

export async function scrape({ eventSlug, trialSlug, url }) {
  if (!eventSlug || !trialSlug) throw new Error('UltraTiming : eventSlug ou trialSlug manquant');

  // On force la page 1 dans l'URL — l'utilisateur peut avoir collé une URL avec ?page=N,
  // on veut toujours partir du début et paginer nous-mêmes.
  const urlPage1 = stripPageParam(url);
  const html = await fetchHTMLProxy(urlPage1);
  const nextData = extraireNextData(html);

  const buildId = nextData?.buildId;
  const locale = nextData?.locale || 'fr';

  const page1 = nextData?.props?.pageProps?.resultsResult || null;
  let membres = Array.isArray(page1?.['hydra:member']) ? [...page1['hydra:member']] : [];

  // Si la page 1 du HTML est vide, fallback : on tape directement le JSON.
  if (membres.length === 0) {
    if (!buildId) throw new Error('UltraTiming : __NEXT_DATA__.buildId introuvable, impossible de paginer');
    const data = await fetchJSONProxy(jsonPageUrl(buildId, locale, eventSlug, trialSlug, 1));
    const fallback = data?.pageProps?.resultsResult?.['hydra:member'] || [];
    membres = [...fallback];
  }

  // Pagination : pages 2..N via JSON (séquentiel, stop sur première page vide).
  if (buildId) {
    for (let page = 2; page <= MAX_PAGES; page++) {
      let data;
      try {
        data = await fetchJSONProxy(jsonPageUrl(buildId, locale, eventSlug, trialSlug, page));
      } catch (e) {
        // 404 ou autre = fin de pagination
        break;
      }
      const more = data?.pageProps?.resultsResult?.['hydra:member'] || [];
      if (more.length === 0) break;
      membres.push(...more);
    }
  }

  if (membres.length === 0) {
    throw new Error('UltraTiming : aucun résultat pour ' + eventSlug + ' / ' + trialSlug);
  }

  const lignes = membres.map(participationEnLigne).filter(Boolean);

  // Métadonnées course : on cherche dans pageProps les objets event/trial éventuels,
  // sinon on retombe sur les slugs (toujours présents).
  const pp = nextData?.props?.pageProps || {};
  const ev = pp.event || pp.eventResult || pp.evenement || null;
  const tr = pp.trial || pp.trialResult || pp.epreuve || null;

  const nomEvent = trimOrNull(ev?.name) || slugToLabel(eventSlug);
  const nomTrial = trimOrNull(tr?.name) || trialSlug.toUpperCase();
  const nom = nomTrial && !nomEvent.toLowerCase().includes(nomTrial.toLowerCase())
    ? `${nomEvent} — ${nomTrial}`
    : nomEvent;

  const distance_km = parseDistanceKm(tr?.distance || tr?.distanceLabel || trialSlug);
  const date = (ev?.startDate || ev?.date || tr?.startDate || '').toString().slice(0, 10) || null;
  const lieu = trimOrNull(ev?.location?.name || ev?.location || ev?.city || ev?.lieu);

  return {
    courses: [{
      course: normalizeCourse({
        nom,
        date,
        lieu,
        distance_km,
        type: deduireType({ nom, distance_km }),
        organisateur: trimOrNull(ev?.organizer?.name || ev?.organizer),
        source: 'ultratiming',
        source_event_id: `${eventSlug}:${trialSlug}`,
        url,
      }),
      lignes,
    }],
  };
}

/** Construit l'URL JSON Next.js pour une page donnée. */
function jsonPageUrl(buildId, locale, eventSlug, trialSlug, page) {
  const base = `https://www.ultratiming.live/_next/data/${buildId}/${locale}/evenement/${eventSlug}/epreuve/${trialSlug}/resultats.json`;
  const qs = `eventSlug=${encodeURIComponent(eventSlug)}&trialSlug=${encodeURIComponent(trialSlug)}` + (page > 1 ? `&page=${page}` : '');
  return `${base}?${qs}`;
}

/** Retire `?page=N` (et ses voisins) de l'URL pour toujours fetch la page 1. */
function stripPageParam(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('page');
    return u.toString();
  } catch {
    return url.replace(/([?&])page=\d+&?/g, '$1').replace(/[?&]$/, '');
  }
}

/** Extrait et parse le bloc __NEXT_DATA__ du HTML SSR Next.js. */
function extraireNextData(html) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('UltraTiming : balise <script id="__NEXT_DATA__"> introuvable');
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    throw new Error('UltraTiming : __NEXT_DATA__ JSON invalide (' + e.message + ')');
  }
}

/** Transforme une Participation Hydra en ligne canonique. */
function participationEnLigne(p) {
  const u = p?.user || {};
  const prenom = trimOrNull(u.firstName);
  const nom = trimOrNull(u.lastName);
  if (!prenom && !nom) return null;

  // finalTime en secondes → format hh:mm:ss pour parseTemps()
  const sec = Number.isFinite(p?.finalTime) ? p.finalTime : null;
  const tempsStr = sec !== null ? secondsToHMS(sec) : '';

  return normalizeLigne({
    prenom,
    nom,
    tempsOfficiel: tempsStr,
    tempsNet: tempsStr,        // UltraTiming n'expose pas gun vs net distinct
    rang: p?.rank,
    rang_categorie: p?.categoryRank,
    categorie: p?.category,
    sexe: p?.gender || u.gender,
    club: p?.club,
    dossard: p?.raceNumber,
  });
}

function secondsToHMS(s) {
  const sec = Math.max(0, Math.round(s));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = n => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(ss)}`;
}

function trimOrNull(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function slugToLabel(slug) {
  return String(slug)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

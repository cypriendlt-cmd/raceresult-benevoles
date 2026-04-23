/**
 * Détection du parseur à utiliser depuis une URL.
 *
 * Retourne un discriminant `{ source, ...params }` ou `{ source: 'generic', url }`
 * en fallback. Ne fait aucune requête réseau.
 */

const RE_RACERESULT = /(^|\.)raceresult\.com\//i;
const RE_PLS = /prolivesport\.fr\//i;
const RE_ACN = /acn-timing\.com\//i;
const RE_ATHLEFR = /athle\.fr\//i;
const RE_NORDSPORT = /nordsport|glive|g-live/i;
const RE_SPORTHIVE = /sporthive\.com|speedhive\.com/i;

export function detectSource(urlStr) {
  if (!urlStr) throw new Error('URL vide');
  const url = String(urlStr).trim();

  if (RE_RACERESULT.test(url)) {
    const m = url.match(/raceresult\.com\/(\d+)/i);
    if (!m) throw new Error('RaceResult : ID d\'événement introuvable dans l\'URL');
    return { source: 'raceresult', url, eventId: m[1] };
  }

  if (RE_PLS.test(url)) {
    const m = url.match(/prolivesport\.fr\/(?:V2\/)?result\/(\d+)/i);
    if (!m) throw new Error('ProLiveSport : ID d\'événement introuvable dans l\'URL');
    return { source: 'prolivesport', url, eventId: m[1] };
  }

  if (RE_ACN.test(url)) {
    const m = url.match(/ctx\/([^/]+)\/.*home\/([^/?]+)/);
    if (!m) throw new Error('ACN-Timing : paramètres ctx/home introuvables dans l\'URL');
    return { source: 'acn', url, context: m[1], section: m[2] };
  }

  if (RE_ATHLEFR.test(url)) {
    const m = url.match(/frmcompetition=(\d+)/i);
    if (!m) throw new Error('Athle.fr : frmcompetition introuvable dans l\'URL');
    return { source: 'athlefr', url, competitionId: m[1] };
  }

  if (RE_NORDSPORT.test(url)) {
    return { source: 'nordsport', url };
  }

  if (RE_SPORTHIVE.test(url)) {
    // https://sporthive.com/events/s/{eventId}/race/{raceId}
    const m = url.match(/events\/s\/(\d+)\/race\/(\d+)/);
    if (!m) throw new Error("Sporthive : IDs d'événement et de course introuvables dans l'URL");
    return { source: 'sporthive', url, eventId: m[1], raceId: m[2] };
  }

  return { source: 'generic', url };
}

/**
 * Point d'entrée du module scraping — dispatch vers le bon parseur selon la source.
 *
 * API publique :
 *   - scrapeFromUrl(url) → Promise<{ courses: [{ course, lignes }] }>
 *   - parseFile(file)    → Promise<{ courses: [{ course, lignes }] }>  (PDF | CSV)
 *
 * Contrat de sortie détaillé : voir CLAUDE.md §3bis.
 * Chaque parseur lève une exception explicite en français avec contexte
 * (source + identifiant) en cas d'échec. L'appelant (UI preview) gère.
 */

import { detectSource } from './detect.js';
import * as raceresult from './parsers/raceresult.js';
import * as prolivesport from './parsers/prolivesport.js';
import * as acn from './parsers/acnTiming.js';
import * as athlefr from './parsers/athleFr.js';
import * as nordsport from './parsers/nordsport.js';
import * as sporthive from './parsers/sporthive.js';
import * as generic from './parsers/genericHtml.js';
import * as pdfParser from './parsers/pdf.js';
import * as csvParser from './parsers/csv.js';

/** Scraping depuis une URL publique. */
export async function scrapeFromUrl(url) {
  const detected = detectSource(url);
  switch (detected.source) {
    case 'raceresult':   return await raceresult.scrape(detected);
    case 'prolivesport': return await prolivesport.scrape(detected);
    case 'acn':          return await acn.scrape(detected);
    case 'athlefr':      return await athlefr.scrape(detected);
    case 'nordsport':    return await nordsport.scrape(detected);
    case 'sporthive':    return await sporthive.scrape(detected);
    case 'generic':      return await generic.scrape(detected);
    default:
      throw new Error('Source inconnue : ' + detected.source);
  }
}

/** Import depuis un fichier local (PDF ou CSV). */
export async function parseFile(file) {
  if (!file) throw new Error('parseFile : fichier manquant');
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf')) return await pdfParser.parseFile(file);
  if (name.endsWith('.csv')) return await csvParser.parseFile(file);
  throw new Error('Format non supporté : ' + (file.name || 'fichier sans extension') + ' (.pdf ou .csv attendus)');
}

// Ré-export des parseurs individuels pour tests unitaires
export { raceresult, prolivesport, acn, athlefr, nordsport, sporthive, generic, pdfParser, csvParser };

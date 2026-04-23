/**
 * Scoring de matching ligne scrappée ↔ adhérents.
 *
 * Règle utilisateur (2026-04-23) :
 *   - `certain` : prénom + nom exacts après normalisation (casse, accents,
 *                 tokens composés Jean-Pierre ≡ Jean Pierre, inversion
 *                 nom/prénom si le scraper a mal parsé).
 *   - `ambigu`  : plusieurs adhérents partagent le même nom ET le prénom
 *                 source est trop court/initiale pour trancher (`J.`, `L`).
 *   - `absent`  : aucun des cas ci-dessus.
 *   - `manuel`  : décidé par un override force_match (score 100).
 *
 * Pas de `probable` / `douteux` : soit on est sûr, soit on demande.
 */

import { normaliser, tokensEquivalents, prenomTropCourt, indexAdherentsParNom } from './normalize.js';
import { indexOverrides, appliquerOverride, estRefuse } from './overrides.js';

/**
 * 100 si l'adhérent correspond exactement (au sens large : normalisation +
 * tokens composés + inversion éventuelle). 0 sinon. Pas de scores intermédiaires.
 */
export function scoreAdherent(ligne, adherent) {
  const pSrc = normaliser(ligne.prenom_source);
  const nSrc = normaliser(ligne.nom_source);
  const pAdh = normaliser(adherent.prenom);
  const nAdh = normaliser(adherent.nom);
  if (!pSrc || !nSrc) return 0;

  // Identité exacte après normalisation
  if (pSrc === pAdh && nSrc === nAdh) return 100;
  // Inversion exacte (scraper ayant mal séparé)
  if (pSrc === nAdh && nSrc === pAdh) return 100;
  // Tokens équivalents (Jean-Claude ≡ Jean Claude, Van De Berg ≡ van de berg)
  if (tokensEquivalents(pSrc, pAdh) && tokensEquivalents(nSrc, nAdh)) return 100;
  if (tokensEquivalents(pSrc, nAdh) && tokensEquivalents(nSrc, pAdh)) return 100;
  return 0;
}

/**
 * Classe une ligne contre la liste des adhérents, en appliquant les overrides.
 *
 * @returns {{
 *   match_status: 'certain' | 'ambigu' | 'absent' | 'manuel',
 *   match_score: number,
 *   adherent_id: string|null,
 *   candidates: Array<{adherent_id:string, score:number, raison?:string}>
 * }}
 */
export function matcher(ligne, adherents, overridesIndex, courseId, indexNom) {
  // 1. Override prioritaire
  const forced = appliquerOverride(overridesIndex, ligne, courseId);
  if (forced) {
    return {
      match_status: forced.reason === 'alias' ? 'certain' : 'manuel',
      match_score: 100,
      adherent_id: forced.adherent_id,
      candidates: [{ adherent_id: forced.adherent_id, score: 100 }]
    };
  }

  // 2. Matches exacts (score 100)
  const exacts = [];
  for (const adh of adherents) {
    if (!adh.id) continue;
    if (estRefuse(overridesIndex, ligne, adh.id)) continue;
    if (scoreAdherent(ligne, adh) === 100) exacts.push(adh);
  }

  if (exacts.length === 1) {
    return {
      match_status: 'certain',
      match_score: 100,
      adherent_id: exacts[0].id,
      candidates: [{ adherent_id: exacts[0].id, score: 100 }]
    };
  }
  if (exacts.length >= 2) {
    return {
      match_status: 'ambigu',
      match_score: 100,
      adherent_id: null,
      candidates: exacts.slice(0, 5).map(a => ({ adherent_id: a.id, score: 100, raison: 'doublon_identite' }))
    };
  }

  // 3. Pas de match exact : homonymie nom + prénom source trop court ?
  const nomKey = normaliser(ligne.nom_source);
  const homonymes = (indexNom && indexNom.get(nomKey)) || [];
  if (homonymes.length >= 2 && prenomTropCourt(ligne.prenom_source)) {
    return {
      match_status: 'ambigu',
      match_score: 0,
      adherent_id: null,
      candidates: homonymes
        .filter(h => h.id && !estRefuse(overridesIndex, ligne, h.id))
        .slice(0, 5)
        .map(h => ({ adherent_id: h.id, score: 0, raison: 'homonyme_initiale' }))
    };
  }

  return { match_status: 'absent', match_score: 0, adherent_id: null, candidates: [] };
}

/** Batch : classe toutes les lignes d'un import. */
export function matchBatch(lignes, adherents, overrides, courseId) {
  const idxOv = indexOverrides(overrides);
  const idxNom = indexAdherentsParNom(adherents);
  return lignes.map(l => ({ ...l, ...matcher(l, adherents, idxOv, courseId, idxNom) }));
}

/** Statistiques pour l'UI (compteurs par statut). */
export function stats(lignesMatchees) {
  const init = { certain: 0, probable: 0, douteux: 0, ambigu: 0, absent: 0, manuel: 0, total: 0 };
  for (const l of lignesMatchees) {
    init[l.match_status] = (init[l.match_status] || 0) + 1;
    init.total++;
  }
  return init;
}

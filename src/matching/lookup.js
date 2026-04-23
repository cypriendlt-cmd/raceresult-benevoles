/**
 * Helpers de lookup résultat ↔ adhérent pour les vues.
 *
 * Le matching au moment de l'import peut avoir laissé un résultat avec
 * `adherent_id` vide si la graphie source diffère de celle du Sheet adhérents
 * (tiret/espace, accent, etc.). Les vues doivent donc faire un fallback par
 * équivalence de tokens pour rétablir le lien à la volée.
 */

import { tokensEquivalents } from './normalize.js';

/** Trouve l'adhérent correspondant à un résultat (strict id puis fallback tokens). */
export function trouverAdherent(resultat, adherents, adherentsById) {
  if (resultat.adherent_id) {
    const id = String(resultat.adherent_id).trim();
    const byId = adherentsById ? adherentsById.get(id) : adherents.find(a => a.id === id);
    if (byId) return byId;
  }
  const pS = resultat.prenom_source || '';
  const nS = resultat.nom_source || '';
  if (!pS && !nS) return null;
  for (const a of adherents) {
    if (!a.id) continue;
    const eq = tokensEquivalents(pS, a.prenom) && tokensEquivalents(nS, a.nom);
    const inv = tokensEquivalents(pS, a.nom) && tokensEquivalents(nS, a.prenom);
    if (eq || inv) return a;
  }
  return null;
}

/** Appartient au club : vrai si un adhérent est trouvé (strict id ou fallback tokens). */
export function estAdherent(resultat, adherents, adherentsById) {
  return !!trouverAdherent(resultat, adherents, adherentsById);
}

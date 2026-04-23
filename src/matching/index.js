/** Façade publique du module matching. */

export { normaliser, tokeniserNom, tokensEquivalents, cleAdherent } from './normalize.js';
export { indexOverrides, appliquerOverride, estRefuse } from './overrides.js';
export { scoreAdherent, matcher, matchBatch, stats } from './score.js';
export { trouverAdherent, estAdherent } from './lookup.js';

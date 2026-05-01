/** Carte d'en-tête "Ce que le club a couru ensemble" — partagée dashboard admin & accueil public. */

import { el } from './helpers.js';
import { logo } from './logo.js';

export function renderHeroCommunaute({ adherents, courses, enriched, coursesById }) {
  const actifs = adherents.filter(a => a.actif !== 'non').length;
  const coureursUniques = new Set(enriched.map(x => x.adh.id)).size;
  const distTotaleKm = Math.round(enriched.reduce((s, x) => {
    const c = coursesById.get(x.r.course_id);
    return s + (parseFloat(c?.distance_km) || 0);
  }, 0));

  const card = el('div.card.card-feature', { style: 'padding: var(--sp-6);' });
  card.appendChild(el('div.row', { style: 'align-items: flex-start; gap: var(--sp-5);' }, [
    logo({ size: 84 }),
    el('div', { style: 'flex:1; min-width: 0;' }, [
      el('span.rule-eyebrow', {}, 'Communauté'),
      el('h2', { style: 'margin-top: 10px; margin-bottom: 4px;' }, 'Ce que le club a couru ensemble'),
      el('p.muted', { style: 'margin: 0;' }, `${courses.length} course${courses.length > 1 ? 's' : ''} référencée${courses.length > 1 ? 's' : ''}, et ça compte.`),
    ]),
  ]));

  card.appendChild(el('hr.rule', { style: 'margin: var(--sp-5) 0 var(--sp-5);' }));

  const stats = el('div.hero-stats');
  [
    ['Adhérents actifs', actifs, 'inscrits au club'],
    ['Ont couru', `${coureursUniques}`, `${actifs ? Math.round(100 * coureursUniques / actifs) : 0} % du club`],
    ['Participations', enriched.length, 'enregistrées'],
    ['Courses', courses.length, 'dans la chronique'],
    ['Distance cumulée', distTotaleKm.toLocaleString('fr-FR') + ' km', 'parcourus ensemble'],
  ].forEach(([label, val, sub]) => {
    stats.appendChild(el('div.hero-stat', {}, [
      el('div.label', {}, label),
      el('div.value', {}, String(val)),
      sub ? el('div.sub', {}, sub) : null,
    ].filter(Boolean)));
  });
  card.appendChild(stats);
  return card;
}

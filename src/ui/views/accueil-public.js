/** Vue d'accueil publique (adhérent non loggé) — hero communauté + résultats des 7 derniers jours. */

import { el, alert as uiAlert, spinner } from '../components/helpers.js';
import { icon } from '../components/icons.js';
import { renderHeroCommunaute } from '../components/hero-communaute.js';
import { read } from '../../store/index.js';
import { trouverAdherent } from '../../matching/lookup.js';
import { formatDate } from '../../utils/date.js';

const FENETRE_JOURS = 7;

export default async function renderAccueilPublic(root) {
  const zone = el('div');
  root.appendChild(zone);

  zone.appendChild(el('div.card', { style: 'border:0; box-shadow:none; background:transparent; padding-left:0; padding-right:0;' }, [
    el('span.rule-eyebrow', {}, 'Accueil'),
    el('h1', { style: 'margin-top: 10px;' }, 'Bienvenue chez les Ch\'tis Marathoniens'),
    el('p.muted', { style: 'max-width: 56ch;' },
      'Les dernières courses du club et la mémoire collective.'),
  ]));

  const loading = el('div.card', {}, el('p', {}, [spinner(), ' Chargement…']));
  zone.appendChild(loading);

  try {
    const [adherents, courses, resultats] = await Promise.all([
      read.adherents(), read.courses(), read.resultats()
    ]);
    zone.removeChild(loading);

    const adhById = new Map(adherents.map(a => [a.id, a]));
    const coursesById = new Map(courses.map(c => [c.id, c]));
    const enriched = resultats
      .map(r => ({ r, adh: trouverAdherent(r, adherents, adhById) }))
      .filter(x => x.adh);

    zone.appendChild(renderHeroCommunaute({ adherents, courses, enriched, coursesById }));
    zone.appendChild(renderRecentes(courses, enriched, coursesById));
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || e)));
  }
}

function renderRecentes(courses, enriched, coursesById) {
  const card = el('div.card');
  card.appendChild(el('div', { style: 'display: flex; align-items: center; gap: 10px; margin-bottom: var(--sp-4);' }, [
    el('span', { style: 'color: var(--c-leaf-700);' }, icon('calendar', { size: 20 })),
    el('h2', { style: 'margin: 0;' }, `Derniers résultats (${FENETRE_JOURS} jours)`),
  ]));

  const seuil = new Date();
  seuil.setHours(0, 0, 0, 0);
  seuil.setDate(seuil.getDate() - FENETRE_JOURS);

  const recentes = courses
    .filter(c => {
      if (!c.date) return false;
      const d = new Date(c.date);
      return !isNaN(d) && d >= seuil;
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!recentes.length) {
    card.appendChild(el('div.empty', {}, `Aucune course enregistrée sur les ${FENETRE_JOURS} derniers jours.`));
    return card;
  }

  const parCourse = new Map();
  enriched.forEach(({ r, adh }) => {
    if (!parCourse.has(r.course_id)) parCourse.set(r.course_id, []);
    parCourse.get(r.course_id).push({ r, adh });
  });

  const wrap = el('div', { style: 'display: grid; gap: var(--sp-4);' });
  recentes.forEach(course => {
    const parts = (parCourse.get(course.id) || [])
      .sort((a, b) => secondes(a.r) - secondes(b.r));
    const block = el('div', { style: 'border-top: 1px solid var(--c-border); padding-top: var(--sp-3);' });
    block.appendChild(el('div.row', { style: 'justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap;' }, [
      el('div', {}, [
        el('a', { href: '#/course/' + course.id, style: 'font-weight: 600; color: var(--c-ink); font-size: 16px;' }, course.nom || '—'),
        el('div.muted', { style: 'font-size: 12px; margin-top: 2px;' },
          [formatDate(course.date), course.distance_km ? course.distance_km + ' km' : null, course.lieu]
            .filter(Boolean).join(' · ')),
      ]),
      el('div.muted', { style: 'font-size: 12px;' },
        parts.length ? `${parts.length} adhérent${parts.length > 1 ? 's' : ''} du club` : 'Pas d\'adhérent identifié'),
    ]));
    if (parts.length) {
      const liste = el('div', { style: 'display: grid; gap: 4px; margin-top: 10px;' });
      parts.forEach(({ r, adh }) => {
        liste.appendChild(el('div.row', { style: 'justify-content: space-between; padding: 4px 0; font-size: 14px;' }, [
          el('span', {}, `${adh.prenom} ${adh.nom}`),
          el('span.mono', { style: 'color: var(--c-blue-700);' }, r.temps_net || r.temps || '—'),
        ]));
      });
      block.appendChild(liste);
    }
    wrap.appendChild(block);
  });
  card.appendChild(wrap);
  return card;
}

function secondes(r) {
  const t = r.temps_net || r.temps || '';
  const m = String(t).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return Infinity;
  const a = +m[1], b = +m[2], c = m[3] ? +m[3] : 0;
  return m[3] ? a * 3600 + b * 60 + c : a * 60 + b;
}

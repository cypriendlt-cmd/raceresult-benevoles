/** Vue admin — liste des courses ciblées. */

import { el, spinner, alert, badge } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { listCoursesCiblees, listReponses, compterReponses } from '../../store/sondages.js';
import { formatDate } from '../../utils/date.js';

const STATUT_BADGES = {
  brouillon: 'absent',   // gris
  publiee:   'certain',  // vert
  cloturee:  'douteux',  // orangé
  archivee:  'absent',
};

const STATUT_LABELS = {
  brouillon: 'Brouillon',
  publiee:   'Publiée',
  cloturee:  'Clôturée',
  archivee:  'Archivée',
};

export default async function renderAdminCoursesList(root) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }

  root.appendChild(el('div.admin-topbar', {}, [
    el('div', {}, [
      el('h1', { style: 'margin:0' }, 'Courses ciblées'),
      el('p.muted', { style: 'margin:4px 0 0' }, 'Crée, publie, suis les réponses du club.'),
    ]),
    el('a.btn.btn-primary', { href: '#/admin/courses/new' }, '+ Nouvelle course ciblée'),
  ]));

  const loader = spinner();
  root.appendChild(loader);

  try {
    const [courses, reponses] = await Promise.all([listCoursesCiblees(), listReponses()]);
    loader.remove();

    if (!courses.length) {
      root.appendChild(el('div.card', {}, [
        el('p.empty', {}, 'Aucune course ciblée. Crée la première via le bouton ci-dessus.'),
      ]));
      return;
    }

    const card = el('div.card', { style: 'padding:0' });
    const wrap = el('div.tbl-wrap');
    const tbl = el('table.tbl.tbl-admin.tbl-stack');
    tbl.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Course'),
      el('th', {}, 'Date'),
      el('th', {}, 'Statut'),
      el('th.num', {}, 'Réponses'),
      el('th', {}, 'Actions'),
    ])));
    const tbody = el('tbody');
    courses
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(c => {
        const rep = reponses.filter(r => r.course_ciblee_id === c.id);
        const cnt = compterReponses(rep);
        tbody.appendChild(el('tr', {}, [
          el('td', { 'data-label': 'Course' }, [
            el('div', { style: 'font-weight:600' }, c.nom || '(sans nom)'),
            c.lieu ? el('div.muted', { style: 'font-size:12px' }, c.lieu) : null,
          ]),
          el('td', { 'data-label': 'Date' }, formatDate(c.date, 'short')),
          el('td', { 'data-label': 'Statut' }, badgeStatut(c.statut)),
          el('td.num', { 'data-label': 'Réponses' }, cntBadge(cnt)),
          el('td', { 'data-label': 'Actions' }, el('div.row-actions', {}, [
            el('a', { href: '#/admin/courses/' + encodeURIComponent(c.id) }, 'Modifier'),
            el('a', { href: '#/admin/sondage/' + encodeURIComponent(c.id) }, 'Réponses'),
            el('a', { href: '#/sondages/' + encodeURIComponent(c.id) }, 'Voir'),
          ])),
        ]));
      });
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    card.appendChild(wrap);
    root.appendChild(card);
  } catch (err) {
    loader.remove();
    root.appendChild(alert('err', err.message));
  }
}

function badgeStatut(s) {
  const kind = STATUT_BADGES[s] || 'absent';
  const lbl = STATUT_LABELS[s] || s || '';
  return el('span.badge.badge-' + kind, {}, lbl.toLowerCase());
}

function cntBadge(c) {
  return el('span.cnt-pills', {}, [
    el('span.compteur-oui',  {}, String(c.oui)),
    el('span.compteur-peut', {}, String(c.peut_etre)),
    el('span.compteur-non',  {}, String(c.non)),
  ]);
}


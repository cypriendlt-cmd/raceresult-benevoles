/** Vue admin — liste des sondages "Vie du club". */

import { el, spinner, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { listAll, listReponses } from '../../store/clubPolls.js';
import { formatDate } from '../../utils/date.js';

const STATUT_BADGES = {
  brouillon: 'absent',
  publiee:   'certain',
  cloturee:  'douteux',
  archivee:  'absent',
};
const STATUT_LABELS = {
  brouillon: 'Brouillon',
  publiee:   'Publié',
  cloturee:  'Clôturé',
  archivee:  'Archivé',
};
const TYPE_LABELS = {
  unique: 'Choix unique',
  multi:  'Choix multiple',
};

export default async function renderAdminClubPollsList(root) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }

  root.appendChild(el('div.admin-topbar', {}, [
    el('div', {}, [
      el('h1', { style: 'margin:0' }, 'Sondages — Vie du club'),
      el('p.muted', { style: 'margin:4px 0 0' }, 'Présence, horaires, aide bénévole, organisation.'),
    ]),
    el('a.btn.btn-primary', { href: '#/admin/club-polls/new' }, '+ Nouveau sondage'),
  ]));

  const loader = spinner();
  root.appendChild(loader);

  try {
    const [sondages, reponses] = await Promise.all([listAll(), listReponses()]);
    loader.remove();

    if (!sondages.length) {
      root.appendChild(el('div.card', {}, [
        el('p.empty', {}, 'Aucun sondage. Crée le premier via le bouton ci-dessus.'),
      ]));
      return;
    }

    const card = el('div.card', { style: 'padding:0' });
    const wrap = el('div.tbl-wrap');
    const tbl = el('table.tbl.tbl-admin.tbl-stack');
    tbl.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Titre'),
      el('th', {}, 'Type'),
      el('th', {}, 'Statut'),
      el('th.num', {}, 'Réponses'),
      el('th', {}, 'Actions'),
    ])));
    const tbody = el('tbody');
    sondages
      .slice()
      .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
      .forEach(s => {
        const n = reponses.filter(r => r.sondage_id === s.id).length;
        tbody.appendChild(el('tr', {}, [
          el('td', { 'data-label': 'Titre' }, [
            el('div', { style: 'font-weight:600' }, s.titre || '(sans titre)'),
            s.date_debut || s.date_fin
              ? el('div.muted', { style: 'font-size:12px' }, [s.date_debut, s.date_fin].filter(Boolean).map(d => formatDate(d, 'short')).join(' → '))
              : null,
          ]),
          el('td', { 'data-label': 'Type' }, TYPE_LABELS[s.type_reponse] || s.type_reponse || ''),
          el('td', { 'data-label': 'Statut' }, badgeStatut(s.statut)),
          el('td.num', { 'data-label': 'Réponses' }, String(n)),
          el('td', { 'data-label': 'Actions' }, el('div.row-actions', {}, [
            el('a', { href: '#/admin/club-polls/' + encodeURIComponent(s.id) }, 'Modifier'),
            el('a', { href: '#/admin/club-poll/' + encodeURIComponent(s.id) }, 'Réponses'),
            el('a', { href: '#/club-polls/' + encodeURIComponent(s.id) }, 'Voir'),
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

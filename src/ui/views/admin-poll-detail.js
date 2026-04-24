/** Vue admin — détail des réponses d'un sondage. */

import { el, spinner, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { getCourseCiblee, listReponsesPourCourse, compterReponses, deleteReponse } from '../../store/sondages.js';

export default async function renderAdminPollDetail(root, params) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }
  const id = decodeURIComponent(params[0] || '');
  await render(root, id);
}

async function render(root, id) {
  root.innerHTML = '';
  root.appendChild(el('div.admin-topbar', {}, [
    el('a.btn.btn-ghost', { href: '#/admin/courses' }, '← Retour'),
    el('a.btn', { href: '#/admin/courses/' + encodeURIComponent(id) }, 'Modifier la course'),
    el('a.btn', { href: '#/sondages/' + encodeURIComponent(id) }, 'Voir côté adhérent'),
  ]));

  const loader = spinner();
  root.appendChild(loader);

  try {
    const [course, reponses] = await Promise.all([
      getCourseCiblee(id),
      listReponsesPourCourse(id),
    ]);
    loader.remove();
    if (!course) { root.appendChild(alert('err', 'Course introuvable.')); return; }

    root.appendChild(el('h1', {}, course.nom));
    const meta = [formatDate(course.date), course.lieu].filter(Boolean).join(' · ');
    if (meta) root.appendChild(el('p.muted', {}, meta));

    const c = compterReponses(reponses);
    root.appendChild(el('div.card.sondage-totaux', {}, [
      el('div.totaux-item.totaux-oui',  {}, [ el('div.val', {}, String(c.oui)),       el('div.lbl', {}, 'oui') ]),
      el('div.totaux-item.totaux-peut', {}, [ el('div.val', {}, String(c.peut_etre)), el('div.lbl', {}, 'peut-être') ]),
      el('div.totaux-item.totaux-non',  {}, [ el('div.val', {}, String(c.non)),       el('div.lbl', {}, 'non') ]),
    ]));

    if (!reponses.length) {
      root.appendChild(el('div.card', {}, el('p.empty', {}, 'Aucune réponse pour l\'instant.')));
      return;
    }

    const feedback = el('div.form-feedback');
    root.appendChild(feedback);

    const card = el('div.card', { style: 'padding:0; overflow:hidden' });
    const tbl = el('table.tbl.tbl-admin');
    tbl.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Nom'),
      el('th', {}, 'Prénom'),
      el('th', {}, 'Réponse'),
      el('th', {}, 'Distance'),
      el('th', {}, 'Dernière MAJ'),
      el('th', {}, ''),
    ])));
    const tbody = el('tbody');
    reponses
      .slice()
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
      .forEach(r => {
        const btn = el('button.btn.btn-ghost.btn-del', { type: 'button', title: 'Supprimer cette réponse' }, '✕');
        btn.addEventListener('click', async () => {
          if (!confirm(`Supprimer la réponse de ${r.prenom} ${r.nom} ?`)) return;
          btn.disabled = true;
          btn.textContent = '…';
          try {
            await deleteReponse(r.id);
            await render(root, id);
          } catch (err) {
            btn.disabled = false;
            btn.textContent = '✕';
            feedback.appendChild(alert('err', err.message));
          }
        });
        tbody.appendChild(el('tr', {}, [
          el('td', { style: 'font-weight:600' }, r.nom || ''),
          el('td', {}, r.prenom || ''),
          el('td', {}, badgeReponse(r.reponse)),
          el('td', {}, r.distance_choisie || (r.reponse === 'oui' ? el('span.muted', {}, '—') : '')),
          el('td.mono', {}, (r.updated_at || r.created_at || '').slice(0, 16).replace('T', ' ')),
          el('td', { style: 'text-align:right' }, btn),
        ]));
      });
    tbl.appendChild(tbody);
    card.appendChild(tbl);
    root.appendChild(card);
  } catch (err) {
    loader.remove();
    root.appendChild(alert('err', err.message));
  }
}

function badgeReponse(r) {
  if (r === 'oui')       return el('span.badge.badge-certain', {}, 'oui');
  if (r === 'peut_etre') return el('span.badge.badge-probable', {}, 'peut-être');
  if (r === 'non')       return el('span.badge.badge-absent', {}, 'non');
  return el('span.muted', {}, r || '');
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

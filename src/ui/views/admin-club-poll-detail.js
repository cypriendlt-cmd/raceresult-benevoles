/** Vue admin — détail des réponses d'un sondage "Vie du club". */

import { el, spinner, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import {
  get, listReponsesPourSondage, compterReponses, parseOptions, deleteReponse,
} from '../../store/clubPolls.js';
import { formatDate } from '../../utils/date.js';

export default async function renderAdminClubPollDetail(root, params) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }
  const id = decodeURIComponent(params[0] || '');
  await render(root, id);
}

async function render(root, id) {
  root.innerHTML = '';
  root.appendChild(el('div.admin-topbar', {}, [
    el('a.btn.btn-ghost', { href: '#/admin/club-polls' }, '← Retour'),
    el('a.btn', { href: '#/admin/club-polls/' + encodeURIComponent(id) }, 'Modifier'),
    el('a.btn', { href: '#/club-polls/' + encodeURIComponent(id) }, 'Voir côté adhérent'),
  ]));

  const loader = spinner();
  root.appendChild(loader);

  try {
    const [sondage, reponses] = await Promise.all([
      get(id),
      listReponsesPourSondage(id),
    ]);
    loader.remove();
    if (!sondage) { root.appendChild(alert('err', 'Sondage introuvable.')); return; }

    const options = parseOptions(sondage.options);

    root.appendChild(el('h1', {}, sondage.titre));
    const meta = [sondage.date_debut, sondage.date_fin].filter(Boolean).map(d => formatDate(d)).join(' → ');
    if (meta) root.appendChild(el('p.muted', {}, meta));

    // Compteurs par option (barres)
    root.appendChild(renderCompteurs(reponses, options));

    if (!reponses.length) {
      root.appendChild(el('div.card', {}, el('p.empty', {}, 'Aucune réponse pour l\'instant.')));
      return;
    }

    // Bouton copier
    const btnCopy = el('button.btn.btn-ghost', { type: 'button' }, 'Copier les résultats');
    btnCopy.addEventListener('click', () => {
      const txt = exportText(sondage, options, reponses);
      navigator.clipboard.writeText(txt).then(
        () => { btnCopy.textContent = 'Copié ✓'; setTimeout(() => btnCopy.textContent = 'Copier les résultats', 2000); },
        () => { btnCopy.textContent = 'Copie impossible'; }
      );
    });
    root.appendChild(el('div.row', { style: 'margin-bottom: 12px' }, [btnCopy]));

    const feedback = el('div.form-feedback');
    root.appendChild(feedback);

    // Tableau réponses
    const card = el('div.card', { style: 'padding:0' });
    const wrap = el('div.tbl-wrap');
    const tbl = el('table.tbl.tbl-admin.tbl-stack');
    tbl.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Nom'),
      el('th', {}, 'Prénom'),
      el('th', {}, 'Choix'),
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
          el('td', { 'data-label': 'Nom', style: 'font-weight:600' }, r.nom || ''),
          el('td', { 'data-label': 'Prénom' }, r.prenom || ''),
          el('td', { 'data-label': 'Choix' }, parseOptions(r.options_choisies).join(', ')),
          el('td.mono', { 'data-label': 'Mise à jour' }, (r.updated_at || r.created_at || '').slice(0, 16).replace('T', ' ')),
          el('td', { 'data-label': '', style: 'text-align:right' }, btn),
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

function renderCompteurs(reponses, options) {
  const cnt = compterReponses(reponses, options);
  const total = reponses.length || 1;
  const list = el('div.club-poll-results');
  options.forEach(o => {
    const n = cnt[o] || 0;
    const pct = Math.round((n / total) * 100);
    list.appendChild(el('div.club-poll-result', {}, [
      el('div.club-poll-result-row', {}, [
        el('span.club-poll-result-label', {}, o),
        el('span.club-poll-result-n', {}, `${n}`),
      ]),
      el('div.club-poll-result-bar', {}, [
        el('div.club-poll-result-fill', { style: `width:${pct}%` }),
      ]),
    ]));
  });
  return el('div.card', {}, [
    el('h2', { style: 'margin-top:0' }, `${reponses.length} ${reponses.length === 1 ? 'réponse' : 'réponses'}`),
    list,
  ]);
}

function exportText(sondage, options, reponses) {
  const lines = [];
  lines.push(sondage.titre);
  lines.push('—'.repeat(40));
  const cnt = compterReponses(reponses, options);
  options.forEach(o => lines.push(`• ${o} : ${cnt[o] || 0}`));
  lines.push('');
  lines.push(`${reponses.length} réponse(s) :`);
  reponses
    .slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
    .forEach(r => {
      lines.push(`  - ${r.prenom} ${r.nom} → ${parseOptions(r.options_choisies).join(', ')}`);
    });
  return lines.join('\n');
}

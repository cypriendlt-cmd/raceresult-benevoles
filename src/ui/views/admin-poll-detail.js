/** Vue admin — détail des réponses d'un sondage. */

import { el, spinner, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { getCourseCiblee, listReponsesPourCourse, compterReponses, deleteReponse } from '../../store/sondages.js';
import { formatDate } from '../../utils/date.js';
import { read } from '../../store/index.js';
import { tokensEquivalents } from '../../matching/normalize.js';

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
    const [course, reponses, resultats, courses] = await Promise.all([
      getCourseCiblee(id),
      listReponsesPourCourse(id),
      read.resultats().catch(() => []),
      read.courses().catch(() => []),
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

    // Bilan participation (si la course a été liée à une course importée)
    if (course.course_id) {
      root.appendChild(renderBilan({ course, reponses, resultats, courses }));
    } else {
      root.appendChild(el('div.card', { style: 'border-style: dashed;' }, [
        el('p.muted', { style: 'margin: 0;' }, [
          'Pour comparer les promesses du sondage avec les vrais participants (utile pour les remboursements), ',
          el('a', { href: '#/admin/courses/' + encodeURIComponent(id) }, 'lie cette course ciblée'),
          ' à une course importée.',
        ]),
      ]));
    }

    if (!reponses.length) {
      root.appendChild(el('div.card', {}, el('p.empty', {}, 'Aucune réponse pour l\'instant.')));
      return;
    }

    const feedback = el('div.form-feedback');
    root.appendChild(feedback);

    const card = el('div.card', { style: 'padding:0' });
    const wrap = el('div.tbl-wrap');
    const tbl = el('table.tbl.tbl-admin.tbl-stack');
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
          el('td', { 'data-label': 'Nom', style: 'font-weight:600' }, r.nom || ''),
          el('td', { 'data-label': 'Prénom' }, r.prenom || ''),
          el('td', { 'data-label': 'Réponse' }, badgeReponse(r.reponse)),
          el('td', { 'data-label': 'Distance' }, r.distance_choisie || (r.reponse === 'oui' ? el('span.muted', {}, '—') : '')),
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

function badgeReponse(r) {
  if (r === 'oui')       return el('span.badge.badge-certain', {}, 'oui');
  if (r === 'peut_etre') return el('span.badge.badge-probable', {}, 'peut-être');
  if (r === 'non')       return el('span.badge.badge-absent', {}, 'non');
  return el('span.muted', {}, r || '');
}

// =====================================================================
// Bilan participation : croise réponses sondage ↔ résultats scrapés
// =====================================================================

function renderBilan({ course, reponses, resultats, courses }) {
  const courseScrap = courses.find(c => c.id === course.course_id);
  const resultatsCourse = resultats.filter(r => r.course_id === course.course_id);

  // Index pour matching rapide
  const ouiReponses = reponses.filter(r => r.reponse === 'oui');

  const aCouru = (rep) => {
    if (rep.adherent_id && resultatsCourse.some(r => r.adherent_id === rep.adherent_id)) return true;
    return resultatsCourse.some(r =>
      tokensEquivalents(r.prenom_source, rep.prenom) &&
      tokensEquivalents(r.nom_source, rep.nom)
    );
  };

  const reponseDe = (resultat) => reponses.find(rep => {
    if (rep.adherent_id && rep.adherent_id === resultat.adherent_id) return true;
    return tokensEquivalents(rep.prenom, resultat.prenom_source) &&
           tokensEquivalents(rep.nom, resultat.nom_source);
  });

  const promessesTenues = ouiReponses.filter(aCouru);
  const forfaits = ouiReponses.filter(rep => !aCouru(rep));
  const sansReponse = resultatsCourse.filter(r => !reponseDe(r));
  // (les non/peut-être qui n'ont pas couru sont silencieux — pas affichés)

  const card = el('div.card.bilan-card');
  card.appendChild(el('h2', { style: 'margin-top: 0;' }, 'Bilan participation'));
  card.appendChild(el('p.muted', { style: 'margin-bottom: 16px;' },
    `Croisement avec « ${courseScrap?.nom || course.course_id} » (${resultatsCourse.length} participant${resultatsCourse.length > 1 ? 's' : ''} importé${resultatsCourse.length > 1 ? 's' : ''}).`));

  // 3 compteurs au format hero
  card.appendChild(el('div.bilan-totaux', {}, [
    bilanCounter('✅', promessesTenues.length, 'Promesses tenues', 'ok'),
    bilanCounter('❌', forfaits.length, 'Forfaits', 'warn'),
    bilanCounter('🆕', sansReponse.length, 'Couru sans répondre', 'info'),
  ]));

  // Listes détaillées
  card.appendChild(bilanSection(
    'Promesses tenues — remboursables',
    promessesTenues.map(rep => `${rep.prenom} ${rep.nom}` + (rep.distance_choisie ? ` · ${rep.distance_choisie}` : '')),
    'Aucune promesse tenue (encore).',
    'ok'
  ));

  card.appendChild(bilanSection(
    'Forfaits — ont dit oui mais n\'ont pas couru',
    forfaits.map(rep => `${rep.prenom} ${rep.nom}` + (rep.distance_choisie ? ` · ${rep.distance_choisie}` : '')),
    'Aucun forfait — tout le monde a tenu sa promesse.',
    'warn'
  ));

  card.appendChild(bilanSection(
    'Ont couru sans répondre au sondage',
    sansReponse.map(r => `${r.prenom_source} ${r.nom_source}` + (r.adherent_id ? '' : ' (non identifié)')),
    'Tous les participants importés avaient répondu au sondage.',
    'info'
  ));

  return card;
}

function bilanCounter(emoji, n, label, kind) {
  return el(`div.bilan-counter.bilan-${kind}`, {}, [
    el('div.emoji', {}, emoji),
    el('div.val', {}, String(n)),
    el('div.lbl', {}, label),
  ]);
}

function bilanSection(titre, items, vide, kind) {
  const sec = el(`details.bilan-section.bilan-${kind}`, items.length ? { open: true } : {});
  sec.appendChild(el('summary', {}, [
    el('strong', {}, titre),
    el('span.muted', { style: 'margin-left: 8px;' }, `(${items.length})`),
  ]));
  if (!items.length) {
    sec.appendChild(el('p.empty', { style: 'margin: 8px 0;' }, vide));
  } else {
    const ul = el('ul', { style: 'margin: 8px 0 0 0; padding-left: 20px;' });
    items.sort((a, b) => a.localeCompare(b)).forEach(t => ul.appendChild(el('li', {}, t)));
    sec.appendChild(ul);
  }
  return sec;
}


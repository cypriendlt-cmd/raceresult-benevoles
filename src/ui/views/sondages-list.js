/** Vue adhérent — hub sondages : 2 sections (Courses ciblées + Vie du club). */

import { el, spinner, alert } from '../components/helpers.js';
import {
  listCoursesCiblees, listReponses as listReponsesCourses, compterReponses as compterReponsesCourses,
} from '../../store/sondages.js';
import {
  listAll as listClubPolls, listReponses as listReponsesClub, parseOptions,
} from '../../store/clubPolls.js';
import { formatDate, isPast } from '../../utils/date.js';

const STATUTS_OUVERTS  = ['publiee'];
const STATUTS_ARCHIVES = ['cloturee', 'archivee'];

export default async function renderSondagesList(root) {
  root.appendChild(el('div.card-feature.card', {}, [
    el('span.rule-eyebrow', {}, 'Sondages du club'),
    el('h1', { style: 'margin-top:12px' }, 'Donne ton avis.'),
    el('p', { class: 'muted', style: 'max-width:56ch' },
      "Sondages liés aux courses ciblées et à la vie du club (présence, horaires, organisation)."),
  ]));

  const tabs = el('div.row', { style: 'gap: 6px; margin-bottom: var(--sp-4); flex-wrap: wrap;' });
  const liste = el('div');
  root.appendChild(tabs);
  root.appendChild(liste);

  let vue = 'ouverts';
  let courses = null, reponsesCourses = null, clubPolls = null, reponsesClub = null;

  async function chargerSiBesoin() {
    if (courses) return;
    const loader = spinner();
    liste.replaceChildren(loader);
    try {
      [courses, reponsesCourses, clubPolls, reponsesClub] = await Promise.all([
        listCoursesCiblees(),
        listReponsesCourses(),
        listClubPolls().catch(() => []),
        listReponsesClub().catch(() => []),
      ]);
    } catch (err) {
      liste.replaceChildren(alert('err', 'Lecture impossible : ' + err.message));
      throw err;
    }
  }

  function render() {
    const statuts = vue === 'archives' ? STATUTS_ARCHIVES : STATUTS_OUVERTS;
    const coursesFiltres = courses.filter(c => statuts.includes(c.statut));
    const clubFiltres    = clubPolls.filter(s => statuts.includes(s.statut));

    const nbOuverts  = courses.filter(c => STATUTS_OUVERTS.includes(c.statut)).length
                     + clubPolls.filter(s => STATUTS_OUVERTS.includes(s.statut)).length;
    const nbArchives = courses.filter(c => STATUTS_ARCHIVES.includes(c.statut)).length
                     + clubPolls.filter(s => STATUTS_ARCHIVES.includes(s.statut)).length;

    tabs.replaceChildren();
    [
      ['ouverts',  `Ouverts (${nbOuverts})`],
      ['archives', `Clôturés (${nbArchives})`],
    ].forEach(([k, lbl]) => {
      const actif = vue === k;
      tabs.appendChild(el('button.btn' + (actif ? '.btn-primary' : ''), {
        style: 'padding: 4px 12px; font-size: 13px;',
        onclick: () => { vue = k; render(); }
      }, lbl));
    });

    liste.replaceChildren();

    // Section 1 — Courses ciblées
    liste.appendChild(el('h2.section-title', { style: 'margin-top: var(--sp-5)' }, 'Courses ciblées'));
    if (!coursesFiltres.length) {
      liste.appendChild(el('p.empty', {}, vue === 'archives'
        ? 'Aucun sondage de course clôturé.'
        : 'Aucune course ciblée publiée pour le moment.'));
    } else {
      const grid = el('div.sondages-grid');
      coursesFiltres
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .forEach(c => grid.appendChild(carteCourse(c, reponsesCourses)));
      liste.appendChild(grid);
    }

    // Section 2 — Vie du club
    liste.appendChild(el('h2.section-title', { style: 'margin-top: var(--sp-6)' }, 'Vie du club'));
    if (!clubFiltres.length) {
      liste.appendChild(el('p.empty', {}, vue === 'archives'
        ? 'Aucun sondage de vie du club clôturé.'
        : 'Aucun sondage de vie du club ouvert pour le moment.'));
    } else {
      const grid = el('div.sondages-grid');
      clubFiltres
        .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
        .forEach(s => grid.appendChild(carteClub(s, reponsesClub)));
      liste.appendChild(grid);
    }
  }

  try {
    await chargerSiBesoin();
    render();
  } catch { /* déjà affiché */ }
}

function carteCourse(c, reponses) {
  const rep = reponses.filter(r => r.course_ciblee_id === c.id);
  const cnt = compterReponsesCourses(rep);
  const deadline = isPast(c.date_limite_reponse);
  const closed = c.statut === 'cloturee';
  const archived = c.statut === 'archivee';

  return el('a.sondage-card', { href: '#/sondages/' + encodeURIComponent(c.id) }, [
    el('div.sondage-card-top', {}, [
      el('span.sondage-date', {}, formatDate(c.date)),
      archived ? el('span.badge.badge-absent', {}, 'Archivé')
               : closed ? el('span.badge.badge-douteux', {}, 'Clôturé')
                        : deadline ? el('span.badge.badge-douteux', {}, 'Délai dépassé')
                                   : el('span.badge.badge-certain', {}, 'Ouvert'),
    ]),
    el('h2.sondage-nom', {}, c.nom || '(sans nom)'),
    el('p.muted', {}, [c.lieu, c.distances].filter(Boolean).join(' · ') || ' '),
    el('div.sondage-compteurs', {}, [
      el('span.compteur-oui', {}, `${cnt.oui} oui`),
      el('span.compteur-peut', {}, `${cnt.peut_etre} peut-être`),
      el('span.compteur-non', {}, `${cnt.non} non`),
    ]),
  ]);
}

function carteClub(s, reponses) {
  const n = reponses.filter(r => r.sondage_id === s.id).length;
  const deadline = isPast(s.date_limite_reponse);
  const closed = s.statut === 'cloturee';
  const archived = s.statut === 'archivee';
  const periode = [s.date_debut, s.date_fin].filter(Boolean).map(d => formatDate(d, 'short')).join(' → ');
  const opts = parseOptions(s.options);

  return el('a.sondage-card', { href: '#/club-polls/' + encodeURIComponent(s.id) }, [
    el('div.sondage-card-top', {}, [
      el('span.sondage-date', {}, periode || ''),
      archived ? el('span.badge.badge-absent', {}, 'Archivé')
               : closed ? el('span.badge.badge-douteux', {}, 'Clôturé')
                        : deadline ? el('span.badge.badge-douteux', {}, 'Délai dépassé')
                                   : el('span.badge.badge-certain', {}, 'Ouvert'),
    ]),
    el('h2.sondage-nom', {}, s.titre || '(sans titre)'),
    el('p.muted', {}, opts.length ? `${opts.length} options · ${s.type_reponse === 'multi' ? 'choix multiple' : 'choix unique'}` : ' '),
    el('div.sondage-compteurs', {}, [
      el('span.compteur-oui', {}, `${n} ${n === 1 ? 'réponse' : 'réponses'}`),
    ]),
  ]);
}

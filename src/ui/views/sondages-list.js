/** Vue adhérent — liste des courses ciblées publiées (+ bascule archives). */

import { el, spinner, alert } from '../components/helpers.js';
import { listCoursesCiblees, listReponses, compterReponses } from '../../store/sondages.js';
import { formatDate, isPast } from '../../utils/date.js';

const STATUTS_OUVERTS  = ['publiee'];
const STATUTS_ARCHIVES = ['cloturee', 'archivee'];

export default async function renderSondagesList(root) {
  root.appendChild(el('div.card-feature.card', {}, [
    el('span.rule-eyebrow', {}, 'Courses ciblées'),
    el('h1', { style: 'margin-top:12px' }, 'Le club se déplace.'),
    el('p', { class: 'muted', style: 'max-width:56ch' },
      "Réponds à un sondage pour indiquer si tu participes aux prochaines courses ciblées par le bureau."),
  ]));

  const tabs = el('div.row', { style: 'gap: 6px; margin-bottom: var(--sp-4); flex-wrap: wrap;' });
  const liste = el('div');
  root.appendChild(tabs);
  root.appendChild(liste);

  let vue = 'ouverts'; // 'ouverts' | 'archives'
  let toutesCourses = null;
  let toutesReponses = null;

  async function chargerSiBesoin() {
    if (toutesCourses && toutesReponses) return;
    const loader = spinner();
    liste.replaceChildren(loader);
    try {
      const [c, r] = await Promise.all([listCoursesCiblees(), listReponses()]);
      toutesCourses = c;
      toutesReponses = r;
    } catch (err) {
      liste.replaceChildren(alert('err', 'Lecture impossible : ' + err.message));
      throw err;
    }
  }

  function render() {
    const nbOuverts  = toutesCourses.filter(c => STATUTS_OUVERTS.includes(c.statut)).length;
    const nbArchives = toutesCourses.filter(c => STATUTS_ARCHIVES.includes(c.statut)).length;

    tabs.replaceChildren();
    [
      ['ouverts',  `Sondages ouverts (${nbOuverts})`],
      ['archives', `Sondages clôturés (${nbArchives})`],
    ].forEach(([k, lbl]) => {
      const actif = vue === k;
      tabs.appendChild(el('button.btn' + (actif ? '.btn-primary' : ''), {
        style: 'padding: 4px 12px; font-size: 13px;',
        onclick: () => { vue = k; render(); }
      }, lbl));
    });

    const statuts = vue === 'archives' ? STATUTS_ARCHIVES : STATUTS_OUVERTS;
    const courses = toutesCourses.filter(c => statuts.includes(c.statut));

    liste.replaceChildren();
    if (!courses.length) {
      liste.appendChild(el('p.empty', {}, vue === 'archives'
        ? 'Aucun sondage clôturé pour le moment.'
        : 'Aucune course ciblée publiée pour le moment.'));
      return;
    }

    const grid = el('div.sondages-grid');
    courses
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .forEach(c => {
        const rep = toutesReponses.filter(r => r.course_ciblee_id === c.id);
        const cnt = compterReponses(rep);
        const deadline = isPast(c.date_limite_reponse);
        const closed = c.statut === 'cloturee';
        const archived = c.statut === 'archivee';

        const card = el('a.sondage-card', { href: '#/sondages/' + encodeURIComponent(c.id) }, [
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
        grid.appendChild(card);
      });
    liste.appendChild(grid);
  }

  try {
    await chargerSiBesoin();
    render();
  } catch { /* déjà affiché */ }
}

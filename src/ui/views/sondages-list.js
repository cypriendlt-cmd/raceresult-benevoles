/** Vue adhérent — liste des courses ciblées publiées. */

import { el, spinner, alert } from '../components/helpers.js';
import { listCoursesPubliees, listReponses, compterReponses } from '../../store/sondages.js';
import { formatDate, isPast } from '../../utils/date.js';

export default async function renderSondagesList(root) {
  root.appendChild(el('div.card-feature.card', {}, [
    el('span.rule-eyebrow', {}, 'Courses ciblées'),
    el('h1', { style: 'margin-top:12px' }, 'Le club se déplace.'),
    el('p', { class: 'muted', style: 'max-width:56ch' },
      "Réponds à un sondage pour indiquer si tu participes aux prochaines courses ciblées par le bureau."),
  ]));

  const loader = spinner();
  root.appendChild(loader);

  try {
    const [courses, reponses] = await Promise.all([
      listCoursesPubliees(),
      listReponses(),
    ]);
    loader.remove();

    if (!courses.length) {
      root.appendChild(el('p.empty', {}, 'Aucune course ciblée publiée pour le moment.'));
      return;
    }

    const grid = el('div.sondages-grid');
    courses
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach(c => {
        const rep = reponses.filter(r => r.course_ciblee_id === c.id);
        const cnt = compterReponses(rep);
        const deadline = isPast(c.date_limite_reponse);
        const closed = c.statut === 'cloturee';

        const card = el('a.sondage-card', { href: '#/sondages/' + encodeURIComponent(c.id) }, [
          el('div.sondage-card-top', {}, [
            el('span.sondage-date', {}, formatDate(c.date)),
            closed ? el('span.badge.badge-absent', {}, 'Clôturé')
                   : deadline ? el('span.badge.badge-douteux', {}, 'Délai dépassé')
                              : el('span.badge.badge-certain', {}, 'Ouvert'),
          ]),
          el('h2.sondage-nom', {}, c.nom || '(sans nom)'),
          el('p.muted', {}, [c.lieu, c.distances].filter(Boolean).join(' · ') || ' '),
          el('div.sondage-compteurs', {}, [
            el('span.compteur-oui', {}, `${cnt.oui} oui`),
            el('span.compteur-peut', {}, `${cnt.peut_etre} peut-être`),
            el('span.compteur-non', {}, `${cnt.non} non`),
          ]),
        ]);
        grid.appendChild(card);
      });
    root.appendChild(grid);
  } catch (err) {
    loader.remove();
    root.appendChild(alert('err', 'Lecture impossible : ' + err.message));
  }
}


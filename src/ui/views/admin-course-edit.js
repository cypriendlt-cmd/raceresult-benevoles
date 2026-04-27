/** Vue admin — création / édition / suppression d'une course ciblée. */

import { el, spinner, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { getCourseCiblee, saveCourseCiblee, deleteCourseCiblee } from '../../store/sondages.js';
import { read } from '../../store/index.js';
import { formatDate } from '../../utils/date.js';

const STATUT_LABELS = {
  brouillon: 'Brouillon',
  publiee:   'Publiée',
  cloturee:  'Clôturée',
  archivee:  'Archivée',
};

export default async function renderAdminCourseEdit(root, params) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }

  const id = params[0] ? decodeURIComponent(params[0]) : null;
  const [existante, coursesScrapees] = await Promise.all([
    id ? getCourseCiblee(id) : Promise.resolve(null),
    read.courses().catch(() => []),
  ]);
  const course = existante || { statut: 'brouillon', afficher_participants: 'oui', autoriser_modif_reponse: 'oui' };

  // Barre de navigation contextuelle
  root.appendChild(el('div.admin-topbar', {}, [
    el('a.btn.btn-ghost', { href: '#/admin/courses' }, '← Retour'),
    ...(id ? [
      el('a.btn', { href: '#/sondages/' + encodeURIComponent(id) }, 'Voir côté adhérent'),
      el('a.btn', { href: '#/admin/sondage/' + encodeURIComponent(id) }, 'Voir les réponses'),
    ] : []),
  ]));

  root.appendChild(el('h1', {}, id ? 'Modifier la course ciblée' : 'Nouvelle course ciblée'));
  root.appendChild(el('p.muted', {}, id ? course.nom : 'Renseigne les informations principales puis publie quand tu es prêt.'));

  const form = el('form.admin-form');

  // Section 1 — Infos de base
  form.appendChild(section('Infos principales', el('div.form-grid', {}, [
    field('Nom de la course', input('nom', course.nom, { required: true, placeholder: 'Ex : 10 km de Pérenchies' })),
    field('Date', input('date', course.date, { type: 'date', required: true })),
    field('Lieu', input('lieu', course.lieu, { placeholder: 'Ex : Pérenchies (59)' })),
    field('Distance(s)', input('distances', course.distances, { placeholder: 'Ex : 10 km, semi, marathon (séparer par des virgules)' })),
  ])));

  // Section 2 — Liens
  form.appendChild(section('Liens utiles', el('div.form-grid', {}, [
    field('Site officiel', input('url_officielle', course.url_officielle, { type: 'url', placeholder: 'https://...' })),
    field('Inscription',   input('url_inscription', course.url_inscription, { type: 'url', placeholder: 'https://...' })),
  ])));

  // Section 3 — Description
  form.appendChild(section('Description', field('Commentaire libre', textarea('description', course.description, 4, 'Parcours, rendez-vous, covoiturage, etc.'))));

  // Section 3bis — Liaison course importée (pour bilan participation)
  const optionsCourses = [['', '— Aucune (pas de bilan)']].concat(
    coursesScrapees
      .slice()
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .map(c => [c.id, `${c.nom || '(sans nom)'} — ${formatDate(c.date, 'short')}${c.lieu ? ' · ' + c.lieu : ''}`])
  );
  form.appendChild(section('Bilan participation (après import)',
    el('div', {}, [
      el('p.muted', { style: 'margin-bottom: 12px;' },
        'Une fois la course terminée et ses résultats importés, lie-la ici pour croiser les réponses du sondage avec les vrais participants. Utile pour les remboursements.'),
      field('Course importée correspondante', selectField('course_id', course.course_id || '', optionsCourses)),
    ])
  ));

  // Section 4 — Sondage
  form.appendChild(section('Paramètres du sondage', el('div.form-grid', {}, [
    field('Statut', selectField('statut', course.statut, Object.keys(STATUT_LABELS).map(k => [k, STATUT_LABELS[k]]))),
    field('Date limite de réponse', input('date_limite_reponse', course.date_limite_reponse, { type: 'date' })),
    field('Afficher les participants', selectField('afficher_participants', course.afficher_participants, [['oui','Oui'],['non','Non']])),
    field('Autoriser la modification de réponse', selectField('autoriser_modif_reponse', course.autoriser_modif_reponse, [['oui','Oui'],['non','Non']])),
  ])));

  // Actions
  const actions = el('div.admin-actions', {}, [
    el('button.btn.btn-primary', { type: 'submit' }, id ? 'Enregistrer' : 'Créer la course'),
  ]);
  if (id) {
    const btnDel = el('button.btn.btn-danger', { type: 'button' }, 'Supprimer');
    btnDel.addEventListener('click', async () => {
      if (!confirm('Supprimer cette course ET toutes les réponses associées ?')) return;
      btnDel.disabled = true;
      btnDel.textContent = 'Suppression…';
      try {
        await deleteCourseCiblee(id);
        location.hash = '#/admin/courses';
      } catch (err) {
        btnDel.disabled = false;
        btnDel.textContent = 'Supprimer';
        feedback.appendChild(alert('err', err.message));
      }
    });
    actions.appendChild(btnDel);
  }
  form.appendChild(actions);

  const feedback = el('div.form-feedback');
  form.appendChild(feedback);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    feedback.innerHTML = '';
    const fd = new FormData(form);
    const payload = { ...(existante || {}) };
    ['nom', 'date', 'lieu', 'distances', 'url_officielle', 'url_inscription', 'description', 'date_limite_reponse']
      .forEach(k => payload[k] = (fd.get(k) || '').trim());
    payload.statut = fd.get('statut');
    payload.afficher_participants = fd.get('afficher_participants');
    payload.autoriser_modif_reponse = fd.get('autoriser_modif_reponse');
    payload.course_id = (fd.get('course_id') || '').trim();
    try {
      const { course: saved, distancesReinitialisees } = await saveCourseCiblee(payload, {
        anciennesDistances: existante ? existante.distances : undefined,
      });
      feedback.appendChild(alert('ok', 'Enregistré.'));
      if (distancesReinitialisees > 0) {
        feedback.appendChild(alert('warn',
          `${distancesReinitialisees} réponse${distancesReinitialisees > 1 ? 's avaient' : ' avait'} une distance retirée. ` +
          `Leur choix a été effacé — les adhérents devront re-choisir.`));
      }
      if (!id) location.hash = '#/admin/courses/' + encodeURIComponent(saved.id);
    } catch (err) {
      feedback.appendChild(alert('err', err.message));
    }
  });

  root.appendChild(form);
}

// ----- petits helpers UI locaux -----

function section(title, body) {
  return el('section.card.admin-section', {}, [
    el('h2', {}, title),
    body,
  ]);
}

function field(label, input) {
  return el('div.field', {}, [ el('label', {}, label), input ]);
}

function input(name, value, opts = {}) {
  return el('input', { name, type: opts.type || 'text', value: value || '', placeholder: opts.placeholder || '', ...(opts.required ? { required: true } : {}) });
}

function textarea(name, value, rows, placeholder) {
  return el('textarea', { name, rows, placeholder: placeholder || '' }, value || '');
}

function selectField(name, current, options) {
  const s = el('select', { name });
  for (const [v, lbl] of options) {
    const opt = el('option', { value: v }, lbl);
    if (v === current) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

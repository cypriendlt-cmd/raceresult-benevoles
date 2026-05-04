/** Vue admin — création / édition / suppression d'un sondage "Vie du club". */

import { el, alert } from '../components/helpers.js';
import { isAdmin } from '../../auth/session.js';
import { get, save, remove, parseOptions } from '../../store/clubPolls.js';

const STATUT_LABELS = {
  brouillon: 'Brouillon',
  publiee:   'Publié',
  cloturee:  'Clôturé',
  archivee:  'Archivé',
};
const TYPE_LABELS = {
  unique: 'Choix unique (un seul)',
  multi:  'Choix multiple (plusieurs possibles)',
};

export default async function renderAdminClubPollEdit(root, params) {
  if (!isAdmin()) { location.hash = '#/admin'; return; }

  const id = params[0] ? decodeURIComponent(params[0]) : null;
  const existant = id ? await get(id) : null;
  const sondage = existant || {
    statut: 'brouillon',
    type_reponse: 'unique',
    afficher_participants: 'oui',
    autoriser_modif_reponse: 'oui',
  };

  root.appendChild(el('div.admin-topbar', {}, [
    el('a.btn.btn-ghost', { href: '#/admin/club-polls' }, '← Retour'),
    ...(id ? [
      el('a.btn', { href: '#/club-polls/' + encodeURIComponent(id) }, 'Voir côté adhérent'),
      el('a.btn', { href: '#/admin/club-poll/' + encodeURIComponent(id) }, 'Voir les réponses'),
    ] : []),
  ]));

  root.appendChild(el('h1', {}, id ? 'Modifier le sondage' : 'Nouveau sondage vie du club'));
  root.appendChild(el('p.muted', {}, id ? sondage.titre : "Renseigne les infos puis publie quand tu es prêt."));

  const form = el('form.admin-form');

  // Section 1 — Infos
  form.appendChild(section('Sondage', el('div.form-grid', {}, [
    field('Titre', input('titre', sondage.titre, { required: true, placeholder: "Ex : Aide montage course du 15 juin" })),
    field('Date de début (optionnel)', input('date_debut', sondage.date_debut, { type: 'date' })),
    field('Date de fin (optionnel)', input('date_fin', sondage.date_fin, { type: 'date' })),
    field('Date limite de réponse', input('date_limite_reponse', sondage.date_limite_reponse, { type: 'date' })),
  ])));

  // Section 2 — Description
  form.appendChild(section('Description', field('Texte libre',
    textarea('description', sondage.description, 4, 'Contexte, lieu, horaires, à savoir…')
  )));

  // Section 3 — Type + options
  const typeSelect = selectField('type_reponse', sondage.type_reponse, Object.entries(TYPE_LABELS));
  const optionsList = el('div.options-list');
  const initialOpts = parseOptions(sondage.options);
  if (!initialOpts.length) { initialOpts.push('', ''); }
  initialOpts.forEach(o => optionsList.appendChild(optionRow(o)));

  const addBtn = el('button.btn.btn-ghost', { type: 'button' }, '+ Ajouter une option');
  addBtn.addEventListener('click', () => optionsList.appendChild(optionRow('')));

  form.appendChild(section('Options de réponse', el('div', {}, [
    el('div.form-grid', {}, [ field('Type', typeSelect) ]),
    el('p.muted', { style: 'margin: 12px 0 8px' }, "Liste des choix proposés aux adhérents (au moins 2). Exemples : 'Oui, je serai là', 'Samedi 9h', 'Je peux aider au montage'."),
    optionsList,
    addBtn,
  ])));

  // Section 4 — Paramètres
  form.appendChild(section('Paramètres', el('div.form-grid', {}, [
    field('Statut', selectField('statut', sondage.statut, Object.entries(STATUT_LABELS))),
    field('Afficher les participants', selectField('afficher_participants', sondage.afficher_participants, [['oui','Oui'],['non','Non']])),
    field('Autoriser la modification de réponse', selectField('autoriser_modif_reponse', sondage.autoriser_modif_reponse, [['oui','Oui'],['non','Non']])),
  ])));

  const actions = el('div.admin-actions', {}, [
    el('button.btn.btn-primary', { type: 'submit' }, id ? 'Enregistrer' : 'Créer le sondage'),
  ]);
  if (id) {
    const btnDel = el('button.btn.btn-danger', { type: 'button' }, 'Supprimer');
    btnDel.addEventListener('click', async () => {
      if (!confirm('Supprimer ce sondage ET toutes les réponses associées ?')) return;
      btnDel.disabled = true;
      btnDel.textContent = 'Suppression…';
      try {
        await remove(id);
        location.hash = '#/admin/club-polls';
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
    const opts = Array.from(form.querySelectorAll('.option-input'))
      .map(i => i.value.trim())
      .filter(Boolean);
    const payload = { ...(existant || {}) };
    ['titre', 'description', 'date_debut', 'date_fin', 'date_limite_reponse']
      .forEach(k => payload[k] = (fd.get(k) || '').trim());
    payload.type_reponse = fd.get('type_reponse');
    payload.statut = fd.get('statut');
    payload.afficher_participants = fd.get('afficher_participants');
    payload.autoriser_modif_reponse = fd.get('autoriser_modif_reponse');
    payload.options = opts.join('|');
    try {
      const { sondage: saved, optionsReinitialisees } = await save(payload, {
        anciennesOptions: existant ? existant.options : undefined,
      });
      feedback.appendChild(alert('ok', 'Enregistré.'));
      if (optionsReinitialisees > 0) {
        feedback.appendChild(alert('warn',
          `${optionsReinitialisees} réponse${optionsReinitialisees > 1 ? 's avaient' : ' avait'} une option retirée. ` +
          `Les choix obsolètes ont été nettoyés.`));
      }
      if (!id) location.hash = '#/admin/club-polls/' + encodeURIComponent(saved.id);
    } catch (err) {
      feedback.appendChild(alert('err', err.message));
    }
  });

  root.appendChild(form);
}

function optionRow(value) {
  const inp = el('input.option-input', { type: 'text', value: value || '', placeholder: 'Ex : Samedi 9h' });
  const del = el('button.btn.btn-ghost', { type: 'button', title: 'Retirer' }, '✕');
  const row = el('div.option-row', {}, [ inp, del ]);
  del.addEventListener('click', () => row.remove());
  return row;
}

// helpers UI partagés (copie locale légère pour rester autonome)
function section(title, body) {
  return el('section.card.admin-section', {}, [ el('h2', {}, title), body ]);
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

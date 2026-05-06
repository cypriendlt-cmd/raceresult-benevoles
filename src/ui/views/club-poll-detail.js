/** Vue adhérent — détail d'un sondage "Vie du club" + formulaire. */

import { el, spinner, alert } from '../components/helpers.js';
import {
  get, listReponsesPourSondage, compterReponses, saveReponse, parseOptions, nbPersonnes,
} from '../../store/clubPolls.js';
import { read } from '../../store/index.js';
import { formatDate, isPast } from '../../utils/date.js';
import { normaliser } from '../../utils/text.js';

export default async function renderClubPollDetail(root, params) {
  const id = decodeURIComponent(params[0] || '');
  await render(root, id);
}

async function render(root, id) {
  root.innerHTML = '';
  root.appendChild(el('p', {}, el('a', { href: '#/sondages' }, '← Tous les sondages')));
  const loader = spinner();
  root.appendChild(loader);

  try {
    const [sondage, reponses, adherents] = await Promise.all([
      get(id),
      listReponsesPourSondage(id),
      read.adherents().catch(() => []),
    ]);
    loader.remove();
    if (!sondage) { root.appendChild(alert('err', 'Sondage introuvable.')); return; }

    const options = parseOptions(sondage.options);

    // En-tête
    const periode = [sondage.date_debut, sondage.date_fin].filter(Boolean)
      .map(d => formatDate(d)).join(' → ');
    const header = el('div.card.card-feature', {}, [
      el('span.rule-eyebrow', {}, 'Vie du club'),
      el('h1', { style: 'margin-top:12px' }, sondage.titre),
      periode ? el('p.muted', {}, periode) : null,
      sondage.description ? el('p', {}, sondage.description) : null,
    ]);
    root.appendChild(header);

    // Compteurs : N réponses · M personnes
    const totalPersonnes = reponses.reduce((s, r) => s + nbPersonnes(r), 0);
    root.appendChild(renderTotaux(reponses.length, totalPersonnes));

    // Gates écriture
    const closed = sondage.statut === 'cloturee';
    const archived = sondage.statut === 'archivee';
    const draft = sondage.statut === 'brouillon';
    const deadlinePast = isPast(sondage.date_limite_reponse);

    if (archived) {
      root.appendChild(alert('warn', 'Sondage archivé. Les réponses ne sont plus modifiables.'));
    } else if (closed) {
      root.appendChild(alert('warn', 'Sondage clôturé. Merci à celles et ceux qui ont répondu.'));
    } else if (deadlinePast) {
      root.appendChild(alert('warn', `La date limite de réponse est passée (${formatDate(sondage.date_limite_reponse)}).`));
    } else if (draft) {
      root.appendChild(alert('info', 'Sondage en brouillon — visible aux admins uniquement.'));
    }

    const lectureSeule = closed || archived || deadlinePast;
    if (!lectureSeule) {
      root.appendChild(renderFormulaire({ sondage, options, adherents, reponses, onSaved: () => render(root, id) }));
    }

    // Résultats par option (toujours visible si afficher_participants !== 'non')
    if (sondage.afficher_participants !== 'non' && reponses.length) {
      root.appendChild(renderResultats(reponses, options));
    }
  } catch (err) {
    loader.remove();
    root.appendChild(alert('err', err.message));
  }
}

function renderFormulaire({ sondage, options, adherents, reponses, onSaved }) {
  const card = el('div.card', {}, [ el('h2', {}, 'Ta réponse') ]);
  const form = el('form.sondage-form');
  const multi = sondage.type_reponse === 'multi';

  // Datalist adhérents
  const datalistId = 'dl-club-' + sondage.id;
  const datalist = el('datalist', { id: datalistId });
  adherents.forEach(a => {
    if (!a.prenom || !a.nom) return;
    datalist.appendChild(el('option', { value: `${a.prenom} ${a.nom}` }));
  });

  const inputIdentite = el('input', {
    name: 'identite',
    list: datalistId,
    required: true,
    autocomplete: 'off',
    placeholder: 'Ex : Jean Dupont',
  });
  const banner = el('div.prefill-banner', { style: 'display:none' });
  form.appendChild(datalist);
  form.appendChild(el('div.field', {}, [
    el('label', {}, 'Ton nom'),
    el('p.muted', { style: 'margin: 0 0 6px; font-size: 12px;' },
      'Choisis ton nom dans la liste, ou écris librement (ex : "Nom + 1").'),
    inputIdentite,
    banner,
  ]));

  // Choix d'options
  const choices = el('div.club-poll-choices');
  options.forEach((o, i) => {
    const inputId = 'opt-' + sondage.id + '-' + i;
    choices.appendChild(el('label', { for: inputId, class: 'club-poll-choice' }, [
      el('input', {
        type: multi ? 'checkbox' : 'radio',
        name: multi ? 'options_choisies[]' : 'options_choisies',
        value: o,
        id: inputId,
        ...(multi ? {} : { required: true }),
      }),
      el('span.club-poll-choice-label', {}, o),
    ]));
  });
  form.appendChild(el('div.field', {}, [
    el('label', {}, multi ? 'Coche tout ce qui s\'applique' : 'Choisis une option'),
    choices,
  ]));

  // Préremplissage
  inputIdentite.addEventListener('change', () => {
    const identite = inputIdentite.value.trim();
    if (!identite) { banner.style.display = 'none'; return; }
    const { prenom, nom, adherent_id } = resolveIdentite(identite, adherents);
    const existing = trouverDansReponses(reponses, { prenom, nom, adherent_id });
    if (!existing) { banner.style.display = 'none'; return; }
    // Reset puis pré-coche
    form.querySelectorAll('input[name^="options_choisies"]').forEach(i => { i.checked = false; });
    parseOptions(existing.options_choisies).forEach(o => {
      const inp = form.querySelector(`input[name^="options_choisies"][value="${CSS.escape(o)}"]`);
      if (inp) inp.checked = true;
    });
    const when = (existing.updated_at || existing.created_at || '').slice(0, 10);
    banner.textContent = when
      ? `Tu as déjà répondu le ${formatDate(when)} — tu peux modifier ci-dessous.`
      : 'Tu as déjà répondu — tu peux modifier ci-dessous.';
    banner.style.display = '';
  });

  const submitBtn = el('button.btn.btn-primary', { type: 'submit' }, 'Envoyer ma réponse');
  form.appendChild(submitBtn);
  const feedback = el('div.form-feedback');
  form.appendChild(feedback);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    feedback.innerHTML = '';
    const identite = inputIdentite.value.trim();
    if (!identite) return;

    const checked = Array.from(form.querySelectorAll('input[name^="options_choisies"]:checked'))
      .map(i => i.value);
    if (!checked.length) {
      feedback.appendChild(alert('warn', 'Choisis au moins une option.'));
      return;
    }

    const { prenom, nom, adherent_id } = resolveIdentite(identite, adherents);

    if (sondage.autoriser_modif_reponse === 'non' && aDejaRepondu(reponses, { prenom, nom, adherent_id })) {
      feedback.appendChild(alert('warn', "Tu as déjà répondu. L'organisateur n'autorise pas la modification."));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi…';
    try {
      await saveReponse({
        sondage_id: sondage.id,
        adherent_id, prenom, nom,
        options_choisies: checked,
      });
      onSaved();
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer ma réponse';
      feedback.appendChild(alert('err', err.message));
    }
  });

  card.appendChild(form);
  return card;
}

function renderTotaux(nbReponses, nbPersonnes) {
  return el('div.card.club-poll-totaux', {}, [
    el('div.totaux-item', {}, [
      el('div.val', {}, String(nbReponses)),
      el('div.lbl', {}, nbReponses <= 1 ? 'réponse' : 'réponses'),
    ]),
    el('div.totaux-item', {}, [
      el('div.val', {}, String(nbPersonnes)),
      el('div.lbl', {}, nbPersonnes <= 1 ? 'personne' : 'personnes'),
    ]),
  ]);
}

function renderResultats(reponses, options) {
  const cnt = compterReponses(reponses, options);

  // Pour chaque option : la liste des répondants (avec leur "+N" éventuel)
  const buckets = {};
  options.forEach(o => buckets[o] = []);
  reponses.forEach(r => {
    const display = [r.prenom, r.nom].filter(Boolean).join(' ').trim() || '(anonyme)';
    parseOptions(r.options_choisies).forEach(o => {
      if (buckets[o]) buckets[o].push(display);
    });
  });

  // Max pour la barre de proportion : on cale sur l'option la plus peuplée
  const maxPersonnes = Math.max(1, ...options.map(o => cnt['personnes_' + o] || 0));

  const list = el('div.club-poll-options-blocks');
  options.forEach(o => {
    const nbRep = cnt['reponses_' + o] || 0;
    const nbPers = cnt['personnes_' + o] || 0;
    const pct = Math.round((nbPers / maxPersonnes) * 100);
    const noms = buckets[o].slice().sort((a, b) => a.localeCompare(b));

    const head = el('div.club-poll-block-head', {}, [
      el('h3.club-poll-block-title', {}, o),
      el('span.club-poll-block-count', {}, [
        el('strong', {}, String(nbPers)),
        ` ${nbPers <= 1 ? 'personne' : 'personnes'}`,
        nbPers !== nbRep ? el('span.muted', { style: 'margin-left:6px; font-size:12px' }, `(${nbRep} ${nbRep <= 1 ? 'réponse' : 'réponses'})`) : null,
      ]),
    ]);

    const bar = el('div.club-poll-result-bar', {}, [
      el('div.club-poll-result-fill', { style: `width:${pct}%` }),
    ]);

    let body;
    if (!noms.length) {
      body = el('p.muted.club-poll-block-empty', {}, 'Personne pour l\'instant.');
    } else {
      body = el('ul.club-poll-people');
      noms.forEach(n => body.appendChild(el('li', {}, n)));
    }

    list.appendChild(el('div.card.club-poll-block', {}, [head, bar, body]));
  });

  return el('div', {}, [
    el('h2', { style: 'margin-top: var(--sp-5)' }, 'Qui a répondu quoi'),
    list,
  ]);
}

// Identité libre pour les sondages vie du club : si le texte matche un adhérent
// (prenom + nom normalisés), on attache l'adherent_id ; sinon on stocke le texte
// tel quel dans `nom` (prenom vide) — autorise "DELATTRE + 1", "Marie & Paul", etc.
function resolveIdentite(identite, adherents) {
  const cible = normaliser(identite);
  const match = adherents.find(a => normaliser(`${a.prenom} ${a.nom}`) === cible);
  if (match) return { prenom: match.prenom, nom: match.nom, adherent_id: match.id };
  return { prenom: '', nom: identite.trim(), adherent_id: '' };
}

function aDejaRepondu(reponses, identite) {
  return !!trouverDansReponses(reponses, identite);
}

function trouverDansReponses(reponses, { prenom, nom, adherent_id }) {
  if (adherent_id) {
    const hit = reponses.find(r => r.adherent_id === adherent_id);
    if (hit) return hit;
  }
  const pn = normaliser(prenom), nn = normaliser(nom);
  return reponses.find(r => normaliser(r.prenom) === pn && normaliser(r.nom) === nn) || null;
}

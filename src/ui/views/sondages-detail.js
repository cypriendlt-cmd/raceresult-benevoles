/** Vue adhérent — détail d'une course ciblée + formulaire de réponse. */

import { el, spinner, alert } from '../components/helpers.js';
import {
  getCourseCiblee, listReponsesPourCourse, compterReponses, saveReponse, parseDistances
} from '../../store/sondages.js';
import { read } from '../../store/index.js';
import { formatDate, isPast } from '../../utils/date.js';
import { normaliser } from '../../utils/text.js';

export default async function renderSondagesDetail(root, params) {
  const id = decodeURIComponent(params[0] || '');
  await render(root, id);
}

async function render(root, id) {
  root.innerHTML = '';
  root.appendChild(el('p', {}, el('a', { href: '#/sondages' }, '← Toutes les courses')));
  const loader = spinner();
  root.appendChild(loader);

  try {
    const [course, reponses, adherents] = await Promise.all([
      getCourseCiblee(id),
      listReponsesPourCourse(id),
      read.adherents().catch(() => []),
    ]);
    loader.remove();
    if (!course) { root.appendChild(alert('err', 'Course introuvable.')); return; }

    // En-tête
    const meta = [formatDate(course.date), course.lieu, course.distances].filter(Boolean).join(' · ');
    const header = el('div.card.card-feature', {}, [
      el('span.rule-eyebrow', {}, 'Course ciblée'),
      el('h1', { style: 'margin-top:12px' }, course.nom),
      meta ? el('p.muted', {}, meta) : null,
      course.description ? el('p', {}, course.description) : null,
      el('div.row', { style: 'margin-top:12px' }, [
        course.url_officielle ? el('a.btn', { href: course.url_officielle, target: '_blank', rel: 'noopener' }, 'Site officiel') : null,
        course.url_inscription ? el('a.btn.btn-accent', { href: course.url_inscription, target: '_blank', rel: 'noopener' }, "S'inscrire") : null,
      ]),
    ]);
    root.appendChild(header);

    // Compteurs
    const c = compterReponses(reponses);
    root.appendChild(renderCompteurs(c));

    // Gates écriture
    const closed = course.statut === 'cloturee';
    const archived = course.statut === 'archivee';
    const draft = course.statut === 'brouillon';
    const deadlinePast = isPast(course.date_limite_reponse);

    if (archived) {
      root.appendChild(alert('warn', 'Cette course est archivée. Les réponses ne sont plus modifiables.'));
    } else if (closed) {
      root.appendChild(alert('warn', 'Le sondage est clôturé. Merci à celles et ceux qui ont répondu.'));
    } else if (deadlinePast) {
      root.appendChild(alert('warn', `La date limite de réponse est passée (${formatDate(course.date_limite_reponse)}).`));
    } else if (draft) {
      root.appendChild(alert('info', 'Cette course est en brouillon — visible aux admins uniquement.'));
    }

    const lectureSeule = closed || archived || deadlinePast;
    if (!lectureSeule) {
      root.appendChild(renderFormulaire({ course, adherents, reponses, onSaved: () => render(root, id) }));
    }

    // Liste participants
    if (course.afficher_participants !== 'non' && reponses.length) {
      root.appendChild(renderParticipants(reponses));
    }
  } catch (err) {
    loader.remove();
    root.appendChild(alert('err', err.message));
  }
}

function renderCompteurs(c) {
  return el('div.card.sondage-totaux', {}, [
    el('div.totaux-item.totaux-oui',  {}, [ el('div.val', {}, String(c.oui)),       el('div.lbl', {}, 'oui') ]),
    el('div.totaux-item.totaux-peut', {}, [ el('div.val', {}, String(c.peut_etre)), el('div.lbl', {}, 'peut-être') ]),
    el('div.totaux-item.totaux-non',  {}, [ el('div.val', {}, String(c.non)),       el('div.lbl', {}, 'non') ]),
  ]);
}

function renderFormulaire({ course, adherents, reponses, onSaved }) {
  const card = el('div.card', {}, [ el('h2', {}, 'Ta réponse') ]);
  const form = el('form.sondage-form');
  const distances = parseDistances(course.distances);
  const distanceRequise = distances.length >= 2;

  // Champ identité avec datalist (suggestions adhérents). Matching effectif au submit.
  const datalistId = 'dl-adherents-' + course.id;
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
    el('label', {}, 'Ton nom (prénom puis nom)'),
    inputIdentite,
    banner,
  ]));

  // Préremplissage : quand l'utilisateur a fini de taper / choisi dans la datalist,
  // on cherche une réponse existante et on pré-coche.
  inputIdentite.addEventListener('change', () => {
    const identite = inputIdentite.value.trim();
    if (!identite) { banner.style.display = 'none'; return; }
    const { prenom, nom, adherent_id } = resolveIdentite(identite, adherents);
    const existing = trouverDansReponses(reponses, { prenom, nom, adherent_id });
    if (!existing) { banner.style.display = 'none'; return; }

    const radio = form.querySelector(`input[name="reponse"][value="${existing.reponse}"]`);
    if (radio) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (existing.distance_choisie) {
      const drad = form.querySelector(
        `input[name="distance_choisie"][value="${CSS.escape(existing.distance_choisie)}"]`
      );
      if (drad) drad.checked = true;
    }
    const when = (existing.updated_at || existing.created_at || '').slice(0, 10);
    banner.textContent = when
      ? `Tu as déjà répondu le ${formatDate(when)} — tu peux modifier ci-dessous.`
      : 'Tu as déjà répondu — tu peux modifier ci-dessous.';
    banner.style.display = '';
  });

  // Radios segmented
  const radios = el('div.reponse-choices');
  for (const { v, lbl, cls } of [
    { v: 'oui',       lbl: 'Je participe',    cls: 'choice-oui' },
    { v: 'peut_etre', lbl: 'Peut-être',       cls: 'choice-peut' },
    { v: 'non',       lbl: 'Je ne peux pas',  cls: 'choice-non' },
  ]) {
    const id = 'rep-' + course.id + '-' + v;
    radios.appendChild(el('input', { type: 'radio', name: 'reponse', value: v, id, required: true }));
    radios.appendChild(el('label', { for: id, class: 'reponse-choice ' + cls }, lbl));
  }
  form.appendChild(radios);

  // Distance (si plusieurs distances proposées) — affichée seulement si "oui"
  let distanceWrap = null;
  if (distanceRequise) {
    distanceWrap = el('div.field.distance-field', { style: 'display:none' }, [
      el('label', {}, 'Quelle distance ?'),
      renderDistanceChoices(course.id, distances),
    ]);
    form.appendChild(distanceWrap);
    form.addEventListener('change', (ev) => {
      if (ev.target.name === 'reponse') {
        distanceWrap.style.display = ev.target.value === 'oui' ? '' : 'none';
      }
    });
  }

  const submitBtn = el('button.btn.btn-primary', { type: 'submit' }, 'Envoyer ma réponse');
  form.appendChild(submitBtn);
  const feedback = el('div.form-feedback');
  form.appendChild(feedback);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    feedback.innerHTML = '';
    const fd = new FormData(form);
    const identite = (fd.get('identite') || '').trim();
    const reponse  = fd.get('reponse');
    if (!identite || !reponse) return;

    let distance_choisie = '';
    if (reponse === 'oui') {
      if (distances.length === 1) distance_choisie = distances[0];
      else if (distanceRequise) {
        distance_choisie = (fd.get('distance_choisie') || '').trim();
        if (!distance_choisie) {
          feedback.appendChild(alert('warn', 'Indique quelle distance tu choisis.'));
          return;
        }
      }
    }

    const { prenom, nom, adherent_id } = resolveIdentite(identite, adherents);

    if (course.autoriser_modif_reponse === 'non' && aDejaRepondu(reponses, { prenom, nom, adherent_id })) {
      feedback.appendChild(alert('warn', 'Tu as déjà répondu. L\'organisateur n\'autorise pas la modification.'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi…';
    try {
      await saveReponse({
        course_ciblee_id: course.id,
        adherent_id, prenom, nom, reponse, distance_choisie,
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

function renderDistanceChoices(courseId, distances) {
  const wrap = el('div.distance-choices');
  distances.forEach((d, i) => {
    const id = 'dist-' + courseId + '-' + i;
    wrap.appendChild(el('input', { type: 'radio', name: 'distance_choisie', value: d, id }));
    wrap.appendChild(el('label', { for: id, class: 'distance-choice' }, d));
  });
  return wrap;
}

function renderParticipants(reponses) {
  const buckets = { oui: [], peut_etre: [], non: [] };
  reponses.forEach(r => { if (buckets[r.reponse]) buckets[r.reponse].push(r); });
  const cols = el('div.participants-cols');
  for (const { k, lbl, cls } of [
    { k: 'oui',       lbl: 'Participent',  cls: 'col-oui' },
    { k: 'peut_etre', lbl: 'Peut-être',    cls: 'col-peut' },
    { k: 'non',       lbl: 'Ne peuvent pas', cls: 'col-non' },
  ]) {
    const list = el('ul');
    buckets[k]
      .slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || ''))
      .forEach(r => {
        const suffix = (k === 'oui' && r.distance_choisie) ? ` · ${r.distance_choisie}` : '';
        list.appendChild(el('li', {}, `${r.prenom} ${r.nom}${suffix}`));
      });
    cols.appendChild(el('div.participants-col ' + cls, {}, [
      el('h3', {}, `${lbl} (${buckets[k].length})`),
      buckets[k].length ? list : el('p.muted', {}, 'Personne pour l\'instant.'),
    ]));
  }
  return el('div.card', {}, [ el('h2', {}, 'Qui a répondu'), cols ]);
}

function resolveIdentite(identite, adherents) {
  const cible = normaliser(identite);
  const match = adherents.find(a => normaliser(`${a.prenom} ${a.nom}`) === cible);
  if (match) return { prenom: match.prenom, nom: match.nom, adherent_id: match.id };
  const parts = identite.trim().split(/\s+/);
  return { prenom: parts[0] || '', nom: parts.slice(1).join(' ') || '', adherent_id: '' };
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


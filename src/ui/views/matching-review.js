/** Vue 6 — Correspondances à valider (résultats ambigus). */

import { el, badge, alert as uiAlert, spinner, escape } from '../components/helpers.js';
import { read, saveOverride, sendBatch, op, invalidateAll } from '../../store/index.js';
import { SHEETS } from '../../config.js';
import { normaliser } from '../../utils/text.js';

export default async function renderMatchingReview(root) {
  root.appendChild(el('h1', {}, 'Correspondances à valider'));
  const zone = el('div', {}, el('div.card', {}, el('p', {}, [spinner(), ' Chargement…'])));
  root.appendChild(zone);

  try {
    const [resultats, adherents, courses] = await Promise.all([
      read.resultats(), read.adherents(), read.courses()
    ]);
    const adherentsById = new Map(adherents.map(a => [a.id, a]));
    const coursesById = new Map(courses.map(c => [c.id, c]));

    // On cible : status ambigu (doute homonymie) + absent persistés explicitement (volonté user)
    const ambigus = resultats.filter(r => r.match_status === 'ambigu');

    zone.replaceChildren();
    if (!ambigus.length) {
      zone.appendChild(el('div.card', {}, el('div.empty', {}, 'Rien à valider. Toutes les correspondances sont tranchées.')));
      return;
    }

    zone.appendChild(el('div.card', {}, [
      el('p.muted', {}, `${ambigus.length} ligne(s) à trancher. Une décision "match" crée un alias permanent (les prochains imports matcheront automatiquement). "Pas le bon" crée un refus.`),
    ]));

    ambigus.forEach(r => zone.appendChild(renderLigne(r, adherents, adherentsById, coursesById)));
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || String(e))));
  }
}

function renderLigne(r, adherents, adherentsById, coursesById) {
  const course = coursesById.get(r.course_id) || {};
  const card = el('div.card');

  card.appendChild(el('div.row', { style: 'justify-content: space-between;' }, [
    el('div', {}, [
      el('strong', {}, `${r.prenom_source} ${r.nom_source}`),
      el('span.muted', { style: 'margin-left: 8px;' }, `dans ${course.nom || '—'} (${course.date || ''})`),
    ]),
    badge('ambigu'),
  ]));

  // Candidats proposés (homonymes du nom)
  const nomCible = normaliser(r.nom_source);
  const candidats = adherents.filter(a => normaliser(a.nom) === nomCible);

  const listeRow = el('div', { style: 'margin-top: 12px; display: grid; gap: 6px;' });

  candidats.forEach(adh => {
    const row = el('div.row', { style: 'gap: 6px; align-items: center;' });
    row.appendChild(el('span', { style: 'flex: 1;' }, `${adh.prenom} ${adh.nom}` + (adh.sexe ? ` · ${adh.sexe}` : '')));
    row.appendChild(el('button.btn.btn-primary', {
      onclick: () => valider(r, adh, row)
    }, 'C\'est lui/elle'));
    row.appendChild(el('button.btn', {
      onclick: () => refuser(r, adh, row)
    }, 'Pas le bon'));
    listeRow.appendChild(row);
  });

  card.appendChild(listeRow);
  card.appendChild(el('div.row', { style: 'margin-top: 12px;' }, [
    el('button.btn.btn-ghost', {
      onclick: () => personne(r, card)
    }, 'Aucun — laisser absent')
  ]));
  return card;
}

async function valider(resultat, adherent, rowEl) {
  rowEl.appendChild(el('span.muted', {}, ' · enregistrement…'));
  try {
    // 1. Crée un alias (la prochaine fois, matching automatique)
    await saveOverride({
      type: 'alias',
      prenom_source: resultat.prenom_source,
      nom_source: resultat.nom_source,
      adherent_id: adherent.id,
      scope: 'global',
      note: `Validation manuelle depuis résultat ${resultat.id}`
    });
    // 2. Met à jour le résultat en base
    await sendBatch([op.update(SHEETS.RESULTATS, 'id', {
      ...resultat,
      match_status: 'manuel',
      match_score: 100,
      adherent_id: adherent.id,
    })]);
    invalidateAll();
    rowEl.replaceChildren(el('span', { style: 'color: var(--c-ok);' }, `✓ Validé — ${adherent.prenom} ${adherent.nom}`));
  } catch (e) {
    rowEl.replaceChildren(el('span', { style: 'color: var(--c-err);' }, '✗ Erreur : ' + (e.message || e)));
  }
}

async function refuser(resultat, adherent, rowEl) {
  rowEl.appendChild(el('span.muted', {}, ' · enregistrement…'));
  try {
    await saveOverride({
      type: 'refuse_match',
      prenom_source: resultat.prenom_source,
      nom_source: resultat.nom_source,
      adherent_id: adherent.id,
      scope: 'global',
      note: 'Refus manuel'
    });
    rowEl.replaceChildren(el('span', { style: 'color: var(--c-warn);' }, `✗ Refusé pour ${adherent.prenom} ${adherent.nom}`));
  } catch (e) {
    rowEl.replaceChildren(el('span', { style: 'color: var(--c-err);' }, 'Erreur : ' + (e.message || e)));
  }
}

async function personne(resultat, cardEl) {
  try {
    await sendBatch([op.update(SHEETS.RESULTATS, 'id', {
      ...resultat,
      match_status: 'absent',
      match_score: 0,
      adherent_id: '',
    })]);
    invalidateAll();
    cardEl.style.opacity = .5;
    cardEl.appendChild(el('div.muted', { style: 'margin-top: 8px;' }, 'Laissé absent.'));
  } catch (e) {
    cardEl.appendChild(el('div', { style: 'margin-top: 8px; color: var(--c-err);' }, 'Erreur : ' + (e.message || e)));
  }
}

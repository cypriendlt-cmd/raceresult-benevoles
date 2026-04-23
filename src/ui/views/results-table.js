/** Vue 3 — Tableau global des résultats avec filtres. */

import { el, badge, alert as uiAlert, spinner, escape, tempsAffiche, tempsSec } from '../components/helpers.js';
import { read } from '../../store/index.js';
import { navigate } from '../router.js';
import { trouverAdherent } from '../../matching/lookup.js';

const state = {
  filtreAdh: '',
  filtreCourse: '',
  filtreDistance: '',
  filtreDateMin: '',
  filtreDateMax: '',
  filtreStatut: '',
  triCol: 'date',
  triDesc: true,
};

export default async function renderResultsTable(root) {
  root.appendChild(el('h1', {}, 'Tableau des résultats'));
  const zone = el('div', {}, el('div.card', {}, el('p', {}, [spinner(), ' Chargement…'])));
  root.appendChild(zone);

  try {
    const [resultats, courses, adherents] = await Promise.all([
      read.resultats(), read.courses(), read.adherents()
    ]);
    const coursesById = new Map(courses.map(c => [c.id, c]));
    const adherentsById = new Map(adherents.map(a => [a.id, a]));

    zone.replaceChildren();
    zone.appendChild(renderFiltres(() => rafraichir()));
    const zoneTable = el('div');
    zone.appendChild(zoneTable);
    rafraichir();

    function rafraichir() {
      const filtres = filtrer(resultats, coursesById, adherentsById);
      const tries = trier(filtres, coursesById, adherentsById);
      zoneTable.replaceChildren(renderTable(tries, coursesById, adherentsById));
    }
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || String(e))));
  }
}

function renderFiltres(onChange) {
  const card = el('div.card');
  card.appendChild(el('h2', {}, 'Filtres'));
  const row = el('div.row');

  const mkInput = (key, label, type = 'text') => {
    const inp = el('input', { type, value: state[key] || '', placeholder: label, oninput: e => { state[key] = e.target.value; onChange(); } });
    return el('div.field', {}, [el('label', {}, label), inp]);
  };

  row.appendChild(mkInput('filtreAdh', 'Adhérent (prénom/nom)'));
  row.appendChild(mkInput('filtreCourse', 'Course (nom)'));
  row.appendChild(mkInput('filtreDistance', 'Distance (km)', 'number'));
  row.appendChild(mkInput('filtreDateMin', 'Depuis', 'date'));
  row.appendChild(mkInput('filtreDateMax', "Jusqu'à", 'date'));

  const selStatut = el('select', { onchange: e => { state.filtreStatut = e.target.value; onChange(); } },
    ['', 'certain', 'ambigu', 'absent', 'manuel'].map(v =>
      el('option', { value: v, selected: state.filtreStatut === v }, v || 'Tous statuts'))
  );
  row.appendChild(el('div.field', {}, [el('label', {}, 'Statut matching'), selStatut]));
  card.appendChild(row);
  return card;
}

function filtrer(resultats, coursesById, adherentsById) {
  const adherents = [...adherentsById.values()];
  return resultats.filter(r => {
    if (state.filtreStatut && r.match_status !== state.filtreStatut) return false;
    if (state.filtreAdh) {
      const adh = trouverAdherent(r, adherents, adherentsById);
      const label = (adh ? `${adh.prenom} ${adh.nom}` : `${r.prenom_source} ${r.nom_source}`).toLowerCase();
      if (!label.includes(state.filtreAdh.toLowerCase())) return false;
    }
    const course = coursesById.get(r.course_id);
    if (state.filtreCourse && course) {
      if (!(course.nom || '').toLowerCase().includes(state.filtreCourse.toLowerCase())) return false;
    }
    if (state.filtreDistance && course) {
      if (Math.abs((parseFloat(course.distance_km) || 0) - parseFloat(state.filtreDistance)) > 1) return false;
    }
    if (course) {
      if (state.filtreDateMin && (course.date || '') < state.filtreDateMin) return false;
      if (state.filtreDateMax && (course.date || '') > state.filtreDateMax) return false;
    }
    return true;
  });
}

function trier(list, coursesById) {
  const col = state.triCol, desc = state.triDesc;
  return list.slice().sort((a, b) => {
    let va, vb;
    if (col === 'date') { va = (coursesById.get(a.course_id) || {}).date || ''; vb = (coursesById.get(b.course_id) || {}).date || ''; }
    else if (col === 'temps') { va = tempsSec(a) ?? 99999999; vb = tempsSec(b) ?? 99999999; }
    else if (col === 'rang') { va = parseInt(a.rang_general) || 99999; vb = parseInt(b.rang_general) || 99999; }
    else { va = a[col] || ''; vb = b[col] || ''; }
    if (va < vb) return desc ? 1 : -1;
    if (va > vb) return desc ? -1 : 1;
    return 0;
  });
}

function renderTable(list, coursesById, adherentsById) {
  const card = el('div.card');
  card.appendChild(el('div.row', {}, [
    el('h2', { style: 'margin:0;' }, `${list.length} résultat${list.length > 1 ? 's' : ''}`),
  ]));

  if (!list.length) {
    card.appendChild(el('div.empty', {}, 'Aucun résultat pour ces filtres.'));
    return card;
  }

  const LIMIT = 500;
  const affichage = list.slice(0, LIMIT);

  const table = el('table.tbl');
  const mkTh = (label, col) => el('th', {
    style: 'cursor: pointer;',
    onclick: () => { if (state.triCol === col) state.triDesc = !state.triDesc; else { state.triCol = col; state.triDesc = true; } window.dispatchEvent(new HashChangeEvent('hashchange')); }
  }, label + (state.triCol === col ? (state.triDesc ? ' ↓' : ' ↑') : ''));

  table.appendChild(el('thead', {}, el('tr', {}, [
    mkTh('Date', 'date'),
    mkTh('Course', 'course_id'),
    el('th', {}, 'Distance'),
    el('th', {}, 'Adhérent'),
    mkTh('Temps net', 'temps'),
    mkTh('Rang', 'rang'),
    el('th', {}, 'Catégorie'),
    el('th', {}, 'Statut'),
  ])));

  const tbody = el('tbody');
  const adherents = [...adherentsById.values()];
  affichage.forEach(r => {
    const course = coursesById.get(r.course_id);
    const adh = trouverAdherent(r, adherents, adherentsById);
    const adhCell = adh
      ? el('a', { href: '#/membre/' + adh.id }, `${adh.prenom} ${adh.nom}`)
      : el('span.muted', {}, `${r.prenom_source} ${r.nom_source}`);
    tbody.appendChild(el('tr', {}, [
      el('td.mono', {}, (course && course.date) || ''),
      el('td', {}, course
        ? el('a', { href: '#/course/' + course.id }, course.nom || '—')
        : ''),
      el('td.num', {}, course && course.distance_km ? course.distance_km + ' km' : ''),
      el('td', {}, adhCell),
      el('td.num', { title: r.temps && r.temps !== r.temps_net ? 'Brut : ' + r.temps : '' }, tempsAffiche(r)),
      el('td.num', {}, String(r.rang_general || '')),
      el('td', {}, r.categorie || ''),
      el('td', {}, badge(r.match_status || 'absent')),
    ]));
  });
  table.appendChild(tbody);
  card.appendChild(table);
  if (list.length > LIMIT) {
    card.appendChild(el('div.empty', {}, `Affichage limité aux ${LIMIT} premiers résultats sur ${list.length}. Affine les filtres.`));
  }
  return card;
}

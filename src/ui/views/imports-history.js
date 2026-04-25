/** Vue 2 — Historique des imports. */

import { el, badge, alert as uiAlert, spinner, escape } from '../components/helpers.js';
import { read, deleteImport } from '../../store/index.js';
import { formatDate } from '../../utils/date.js';

export default async function renderImportsHistory(root) {
  root.appendChild(el('h1', {}, 'Historique des imports'));
  const card = el('div.card', {}, el('p', {}, [spinner(), ' Chargement…']));
  root.appendChild(card);

  try {
    const [imports, courses] = await Promise.all([read.imports(), read.courses()]);
    const coursesById = new Map(courses.map(c => [c.id, c]));
    card.replaceChildren();

    if (!imports.length) {
      card.appendChild(el('div.empty', {}, 'Aucun import enregistré pour le moment.'));
      return;
    }

    // Tri desc par date
    const sorted = imports.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const table = el('table.tbl.tbl-stack');
    table.appendChild(el('thead', {}, el('tr', {}, [
      el('th', {}, 'Date'),
      el('th', {}, 'Course'),
      el('th', {}, 'Source'),
      el('th', {}, 'Importées'),
      el('th', {}, 'Ignorées'),
      el('th', {}, 'À valider'),
      el('th', {}, 'Statut'),
      el('th', {}, 'Par'),
      el('th', {}, ''),
    ])));
    const tbody = el('tbody');
    sorted.forEach(imp => {
      const course = coursesById.get(imp.course_id);
      const tr = el('tr');
      tr.appendChild(el('td.mono', { 'data-label': 'Date' }, formatDate(imp.date, 'datetime')));
      tr.appendChild(el('td', { 'data-label': 'Course' }, course
        ? el('a', { href: '#/course/' + course.id }, course.nom || '—')
        : el('span.muted', {}, imp.course_id || '—')));
      tr.appendChild(el('td', { 'data-label': 'Source' }, el('span.muted', {}, imp.source || '')));
      tr.appendChild(el('td.num', { 'data-label': 'Importées' }, String(imp.lignes_importees || 0)));
      tr.appendChild(el('td.num', { 'data-label': 'Ignorées' }, String(imp.lignes_ignorees || 0)));
      tr.appendChild(el('td.num', { 'data-label': 'À valider' }, String(imp.lignes_douteuses || 0)));
      tr.appendChild(el('td', { 'data-label': 'Statut' }, badge(imp.status === 'success' ? 'certain' : imp.status === 'partial' ? 'ambigu' : 'absent')));
      tr.appendChild(el('td', { 'data-label': 'Par' }, el('span.muted', {}, imp.user || '—')));
      const btn = el('button.btn', {
        onclick: () => confirmerSuppression(imp, course, tr, btn)
      }, 'Supprimer');
      tr.appendChild(el('td', { 'data-label': '' }, btn));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    card.appendChild(el('div.tbl-wrap', {}, table));
  } catch (e) {
    card.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || String(e))));
  }
}

async function confirmerSuppression(imp, course, tr, btn) {
  const label = course ? `"${course.nom}"` : imp.id;
  const ok = confirm(
    `Supprimer cet import ?\n\nCourse : ${label}\nRésultats liés : ${imp.lignes_importees || 0}\n\n` +
    `Cette action est irréversible. Les résultats de cet import seront supprimés. ` +
    `Si aucun autre import ne référence cette course, la course sera supprimée aussi.`
  );
  if (!ok) return;
  btn.disabled = true;
  btn.textContent = 'Suppression…';
  try {
    const r = await deleteImport(imp);
    tr.style.opacity = .4;
    btn.textContent = r.deletedCourse ? 'Supprimé (+ course)' : 'Supprimé';
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Supprimer';
    alert('Erreur : ' + (e.message || e));
  }
}


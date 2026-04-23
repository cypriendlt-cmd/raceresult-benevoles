/** Vue — Détail d'une course : méta (éditables) + liste de tous les participants. */

import { el, badge, alert as uiAlert, spinner, escape, tempsAffiche } from '../components/helpers.js';
import { icon } from '../components/icons.js';
import { read, sendBatch, op, invalidateAll } from '../../store/index.js';
import { SHEETS } from '../../config.js';
import { trouverAdherent } from '../../matching/lookup.js';

export default async function renderCourse(root, params) {
  root.appendChild(el('h1', {}, 'Détail course'));
  const courseId = params && params[0];
  const zone = el('div', {}, el('div.card', {}, el('p', {}, [spinner(), ' Chargement…'])));
  root.appendChild(zone);

  if (!courseId) {
    zone.replaceChildren(uiAlert('err', 'ID de course manquant.'));
    return;
  }

  try {
    const [courses, resultats, adherents] = await Promise.all([
      read.courses(), read.resultats(), read.adherents()
    ]);
    zone.replaceChildren();

    const targetId = String(courseId).trim();
    const course = courses.find(c => String(c.id).trim() === targetId);
    if (!course) {
      zone.appendChild(uiAlert('err', 'Course introuvable : ' + courseId));
      return;
    }
    const adherentsById = new Map(adherents.map(a => [a.id, a]));
    const mesResultats = resultats
      .filter(r => String(r.course_id || '').trim() === targetId)
      .sort((a, b) => (parseInt(a.rang_general) || 99999) - (parseInt(b.rang_general) || 99999));

    // Diagnostic : si on lit 0 résultats alors que l'import dit en avoir, alerter.
    if (mesResultats.length === 0) {
      const others = new Set(resultats.map(r => String(r.course_id || '').trim()).filter(Boolean));
      console.warn('[Course detail] courseId demandé :', targetId, '— course_id distincts dans Resultats :', [...others]);
    }

    zone.appendChild(renderMeta(course, mesResultats.length));
    zone.appendChild(renderListe(mesResultats, adherentsById));
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur : ' + (e.message || String(e))));
  }
}

function renderMeta(course, nbResultats) {
  const card = el('div.card');
  let editing = false;

  render();
  return card;

  function render() {
    card.replaceChildren();
    if (editing) return renderEdit();
    renderView();
  }

  function renderView() {
    card.appendChild(el('div.row', { style: 'align-items: baseline;' }, [
      el('h2', { style: 'margin: 0;' }, course.nom || '—'),
      el('button.btn.btn-ghost', { style: 'margin-left: auto;', onclick: () => { editing = true; render(); } },
        [icon('pencil', { size: 15 }), 'Modifier']),
    ]));

    const metaItem = (ic, text) => el('span', { style: 'display:inline-flex; align-items:center; gap:6px;' }, [icon(ic, { size: 15 }), text]);
    const meta = [];
    if (course.date) meta.push(metaItem('calendar', escape(course.date)));
    if (course.lieu) meta.push(metaItem('map-pin', escape(course.lieu)));
    if (course.distance_km) meta.push(metaItem('ruler', course.distance_km + ' km'));
    if (course.type) meta.push(el('span.badge', {}, escape(course.type)));
    if (course.source) meta.push(el('span.muted', {}, 'source : ' + escape(course.source)));
    meta.push(metaItem('users', `${nbResultats} participant${nbResultats > 1 ? 's' : ''}`));
    card.appendChild(el('div.row', { style: 'color: var(--c-ink-40); gap: 20px; margin-top: 8px;' }, meta));
    if (course.url) {
      card.appendChild(el('div', { style: 'margin-top: 10px;' },
        el('a', { href: course.url, target: '_blank', rel: 'noopener', style: 'display: inline-flex; align-items: center; gap: 6px; font-size: 13px;' },
          [icon('external', { size: 14 }), 'Voir la source'])));
    }
  }

  function renderEdit() {
    const inputs = {};
    card.appendChild(el('h2', { style: 'margin: 0 0 12px 0;' }, 'Modifier la course'));

    const row1 = el('div.row');
    inputs.nom = el('input', { type: 'text', value: course.nom || '' });
    row1.appendChild(el('div.field', { style: 'flex: 2;' }, [el('label', {}, 'Nom'), inputs.nom]));
    inputs.date = el('input', { type: 'date', value: course.date || '' });
    row1.appendChild(el('div.field', {}, [el('label', {}, 'Date'), inputs.date]));
    inputs.distance_km = el('input', { type: 'number', step: '0.1', value: course.distance_km || '' });
    row1.appendChild(el('div.field', {}, [el('label', {}, 'Distance (km)'), inputs.distance_km]));
    card.appendChild(row1);

    const row2 = el('div.row');
    inputs.lieu = el('input', { type: 'text', value: course.lieu || '' });
    row2.appendChild(el('div.field', { style: 'flex: 1;' }, [el('label', {}, 'Lieu'), inputs.lieu]));
    inputs.type = el('select', {}, ['', 'marathon', 'semi', '10km', 'trail', '5km', 'autre']
      .map(v => el('option', { value: v, selected: course.type === v }, v || '—')));
    row2.appendChild(el('div.field', {}, [el('label', {}, 'Type'), inputs.type]));
    inputs.organisateur = el('input', { type: 'text', value: course.organisateur || '' });
    row2.appendChild(el('div.field', { style: 'flex: 1;' }, [el('label', {}, 'Organisateur'), inputs.organisateur]));
    card.appendChild(row2);

    const status = el('div');
    card.appendChild(status);

    card.appendChild(el('div.row', { style: 'margin-top: 8px;' }, [
      el('button.btn.btn-primary', { onclick: save }, 'Enregistrer'),
      el('button.btn.btn-ghost', { onclick: () => { editing = false; render(); } }, 'Annuler'),
    ]));

    async function save() {
      const updated = {
        ...course,
        nom: inputs.nom.value.trim() || course.nom,
        date: inputs.date.value || null,
        distance_km: inputs.distance_km.value ? parseFloat(inputs.distance_km.value) : null,
        lieu: inputs.lieu.value.trim() || null,
        type: inputs.type.value || null,
        organisateur: inputs.organisateur.value.trim() || null,
      };
      status.replaceChildren(uiAlert('info', el('span', {}, [spinner(), ' Enregistrement…'])));
      try {
        await sendBatch([op.update(SHEETS.COURSES, 'id', updated)]);
        invalidateAll();
        Object.assign(course, updated);
        editing = false;
        render();
      } catch (e) {
        status.replaceChildren(uiAlert('err', 'Erreur : ' + (e.message || e)));
      }
    }
  }
}

function renderListe(resultats, adherentsById) {
  const card = el('div.card');

  const adherents = [...adherentsById.values()];
  // Enrichit chaque résultat avec l'adhérent trouvé (fallback tokens inclus)
  const enriched = resultats.map(r => ({ r, adh: trouverAdherent(r, adherents, adherentsById) }));
  const adhs = enriched.filter(x => x.adh);
  const autres = enriched.filter(x => !x.adh);

  card.appendChild(el('div.row', {}, [
    el('h2', { style: 'margin: 0;' }, 'Participants'),
    el('span.muted', { style: 'margin-left: auto;' }, `${adhs.length} adhérent${adhs.length > 1 ? 's' : ''}${autres.length ? ` · ${autres.length} autre${autres.length > 1 ? 's' : ''}` : ''}`),
  ]));

  if (!resultats.length) {
    card.appendChild(el('div.empty', {}, 'Aucun participant enregistré.'));
    return card;
  }

  const tbl = el('table.tbl');
  tbl.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, 'Rang'),
    el('th', {}, 'Adhérent / Coureur'),
    el('th', { title: 'Temps net (chip time)' }, 'Temps net'),
    el('th', {}, 'Catégorie'),
    el('th', {}, 'Statut'),
  ])));

  const tbody = el('tbody');
  // Adhérents d'abord, puis autres
  [...adhs, ...autres].forEach(({ r, adh }) => {
    const cell = adh
      ? el('a', { href: '#/membre/' + adh.id }, `${adh.prenom} ${adh.nom}`)
      : el('span.muted', {}, `${r.prenom_source} ${r.nom_source}`);
    tbody.appendChild(el('tr', {}, [
      el('td.num', {}, String(r.rang_general || '')),
      el('td', {}, cell),
      el('td.num', { title: r.temps && r.temps !== r.temps_net ? 'Brut : ' + r.temps : '' }, tempsAffiche(r)),
      el('td', {}, r.categorie || ''),
      el('td', {}, badge(adh ? 'certain' : (r.match_status || 'absent'))),
    ]));
  });
  tbl.appendChild(tbody);
  card.appendChild(tbl);
  return card;
}

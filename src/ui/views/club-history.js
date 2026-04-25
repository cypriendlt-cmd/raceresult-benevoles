/** Vue 5 — Historique global du club : courses chronologiques. */

import { el, alert as uiAlert, spinner } from '../components/helpers.js';
import { read } from '../../store/index.js';
import { trouverAdherent } from '../../matching/lookup.js';

/** Extrait l'année depuis n'importe quel format usuel : ISO, DD/MM/YYYY, timestamp. */
function extraireAnnee(date) {
  if (!date) return '—';
  const s = String(date).trim();
  // ISO "2026-04-15..." ou "2026"
  const iso = s.match(/^(\d{4})/);
  if (iso) return iso[1];
  // FR "15/04/2026" ou "04/2026" ou "4-2026"
  const fr = s.match(/(\d{4})\s*$/);
  if (fr) return fr[1];
  return '—';
}

/** Comparateur de dates robuste pour tri (fallback sur string si parsing échoue). */
function compareDatesDesc(a, b) {
  const pa = parseAny(a);
  const pb = parseAny(b);
  if (pa && pb) return pb - pa;
  return String(b || '').localeCompare(String(a || ''));
}

function parseAny(s) {
  if (!s) return 0;
  const t = String(s).trim();
  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3]).getTime();
  const fr = t.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (fr) return new Date(+fr[3], +fr[2] - 1, +fr[1]).getTime();
  const y = t.match(/^(\d{4})$/);
  if (y) return new Date(+y[1], 0, 1).getTime();
  const d = Date.parse(t);
  return isNaN(d) ? 0 : d;
}

export default async function renderClubHistory(root) {
  root.appendChild(el('h1', {}, 'Historique du club'));
  const zone = el('div', {}, el('div.card', {}, el('p', {}, [spinner(), ' Chargement…'])));
  root.appendChild(zone);

  try {
    const [courses, resultats, adherents] = await Promise.all([
      read.courses(), read.resultats(), read.adherents()
    ]);
    zone.replaceChildren();

    if (!courses.length) {
      zone.appendChild(el('div.card', {}, el('div.empty', {}, 'Aucune course importée. Rendez-vous sur l\'onglet Import.')));
      return;
    }

    const adherentsById = new Map(adherents.map(a => [a.id, a]));
    // Map course_id → liste { r, adh } pour chaque résultat lié à un adhérent
    // (fallback tokens : Marie-Sophie ≡ Marie Sophie même si adherent_id vide)
    const participantsByCourse = new Map();
    resultats.forEach(r => {
      const adh = trouverAdherent(r, adherents, adherentsById);
      if (!adh) return;
      if (!participantsByCourse.has(r.course_id)) participantsByCourse.set(r.course_id, []);
      participantsByCourse.get(r.course_id).push({ r, adh });
    });

    // Tri desc par date (formats mixtes acceptés)
    const sorted = courses.slice().sort((a, b) => compareDatesDesc(a.date, b.date));

    // Regroupement par année (extraction robuste)
    const parAnnee = new Map();
    sorted.forEach(c => {
      const an = extraireAnnee(c.date);
      if (!parAnnee.has(an)) parAnnee.set(an, []);
      parAnnee.get(an).push(c);
    });
    // Tri des années desc, "—" à la fin
    const anneesOrdered = [...parAnnee.entries()].sort(([a], [b]) => {
      if (a === '—') return 1;
      if (b === '—') return -1;
      return b.localeCompare(a);
    });

    for (const [an, cs] of anneesOrdered) {
      const section = el('div.card');
      section.appendChild(el('h2', {}, `${an} — ${cs.length} course${cs.length > 1 ? 's' : ''}`));

      const tbl = el('table.tbl.tbl-stack');
      tbl.appendChild(el('thead', {}, el('tr', {}, [
        el('th', {}, 'Date'),
        el('th', {}, 'Course'),
        el('th', {}, 'Lieu'),
        el('th', {}, 'Distance'),
        el('th', {}, 'Participants du club'),
      ])));
      const tbody = el('tbody');
      cs.forEach(c => {
        const parts = participantsByCourse.get(c.id) || [];
        const partsLabel = parts.length
          ? parts.slice(0, 6).map(({ adh }) => `${adh.prenom} ${adh.nom}`).join(', ')
            + (parts.length > 6 ? ` + ${parts.length - 6} autres` : '')
          : '';
        tbody.appendChild(el('tr', {}, [
          el('td.mono', { 'data-label': 'Date' }, c.date || ''),
          el('td', { 'data-label': 'Course' }, el('a', { href: '#/course/' + c.id }, c.nom || '—')),
          el('td', { 'data-label': 'Lieu' }, c.lieu || ''),
          el('td.num', { 'data-label': 'Distance' }, c.distance_km ? c.distance_km + ' km' : ''),
          el('td', { 'data-label': 'Participants' }, el('span', {}, [
            el('strong', {}, String(parts.length)),
            parts.length ? el('span.muted', { style: 'margin-left: 8px;' }, partsLabel) : el('span.muted', { style: 'margin-left: 8px;' }, '—'),
          ])),
        ]));
      });
      tbl.appendChild(tbody);
      section.appendChild(el('div.tbl-wrap', {}, tbl));
      zone.appendChild(section);
    }
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || String(e))));
  }
}

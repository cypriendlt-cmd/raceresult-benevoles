/** Vue Dashboard — indicateurs clés, direction éditoriale sobre. */

import { el, alert as uiAlert, spinner, escape } from '../components/helpers.js';
import { icon } from '../components/icons.js';
import { logo } from '../components/logo.js';
import { read } from '../../store/index.js';
import { trouverAdherent } from '../../matching/lookup.js';

export default async function renderDashboard(root) {
  const zone = el('div');
  root.appendChild(zone);

  zone.appendChild(el('div.card', { style: 'border: 0; box-shadow: none; background: transparent; padding-left: 0; padding-right: 0;' }, [
    el('span.rule-eyebrow', {}, 'Tableau de bord'),
    el('h1', { style: 'margin-top: 10px;' }, 'Mémoire du club'),
    el('p.muted', { style: 'max-width: 56ch;' },
      'Vue d\'ensemble des participations, des adhérents et de l\'activité. '
      + 'Chaque course gardée en mémoire, une trace pour le club.')
  ]));

  const loading = el('div.card', {}, el('p', {}, [spinner(), ' Chargement…']));
  zone.appendChild(loading);

  try {
    const [adherents, courses, resultats, imports] = await Promise.all([
      read.adherents(), read.courses(), read.resultats(), read.imports()
    ]);
    zone.removeChild(loading);

    const adhById = new Map(adherents.map(a => [a.id, a]));
    const coursesById = new Map(courses.map(c => [c.id, c]));
    const enriched = resultats
      .map(r => ({ r, adh: trouverAdherent(r, adherents, adhById) }))
      .filter(x => x.adh);

    zone.appendChild(renderHero(adherents, courses, enriched, coursesById));
    zone.appendChild(renderActions(resultats));

    const row1 = el('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--sp-5);' });
    row1.appendChild(renderActiviteRecente(enriched, coursesById));
    row1.appendChild(renderParAnnee(enriched, coursesById));
    zone.appendChild(row1);

    const row2 = el('div', { style: 'display:grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: var(--sp-5);' });
    row2.appendChild(renderParDistance(enriched, coursesById));
    row2.appendChild(renderTopParticipations(enriched, coursesById));
    zone.appendChild(row2);

    zone.appendChild(renderInactifs(adherents, enriched));
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || e)));
  }
}

// =====================================================================
// Sections
// =====================================================================

function renderHero(adherents, courses, enriched, coursesById) {
  const actifs = adherents.filter(a => a.actif !== 'non').length;
  const coureursUniques = new Set(enriched.map(x => x.adh.id)).size;
  const distTotaleKm = Math.round(enriched.reduce((s, x) => {
    const c = coursesById.get(x.r.course_id);
    return s + (parseFloat(c?.distance_km) || 0);
  }, 0));

  const card = el('div.card.card-feature', { style: 'padding: var(--sp-6);' });
  card.appendChild(el('div.row', { style: 'align-items: flex-start; gap: var(--sp-5);' }, [
    logo({ size: 84 }),
    el('div', { style: 'flex:1; min-width: 0;' }, [
      el('span.rule-eyebrow', {}, 'Communauté'),
      el('h2', { style: 'margin-top: 10px; margin-bottom: 4px;' }, 'Ce que le club a couru ensemble'),
      el('p.muted', { style: 'margin: 0;' }, `${courses.length} course${courses.length > 1 ? 's' : ''} référencée${courses.length > 1 ? 's' : ''}, et ça compte.`),
    ]),
  ]));

  card.appendChild(el('hr.rule', { style: 'margin: var(--sp-5) 0 var(--sp-5);' }));

  const stats = el('div.hero-stats');
  [
    ['Adhérents actifs', actifs, 'inscrits au club'],
    ['Ont couru', `${coureursUniques}`, `${actifs ? Math.round(100 * coureursUniques / actifs) : 0} % du club`],
    ['Participations', enriched.length, 'enregistrées'],
    ['Courses', courses.length, 'dans la chronique'],
    ['Distance cumulée', distTotaleKm.toLocaleString('fr-FR') + ' km', 'parcourus ensemble'],
  ].forEach(([label, val, sub]) => {
    stats.appendChild(el('div.hero-stat', {}, [
      el('div.label', {}, label),
      el('div.value', {}, String(val)),
      sub ? el('div.sub', {}, sub) : null,
    ].filter(Boolean)));
  });
  card.appendChild(stats);
  return card;
}

function renderActions(resultats) {
  const ambigus = resultats.filter(r => r.match_status === 'ambigu').length;
  if (ambigus === 0) return el('div');
  const wrap = el('div.alert.alert-warn', { style: 'align-items: center;' });
  wrap.appendChild(icon('alert', { size: 20 }));
  wrap.appendChild(el('span', {}, [
    el('strong', {}, `${ambigus} correspondance${ambigus > 1 ? 's' : ''} à trancher. `),
    el('a', { href: '#/revue' }, 'Ouvrir la revue →'),
  ]));
  return wrap;
}

function renderActiviteRecente(enriched, coursesById) {
  const card = el('div.card');
  card.appendChild(sectionHeader('calendar', 'Dernières courses'));

  const byCourse = groupBy(enriched, x => x.r.course_id);
  const activite = [...byCourse.entries()]
    .map(([courseId, participants]) => ({ course: coursesById.get(courseId), n: participants.length }))
    .filter(x => x.course && x.course.date)
    .sort((a, b) => (b.course.date || '').localeCompare(a.course.date || ''))
    .slice(0, 5);

  if (!activite.length) {
    card.appendChild(el('div.empty', {}, 'Aucune course enregistrée pour le moment.'));
    return card;
  }

  const list = el('div');
  activite.forEach(({ course, n }, i) => {
    list.appendChild(el('div.row', { style: 'justify-content: space-between; padding: 10px 0;' + (i ? ' border-top: 1px solid var(--c-border);' : '') }, [
      el('div', { style: 'flex: 1; min-width: 0;' }, [
        el('a', { href: '#/course/' + course.id, style: 'font-weight: 500; color: var(--c-ink);' }, course.nom || '—'),
        el('div.muted', { style: 'font-size: 12px; margin-top: 2px;' },
          `${course.date || ''}${course.distance_km ? ' · ' + course.distance_km + ' km' : ''}${course.lieu ? ' · ' + course.lieu : ''}`),
      ]),
      el('div', { style: 'text-align: right; flex-shrink: 0; margin-left: 12px;' }, [
        el('div', { style: 'font-family: var(--font-serif); font-size: 22px; font-variation-settings: "SOFT" 50, "opsz" 22; color: var(--c-leaf-700); font-weight: 500;' }, String(n)),
        el('div.muted', { style: 'font-size: 11px; text-transform: uppercase; letter-spacing: .06em;' }, n > 1 ? 'adhérents' : 'adhérent'),
      ]),
    ]));
  });
  card.appendChild(list);
  return card;
}

function renderParAnnee(enriched, coursesById) {
  const card = el('div.card');
  card.appendChild(sectionHeader('trending-up', 'Participations par année'));

  const parAn = new Map();
  enriched.forEach(({ r }) => {
    const c = coursesById.get(r.course_id);
    const an = extraireAnnee(c?.date);
    parAn.set(an, (parAn.get(an) || 0) + 1);
  });
  const annees = [...parAn.entries()].filter(([k]) => k !== '—').sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  if (!annees.length) { card.appendChild(el('div.empty', {}, 'Pas assez de données.')); return card; }

  const max = Math.max(...annees.map(([, n]) => n));
  const bars = el('div.bars');
  annees.forEach(([an, n]) => {
    const pct = Math.max(4, Math.round((n / max) * 100));
    bars.appendChild(el('div.bar-col', {}, [
      el('div.count', {}, String(n)),
      el('div.bar-track', {}, el('div.bar', { title: `${an} : ${n} participations`, style: `height: ${pct}%;` })),
      el('div.year', {}, an),
    ]));
  });
  card.appendChild(bars);
  return card;
}

function renderParDistance(enriched, coursesById) {
  const card = el('div.card');
  card.appendChild(sectionHeader('ruler', 'Par distance'));

  const par = new Map();
  enriched.forEach(({ r }) => {
    const c = coursesById.get(r.course_id);
    const k = classerDistance(c?.distance_km);
    par.set(k, (par.get(k) || 0) + 1);
  });
  const ordre = ['5 km', '10 km', 'Semi', 'Marathon', 'Trail', 'Autre'];
  const stats = ordre.map(k => [k, par.get(k) || 0]).filter(([, n]) => n > 0);
  if (!stats.length) { card.appendChild(el('div.empty', {}, 'Pas de données.')); return card; }
  const total = stats.reduce((s, [, n]) => s + n, 0);

  const list = el('div', { style: 'display: grid; gap: 14px; margin-top: 8px;' });
  stats.forEach(([k, n]) => {
    const pct = Math.round(100 * n / total);
    list.appendChild(el('div', {}, [
      el('div.row', { style: 'justify-content: space-between; font-size: 13px; margin-bottom: 6px;' }, [
        el('span', { style: 'font-weight: 600;' }, k),
        el('span.muted', {}, `${n} · ${pct} %`),
      ]),
      el('div', { style: 'background: var(--c-border); border-radius: 3px; height: 8px; overflow: hidden;' },
        el('div', { style: `width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--c-blue), var(--c-blue-700)); border-radius: 3px; box-shadow: inset 0 -2px 0 var(--c-yellow);` })),
    ]));
  });
  card.appendChild(list);
  return card;
}

function renderTopParticipations(enriched, coursesById) {
  const card = el('div.card');
  card.appendChild(sectionHeader('activity', 'Régularité'));

  // Group par année puis par adhérent
  const parAnneeParAdh = new Map();  // annee → Map<adhId, { adh, n }>
  const adhById = new Map();
  enriched.forEach(({ r, adh }) => {
    const c = coursesById.get(r.course_id);
    const an = extraireAnnee(c?.date);
    if (!parAnneeParAdh.has(an)) parAnneeParAdh.set(an, new Map());
    const m = parAnneeParAdh.get(an);
    m.set(adh.id, { adh, n: (m.get(adh.id)?.n || 0) + 1 });
    adhById.set(adh.id, adh);
  });

  // Ajouter "tous temps"
  const cumul = new Map();
  enriched.forEach(({ adh }) => cumul.set(adh.id, { adh, n: (cumul.get(adh.id)?.n || 0) + 1 }));

  const annees = [...parAnneeParAdh.keys()].filter(k => k !== '—').sort().reverse();
  if (!annees.length && !cumul.size) {
    card.appendChild(el('div.empty', {}, 'Pas de données.'));
    return card;
  }

  // Sélection = année la + récente par défaut
  const options = ['Tous temps', ...annees];
  let selection = options[1] || options[0];  // année la + récente

  const tabs = el('div.row', { style: 'gap: 4px; margin-bottom: 14px; flex-wrap: wrap;' });
  const liste = el('div');
  const note = el('div.muted', { style: 'font-size: 12px; margin-bottom: 14px;' });

  function render() {
    tabs.replaceChildren();
    options.forEach(opt => {
      const actif = opt === selection;
      tabs.appendChild(el('button.btn' + (actif ? '.btn-primary' : ''), {
        style: 'padding: 4px 10px; font-size: 12px;',
        onclick: () => { selection = opt; render(); }
      }, opt));
    });

    const data = selection === 'Tous temps'
      ? [...cumul.values()]
      : [...(parAnneeParAdh.get(selection)?.values() || [])];

    data.sort((a, b) => b.n - a.n);
    const top = data.slice(0, 10);

    note.textContent = selection === 'Tous temps'
      ? 'Cumul toutes années · présence, pas performance.'
      : `Participations en ${selection} — top ${top.length} sur ${data.length} adhérent${data.length > 1 ? 's' : ''} actif${data.length > 1 ? 's' : ''}.`;

    liste.replaceChildren();
    if (!top.length) { liste.appendChild(el('div.empty', {}, 'Aucune participation cette année.')); return; }
    const max = top[0].n;
    top.forEach(({ adh, n }) => {
      const pct = Math.round(100 * n / max);
      liste.appendChild(el('div.progress-row', {}, [
        el('div', {}, [
          el('a', { href: '#/membre/' + adh.id, style: 'font-weight: 500; color: var(--c-ink);' }, `${adh.prenom} ${adh.nom}`),
          el('div.track', {}, el('div.fill', { style: `width: ${pct}%;` })),
        ]),
        el('strong.mono', { style: 'font-size: 15px; color: var(--c-blue-700);' }, String(n)),
      ]));
    });
  }
  render();

  card.appendChild(tabs);
  card.appendChild(note);
  card.appendChild(liste);
  return card;
}

function renderInactifs(adherents, enriched) {
  const card = el('div.card');
  card.appendChild(sectionHeader('moon', 'Adhérents sans course enregistrée'));

  const actifs = adherents.filter(a => a.actif !== 'non');
  const avecCourse = new Set(enriched.map(x => x.adh.id));
  const sansCourse = actifs.filter(a => !avecCourse.has(a.id));

  if (!sansCourse.length) {
    card.appendChild(el('div.empty', {}, 'Tous les adhérents actifs ont au moins une course enregistrée.'));
    return card;
  }

  card.appendChild(el('div.muted', { style: 'font-size: 13px; margin-bottom: 12px;' },
    `${sansCourse.length} adhérent${sansCourse.length > 1 ? 's' : ''} · peut-être un import manquant ou un nouvel inscrit.`));

  const list = el('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px; max-height: 200px; overflow: auto;' });
  sansCourse.slice(0, 80).sort((a, b) => `${a.nom}${a.prenom}`.localeCompare(`${b.nom}${b.prenom}`)).forEach(a => {
    list.appendChild(el('a.btn', { href: '#/membre/' + a.id, style: 'font-size: 13px; padding: 4px 10px;' }, `${a.prenom} ${a.nom}`));
  });
  if (sansCourse.length > 80) list.appendChild(el('span.muted', { style: 'padding: 4px 8px;' }, `+${sansCourse.length - 80}`));
  card.appendChild(list);
  return card;
}

// =====================================================================
// Helpers
// =====================================================================

function sectionHeader(iconName, title) {
  return el('div', { style: 'display: flex; align-items: center; gap: 10px; margin-bottom: var(--sp-4);' }, [
    el('span', { style: 'color: var(--c-leaf-700);' }, icon(iconName, { size: 20 })),
    el('h2', { style: 'margin: 0;' }, title),
  ]);
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

function extraireAnnee(date) {
  if (!date) return '—';
  const s = String(date).trim();
  const iso = s.match(/^(\d{4})/);
  if (iso) return iso[1];
  const fr = s.match(/(\d{4})\s*$/);
  if (fr) return fr[1];
  return '—';
}

function classerDistance(d) {
  const n = parseFloat(d);
  if (!Number.isFinite(n) || n <= 0) return 'Autre';
  if (Math.abs(n - 5) < 1) return '5 km';
  if (Math.abs(n - 10) < 1) return '10 km';
  if (Math.abs(n - 21.0975) < 1) return 'Semi';
  if (Math.abs(n - 42.195) < 1.5) return 'Marathon';
  if (n > 20) return 'Trail';
  return 'Autre';
}

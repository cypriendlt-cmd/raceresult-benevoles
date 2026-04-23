/** Vue 4 — Fiche adhérent : identité + historique + stats sobres. */

import { el, alert as uiAlert, spinner, escape, tempsAffiche, tempsSec } from '../components/helpers.js';
import { read } from '../../store/index.js';
import { normaliser, tokensEquivalents } from '../../matching/normalize.js';
import { adherentForm } from '../components/adherent-form.js';

export default async function renderMember(root, params) {
  root.appendChild(el('h1', {}, 'Fiche adhérent'));
  const adhId = params && params[0];

  const zone = el('div');
  root.appendChild(zone);

  try {
    const [adherents, resultats, courses] = await Promise.all([
      read.adherents(), read.resultats(), read.courses()
    ]);
    zone.replaceChildren();

    if (!adhId) {
      zone.appendChild(renderSelecteur(adherents));
      return;
    }
    const adh = adherents.find(a => a.id === adhId);
    if (!adh) {
      zone.appendChild(uiAlert('err', 'Adhérent introuvable : ' + adhId));
      return;
    }

    const coursesById = new Map(courses.map(c => [c.id, c]));
    const mesResultats = resultats
      .filter(r => {
        if (r.adherent_id && String(r.adherent_id).trim() === adhId) return true;
        // Fallback : match par tokens (gère Marie-Sophie ↔ Marie Sophie, accents, inversion)
        const pS = r.prenom_source || '';
        const nS = r.nom_source || '';
        const eq = tokensEquivalents(pS, adh.prenom) && tokensEquivalents(nS, adh.nom);
        const inv = tokensEquivalents(pS, adh.nom) && tokensEquivalents(nS, adh.prenom);
        return eq || inv;
      })
      .map(r => ({ r, course: coursesById.get(r.course_id) || {} }))
      .sort((a, b) => (b.course.date || '').localeCompare(a.course.date || ''));

    zone.appendChild(renderIdentite(adh, mesResultats.length));
    zone.appendChild(renderStats(mesResultats));
    zone.appendChild(renderHistorique(mesResultats));
  } catch (e) {
    zone.replaceChildren(uiAlert('err', 'Erreur chargement : ' + (e.message || String(e))));
  }
}

function renderSelecteur(adherents) {
  const wrap = el('div');
  const card = el('div.card');
  card.appendChild(el('div.row', {}, [
    el('h2', { style: 'margin: 0;' }, 'Sélectionner un adhérent'),
    el('button.btn.btn-primary', {
      style: 'margin-left: auto;',
      onclick: () => { wrap.appendChild(ajoutForm); ajoutForm.scrollIntoView({ behavior: 'smooth' }); }
    }, '+ Nouvel adhérent'),
  ]));
  const actifs = adherents.filter(a => a.actif !== 'non').sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`));
  const liste = el('div', { style: 'display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px;' });
  actifs.forEach(a => {
    liste.appendChild(el('a.btn', {
      href: '#/membre/' + a.id,
      style: 'text-align:left; text-decoration:none;'
    }, `${a.prenom} ${a.nom}`));
  });
  card.appendChild(liste);
  wrap.appendChild(card);

  const ajoutForm = adherentForm({
    onDone: (adh) => { location.hash = '#/membre/' + adh.id; },
    onCancel: () => ajoutForm.remove(),
  });
  return wrap;
}

function renderIdentite(adh, nbCourses) {
  const card = el('div.card');
  card.appendChild(el('div.row', { style: 'align-items: baseline;' }, [
    el('h2', { style: 'margin: 0;' }, `${adh.prenom} ${adh.nom}`),
    adh.groupe ? el('span.muted', { style: 'margin-left: 8px;' }, 'Groupe ' + escape(adh.groupe)) : null,
  ].filter(Boolean)));
  card.appendChild(el('div.row', { style: 'margin-top: 8px; color: var(--c-text-mut);' }, [
    adh.sexe ? el('span', {}, 'Sexe ' + escape(adh.sexe)) : null,
    adh.date_naissance ? el('span', {}, 'Né·e le ' + escape(adh.date_naissance)) : null,
    el('span', {}, `${nbCourses} course${nbCourses > 1 ? 's' : ''} au club`),
  ].filter(Boolean)));
  return card;
}

function renderStats(mesResultats) {
  const card = el('div.card');
  card.appendChild(el('h2', {}, 'Statistiques'));

  if (!mesResultats.length) {
    card.appendChild(el('div.empty', {}, 'Aucun résultat enregistré pour cet adhérent.'));
    return card;
  }

  // Groupement par distance (arrondi au km entier)
  const parDist = new Map();
  let parAnnee = new Map();
  mesResultats.forEach(({ r, course }) => {
    const dKey = course.distance_km ? Math.round(parseFloat(course.distance_km)) + ' km' : 'Autre';
    if (!parDist.has(dKey)) parDist.set(dKey, []);
    parDist.get(dKey).push({ r, course });
    const annee = (course.date || '').slice(0, 4) || '—';
    parAnnee.set(annee, (parAnnee.get(annee) || 0) + 1);
  });

  // Meilleurs temps par distance
  const tbl = el('table.tbl');
  tbl.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, 'Distance'),
    el('th', {}, 'Courses'),
    el('th', {}, 'Meilleur temps'),
    el('th', {}, 'Lors de'),
  ])));
  const tbody = el('tbody');
  for (const [dist, entries] of [...parDist.entries()].sort()) {
    const avecTemps = entries.filter(e => tempsSec(e.r) != null);
    const meilleur = avecTemps.sort((a, b) => tempsSec(a.r) - tempsSec(b.r))[0];
    tbody.appendChild(el('tr', {}, [
      el('td', {}, dist),
      el('td.num', {}, String(entries.length)),
      el('td.num', { title: 'Temps net' }, meilleur ? tempsAffiche(meilleur.r) : el('span.muted', {}, '—')),
      el('td', {}, meilleur ? `${meilleur.course.nom || ''} (${(meilleur.course.date || '').slice(0, 7)})` : ''),
    ]));
  }
  tbl.appendChild(tbody);
  card.appendChild(tbl);

  // Régularité par année
  const annees = [...parAnnee.entries()].sort();
  const rep = el('div', { style: 'margin-top: 16px; display: flex; gap: 6px; flex-wrap: wrap; align-items: flex-end;' });
  annees.forEach(([an, n]) => {
    const h = Math.max(8, n * 12);
    rep.appendChild(el('div', { style: 'display: flex; flex-direction: column; align-items: center; gap: 4px;' }, [
      el('div', { title: `${an} : ${n} courses`, style: `width: 32px; height: ${h}px; background: var(--c-bleu); border-radius: 2px;` }),
      el('span.muted', { style: 'font-size: 12px;' }, an),
      el('span.mono', {}, String(n)),
    ]));
  });
  card.appendChild(el('h3', {}, 'Régularité par année'));
  card.appendChild(rep);

  return card;
}

function renderHistorique(mesResultats) {
  const card = el('div.card');
  card.appendChild(el('h2', {}, `Historique (${mesResultats.length})`));
  if (!mesResultats.length) return card;

  const tbl = el('table.tbl');
  tbl.appendChild(el('thead', {}, el('tr', {}, [
    el('th', {}, 'Date'),
    el('th', {}, 'Course'),
    el('th', {}, 'Distance'),
    el('th', { title: 'Temps net (chip time)' }, 'Temps net'),
    el('th', {}, 'Rang'),
    el('th', {}, 'Catégorie'),
  ])));
  const tbody = el('tbody');
  mesResultats.forEach(({ r, course }) => {
    tbody.appendChild(el('tr', {}, [
      el('td.mono', {}, course.date || ''),
      el('td', {}, course.nom || ''),
      el('td.num', {}, course.distance_km ? course.distance_km + ' km' : ''),
      el('td.num', { title: r.temps && r.temps !== r.temps_net ? 'Brut : ' + r.temps : '' }, tempsAffiche(r)),
      el('td.num', {}, String(r.rang_general || '')),
      el('td', {}, r.categorie || ''),
    ]));
  });
  tbl.appendChild(tbody);
  card.appendChild(tbl);
  return card;
}

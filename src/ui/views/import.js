/** Vue Import : URL → scrape → preview matching → validation → persist. */

import { el, badge, alert as uiAlert, spinner, escape, tempsAffiche } from '../components/helpers.js';
import { adherentForm } from '../components/adherent-form.js';
import { matcher } from '../../matching/score.js';
import { indexOverrides } from '../../matching/overrides.js';
import { indexAdherentsParNom } from '../../matching/normalize.js';
import { scrapeFromUrl, parseFile } from '../../scraping/index.js';
import { matchBatch, stats as matchStats } from '../../matching/index.js';
import { read, saveImport, findCourseExistante, deleteImport, op as storeOp, sendBatch } from '../../store/index.js';
import { SHEETS } from '../../config.js';

// état local de la vue (par mount)
let state = null;

function freshState() {
  return {
    url: '',
    loading: false,
    error: null,
    adherents: null,
    overrides: null,
    courses: [],       // [{ course, lignes }] après scrape+match
    exclusions: new Set(),  // indices "courseIdx:ligneIdx" à exclure
    affichage: 'adherents', // 'adherents' (matchés uniquement) | 'tout'
    saving: false,
    saved: null,
  };
}

const PRIORITE_STATUS = {
  certain: 0, manuel: 0, probable: 1, douteux: 2, ambigu: 3, absent: 4
};

export default function renderImport(root) {
  state = state || freshState();

  root.appendChild(el('h1', {}, 'Importer des résultats'));

  const urlCard = el('div.card');
  urlCard.appendChild(el('h2', {}, '1. Source'));
  urlCard.appendChild(el('p.muted', {}, "Colle l'URL d'une page de résultats (RaceResult, ProLiveSport, ChronoRace/ACN, Athle.fr, Nordsport…) ou dépose un fichier PDF / CSV."));

  const inputUrl = el('input', { type: 'url', placeholder: 'https://my.raceresult.com/...', value: state.url });
  const btnGo    = el('button.btn.btn-primary', { onclick: () => lancerScrape(inputUrl.value) }, 'Analyser');
  const inputFile = el('input', { type: 'file', accept: '.pdf,.csv', onchange: e => lancerFichier(e.target.files[0]) });

  urlCard.appendChild(el('div.field', {}, [
    el('label', {}, 'URL de la course'),
    inputUrl
  ]));
  urlCard.appendChild(el('div.row', {}, [ btnGo, el('span.muted', {}, 'ou'), inputFile ]));
  root.appendChild(urlCard);

  // zones dynamiques
  const zoneStatus = el('div'); root.appendChild(zoneStatus);
  const zonePreview = el('div'); root.appendChild(zonePreview);

  renderStatus(zoneStatus);
  renderPreview(zonePreview);

  async function lancerScrape(url) {
    state.url = url.trim();
    if (!state.url) { state.error = 'URL vide'; refreshStatus(); return; }
    state.loading = true; state.error = null; state.courses = []; state.saved = null;
    refreshStatus();
    try {
      const [scrape, adh, ovr] = await Promise.all([
        scrapeFromUrl(state.url),
        state.adherents || read.adherents(),
        state.overrides || read.overrides(),
      ]);
      state.adherents = adh;
      state.overrides = ovr;
      state.courses = (scrape.courses || []).map(c => ({
        course: c.course,
        lignes: matchBatch(c.lignes, adh, ovr, null),
      }));
      autoExclureAbsents();
    } catch (e) {
      state.error = e.message || String(e);
    } finally {
      state.loading = false;
      refreshStatus();
      refreshPreview();
    }
  }

  async function lancerFichier(file) {
    if (!file) return;
    state.loading = true; state.error = null; state.courses = []; state.saved = null;
    refreshStatus();
    try {
      const [scrape, adh, ovr] = await Promise.all([
        parseFile(file),
        state.adherents || read.adherents(),
        state.overrides || read.overrides(),
      ]);
      state.adherents = adh;
      state.overrides = ovr;
      state.courses = (scrape.courses || []).map(c => ({
        course: c.course,
        lignes: matchBatch(c.lignes, adh, ovr, null),
      }));
      autoExclureAbsents();
    } catch (e) {
      state.error = e.message || String(e);
    } finally {
      state.loading = false;
      refreshStatus();
      refreshPreview();
    }
  }

  function refreshStatus() { zoneStatus.replaceChildren(); renderStatus(zoneStatus); }
  function refreshPreview() { zonePreview.replaceChildren(); renderPreview(zonePreview); }
}

/** Par défaut on exclut tous les absent — pas de sens à persister des lignes sans match. */
function autoExclureAbsents() {
  state.exclusions = new Set();
  state.courses.forEach((b, ci) => {
    b.lignes.forEach((l, li) => {
      if (l.match_status === 'absent') state.exclusions.add(ci + ':' + li);
    });
  });
}

function renderStatus(root) {
  if (state.loading)  root.appendChild(uiAlert('info', el('span', {}, [spinner(), ' Analyse en cours…'])));
  if (state.error)    root.appendChild(uiAlert('err', 'Erreur : ' + state.error));
  if (state.saving)   root.appendChild(uiAlert('info', el('span', {}, [spinner(), ' Enregistrement…'])));
  if (state.saved) {
    root.appendChild(uiAlert('ok',
      `Import enregistré : ${state.saved.course.nom} — ${state.saved.resultats.length} résultats persistés.`));
  }
}

function renderPreview(root) {
  if (!state.courses.length) return;

  state.courses.forEach((bundle, idx) => {
    const c = bundle.course;
    const st = matchStats(bundle.lignes);
    const nbRetenues = bundle.lignes.filter((_, i) => !state.exclusions.has(idx + ':' + i)).length;

    const card = el('div.card');
    card.appendChild(el('h2', {}, '2. Aperçu — course'));

    // Métadonnées éditables
    const row1 = el('div.row');
    row1.appendChild(el('div.field', { style: 'flex: 2;' }, [
      el('label', {}, 'Nom de la course'),
      el('input', { type: 'text', value: c.nom || '', oninput: e => { c.nom = e.target.value; } }),
    ]));
    row1.appendChild(el('div.field', {}, [
      el('label', {}, 'Date' + (c.date ? '' : ' (non détectée)')),
      el('input', { type: 'date', value: c.date || '', oninput: e => { c.date = e.target.value || null; } }),
    ]));
    row1.appendChild(el('div.field', {}, [
      el('label', {}, 'Distance (km)'),
      el('input', { type: 'number', step: '0.1', value: c.distance_km || '', oninput: e => { c.distance_km = e.target.value ? parseFloat(e.target.value) : null; } }),
    ]));
    row1.appendChild(el('div.field', {}, [
      el('label', {}, 'Lieu'),
      el('input', { type: 'text', value: c.lieu || '', oninput: e => { c.lieu = e.target.value || null; } }),
    ]));
    card.appendChild(row1);
    card.appendChild(el('div.muted', { style: 'font-size:12px; margin-bottom:12px;' },
      'source : ' + escape(c.source) + (c.url ? ' · ' + escape(c.url) : '')));

    const nbReconnus = st.certain + st.ambigu + st.manuel;
    card.appendChild(el('div.row', { style: 'margin-top: 12px;' }, [
      compteur('certain',  st.certain),
      compteur('ambigu',   st.ambigu),
      st.manuel ? compteur('manuel', st.manuel) : null,
      compteur('absent',   st.absent),
      el('span.muted', { style: 'margin-left: auto;' }, `${nbRetenues} / ${st.total} retenues`),
    ].filter(Boolean)));

    // Toggle affichage : adhérents uniquement (défaut) / tout
    card.appendChild(el('div.row', { style: 'margin-top: 12px;' }, [
      el('label', { style: 'font-size:13px; color:var(--c-text-mut);' }, 'Afficher :'),
      el('button.btn' + (state.affichage === 'adherents' ? '.btn-primary' : ''), {
        onclick: () => { state.affichage = 'adherents'; document.getElementById('view').innerHTML=''; renderImport(document.getElementById('view')); }
      }, `Adhérents (${nbReconnus})`),
      el('button.btn' + (state.affichage === 'tout' ? '.btn-primary' : ''), {
        onclick: () => { state.affichage = 'tout'; document.getElementById('view').innerHTML=''; renderImport(document.getElementById('view')); }
      }, `Tout (${st.total})`),
    ]));

    card.appendChild(renderTable(bundle, idx));

    const actions = el('div.row', { style: 'margin-top: 16px;' }, [
      el('button.btn.btn-primary', {
        disabled: state.saving || nbRetenues === 0,
        onclick: () => validerImport(idx),
      }, 'Valider et enregistrer'),
      el('button.btn.btn-ghost', { onclick: () => { state.courses = []; document.getElementById('view').innerHTML = ''; renderImport(document.getElementById('view')); } }, 'Annuler'),
    ]);
    card.appendChild(actions);

    root.appendChild(card);
  });
}

function compteur(status, n) {
  const wrap = el('span', { style: 'display: inline-flex; align-items: center; gap: 6px;' });
  wrap.appendChild(badge(status));
  wrap.appendChild(el('span.muted', {}, String(n)));
  return wrap;
}

function renderTable(bundle, idx) {
  const { lignes } = bundle;
  const adherentsById = new Map((state.adherents || []).map(a => [a.id, a]));

  // Filtrage affichage + tri : matchés en premier (par priorité), absent à la fin
  const indexed = lignes.map((l, i) => ({ l, i }));
  const filtre = state.affichage === 'adherents'
    ? indexed.filter(x => x.l.match_status !== 'absent')
    : indexed;
  filtre.sort((a, b) => {
    const pa = PRIORITE_STATUS[a.l.match_status] ?? 9;
    const pb = PRIORITE_STATUS[b.l.match_status] ?? 9;
    if (pa !== pb) return pa - pb;
    return (parseInt(a.l.rang_general) || 99999) - (parseInt(b.l.rang_general) || 99999);
  });

  // Pagination légère : si > 300 lignes à afficher, on limite et on ajoute un bouton "voir tout"
  const LIMIT = 300;
  const tronque = filtre.length > LIMIT;
  const affiche = tronque ? filtre.slice(0, LIMIT) : filtre;

  const table = el('table.tbl');
  const thead = el('thead', {}, [
    el('tr', {}, [
      el('th', {}, '✓'),
      el('th', {}, 'Rang'),
      el('th', {}, 'Prénom'),
      el('th', {}, 'Nom'),
      el('th', { title: 'Temps net (chip time, depuis la ligne de départ)' }, 'Temps net'),
      el('th', {}, 'Catégorie'),
      el('th', {}, 'Correspondance'),
    ])
  ]);
  table.appendChild(thead);

  const tbody = el('tbody');
  if (affiche.length === 0) {
    tbody.appendChild(el('tr', {}, el('td', { colspan: '7' }, el('div.empty', {}, 'Aucune ligne à afficher avec ce filtre.'))));
  }
  affiche.forEach(({ l, i }) => {
    const exKey = idx + ':' + i;
    const exclu = state.exclusions.has(exKey);
    const tr = el('tr', exclu ? { style: 'opacity:.4' } : {});
    const cb = el('input', {
      type: 'checkbox',
      checked: !exclu,
      onchange: (e) => {
        if (e.target.checked) state.exclusions.delete(exKey);
        else state.exclusions.add(exKey);
        tr.style.opacity = e.target.checked ? '' : '.4';
      }
    });
    const adh = l.adherent_id ? adherentsById.get(l.adherent_id) : null;
    const adhLabel = adh ? `${adh.prenom} ${adh.nom}` : (l.match_status === 'ambigu' ? `${l.candidates.length} candidats` : '—');

    tr.appendChild(el('td', {}, cb));
    tr.appendChild(el('td.num', {}, String(l.rang_general ?? '')));
    tr.appendChild(el('td', {}, l.prenom_source || ''));
    tr.appendChild(el('td', {}, l.nom_source || ''));
    tr.appendChild(el('td.num', { title: l.temps && l.temps !== l.temps_net ? 'Brut : ' + l.temps : '' }, tempsAffiche(l)));
    tr.appendChild(el('td', {}, l.categorie || ''));
    tr.appendChild(el('td', {}, el('span', {}, [
      badge(l.match_status),
      el('span.muted', { style: 'margin-left:6px;' }, adhLabel)
    ])));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  if (tronque) {
    const wrap = el('div');
    wrap.appendChild(el('div.tbl-wrap', {}, table));
    wrap.appendChild(el('div.empty', {}, `Affichage limité aux ${LIMIT} premières lignes sur ${filtre.length}. Bascule sur "Adhérents reconnus" pour voir tes membres en priorité.`));
    return wrap;
  }
  return el('div.tbl-wrap', {}, table);
}

async function validerImport(idx, { remplacer = false } = {}) {
  const bundle = state.courses[idx];

  // Dédup : course déjà importée ?
  if (!remplacer) {
    const existante = await findCourseExistante(bundle.course);
    if (existante) {
      const imports = await read.imports();
      const prec = imports.filter(i => i.course_id === existante.id);
      const nbPrec = prec.reduce((s, i) => s + (parseInt(i.lignes_importees) || 0), 0);
      const ok = confirm(
        `Cette course est déjà importée :\n"${existante.nom}" (${existante.date})\n` +
        `${prec.length} import(s) précédent(s), ${nbPrec} résultats.\n\n` +
        `OK = Remplacer (supprime les anciens imports de cette course puis réimporte)\n` +
        `Annuler = Ne rien faire`
      );
      if (!ok) return;
      // Supprime tous les imports précédents pour cette course
      for (const impAnc of prec) {
        await deleteImport(impAnc);
      }
      // Re-assigne l'id de la course existante pour éviter une 2e course clone
      bundle.course.id = existante.id;
    }
  }

  state.saving = true;
  const root = document.getElementById('view');
  root.innerHTML = ''; renderImport(root);

  try {
    const retenues = bundle.lignes.filter((_, i) => !state.exclusions.has(idx + ':' + i));
    const st = matchStats(retenues);

    const result = await saveImport({
      course: bundle.course,
      resultats: retenues.map(l => ({
        prenom_source: l.prenom_source,
        nom_source: l.nom_source,
        temps: l.temps,
        temps_net: l.temps_net,
        temps_sec: l.temps_sec,
        rang_general: l.rang_general,
        rang_categorie: l.rang_categorie,
        categorie: l.categorie,
        sexe_source: l.sexe_source,
        club_source: l.club_source,
        dossard: l.dossard,
        match_status: l.match_status,
        match_score: l.match_score,
        adherent_id: l.adherent_id,
      })),
      importMeta: {
        source: bundle.course.source,
        url: bundle.course.url || state.url,
        user: localStorage.getItem('chtis.user') || '',
        lignes_totales: bundle.lignes.length,
        lignes_ignorees: bundle.lignes.length - retenues.length,
        lignes_douteuses: st.douteux + st.ambigu,
      }
    });

    state.saved = result;
    // Retirer uniquement la course validée, garder les autres en attente
    state.courses = state.courses.filter((_, i) => i !== idx);
    // Recompose les clés d'exclusion (les indices ont changé)
    const nouvellesExclusions = new Set();
    state.exclusions.forEach(k => {
      const [ci, li] = k.split(':').map(Number);
      if (ci < idx) nouvellesExclusions.add(k);
      else if (ci > idx) nouvellesExclusions.add((ci - 1) + ':' + li);
    });
    state.exclusions = nouvellesExclusions;
  } catch (e) {
    state.error = 'Enregistrement échoué : ' + (e.message || String(e));
  } finally {
    state.saving = false;
    root.innerHTML = ''; renderImport(root);
  }
}

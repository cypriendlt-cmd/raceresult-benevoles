/** Bootstrap de l'app Base Club. */

import { route, start, navigate, setNotFound } from './ui/router.js';
import { el } from './ui/components/helpers.js';
import renderDashboard      from './ui/views/dashboard.js';
import renderImport         from './ui/views/import.js';
import renderImportsHistory from './ui/views/imports-history.js';
import renderResultsTable   from './ui/views/results-table.js';
import renderMember         from './ui/views/member.js';
import renderClubHistory    from './ui/views/club-history.js';
import renderMatchingReview from './ui/views/matching-review.js';
import renderCourse         from './ui/views/course.js';
import renderSondagesList   from './ui/views/sondages-list.js';
import renderSondagesDetail from './ui/views/sondages-detail.js';
import renderLoginAdmin     from './ui/views/login-admin.js';
import renderAdminCoursesList from './ui/views/admin-courses-list.js';
import renderAdminCourseEdit  from './ui/views/admin-course-edit.js';
import renderAdminPollDetail  from './ui/views/admin-poll-detail.js';
import { isAdmin }            from './auth/session.js';

// Toutes les vues "Base Club" (imports, résultats, adhérents, etc.) sont
// réservées au bureau. Un adhérent simple n'accède qu'au module sondages.
// Cf. lessons/2026-04-24-module-sondages-acces.md — c'est du masquage UI,
// pas une sécurité : l'URL directe est interceptée par guardAdmin() qui
// redirige vers #/sondages. Le code reste téléchargeable côté client.
function guardAdmin(viewFn) {
  return (root, params) => {
    if (!isAdmin()) { location.hash = '#/sondages'; return; }
    return viewFn(root, params);
  };
}

// Route racine : dashboard pour les admins, sondages pour tout le monde sinon.
route('#/',          (root, params) => isAdmin() ? renderDashboard(root, params) : (location.hash = '#/sondages'));
route('#/dashboard', guardAdmin(renderDashboard));
route('#/import',    guardAdmin(renderImport));
route('#/imports',   guardAdmin(renderImportsHistory));
route('#/resultats', guardAdmin(renderResultsTable));
route('#/membre',    guardAdmin(renderMember));
route('#/club',      guardAdmin(renderClubHistory));
route('#/revue',     guardAdmin(renderMatchingReview));
route('#/course',    guardAdmin(renderCourse));

// Module sondages (public) — #/sondages ou #/sondages/<id>
route('#/sondages', (root, params) => {
  if (!params.length) return renderSondagesList(root);
  return renderSondagesDetail(root, params);
});

// Module sondages (admin) — toutes les routes tombent sur #/admin car le router
// prend le 2e segment comme clé. On dispatche sur params.
//
//   #/admin                              → login
//   #/admin/courses                      → liste
//   #/admin/courses/new                  → création
//   #/admin/courses/<id>                 → édition
//   #/admin/sondage/<id>                 → détail réponses
route('#/admin', (root, params) => {
  if (!params.length)                                return renderLoginAdmin(root);
  if (params[0] === 'courses' && params.length === 1) return renderAdminCoursesList(root);
  if (params[0] === 'courses' && params[1] === 'new') return renderAdminCourseEdit(root, []);
  if (params[0] === 'courses')                        return renderAdminCourseEdit(root, params.slice(1));
  if (params[0] === 'sondage')                        return renderAdminPollDetail(root, params.slice(1));
  return renderLoginAdmin(root);
});

setNotFound((root) => {
  root.appendChild(el('h1', {}, 'Page inconnue'));
  root.appendChild(el('p', {}, [
    'Cette vue n\'existe pas. ',
    el('a', { href: '#/sondages' }, 'Retour aux sondages'), '.'
  ]));
});

// Route par défaut à l'ouverture : dashboard pour admin, sondages pour le public.
if (!location.hash || location.hash === '#') {
  location.hash = isAdmin() ? '#/dashboard' : '#/sondages';
}

start();

// Les liens admin-only sont masqués aux non-admins (UX, pas sécurité).
// Seuls "Sondages" et "Admin" restent visibles pour un adhérent simple.
const BUREAU_HREFS = ['#/dashboard', '#/import', '#/imports', '#/resultats', '#/membre', '#/club', '#/revue'];
function refreshNav() {
  const admin = isAdmin();
  BUREAU_HREFS.forEach(href => {
    const l = document.querySelector(`.nav a[href="${href}"]`);
    if (l) l.style.display = admin ? '' : 'none';
  });
}
window.addEventListener('hashchange', refreshNav);
refreshNav();

// Burger menu mobile : toggle .open sur la nav
const navToggle = document.querySelector('.nav-toggle');
const navEl = document.querySelector('.nav');
if (navToggle && navEl) {
  navToggle.addEventListener('click', () => {
    const open = navEl.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  // Ferme la nav après un clic sur un lien (sinon le menu reste ouvert sur mobile)
  navEl.addEventListener('click', (ev) => {
    if (ev.target.tagName === 'A') {
      navEl.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

window.__nav = navigate;

/**
 * Console debug : inspecte pourquoi un couple prenom/nom source ne matche pas
 * un adhérent attendu. Usage : await __debugMatch('Marie Sophie', 'ADAM')
 */
window.__debugMatch = async function(prenomSource, nomSource) {
  const { read } = await import('./store/index.js');
  const { scoreAdherent, matchBatch } = await import('./matching/index.js');
  const { normaliser, tokeniserNom } = await import('./matching/normalize.js');
  const adherents = await read.adherents();
  const overrides = await read.overrides();

  console.log('%cSource :', 'font-weight:bold', { prenom: prenomSource, nom: nomSource });
  console.log('Normalisé :', { prenom: normaliser(prenomSource), nom: normaliser(nomSource) });
  console.log('Tokens :', { prenom: tokeniserNom(prenomSource), nom: tokeniserNom(nomSource) });

  const sameName = adherents.filter(a =>
    tokeniserNom(a.nom).join('|') === tokeniserNom(nomSource).join('|')
  );
  console.log(`%c${sameName.length} adhérent(s) avec le même nom :`, 'font-weight:bold');
  sameName.forEach(a => {
    console.log('  →', a.prenom, a.nom, '| score =', scoreAdherent({ prenom_source: prenomSource, nom_source: nomSource }, a), '| tokens prenom =', tokeniserNom(a.prenom));
  });

  const matched = matchBatch(
    [{ prenom_source: prenomSource, nom_source: nomSource }],
    adherents, overrides, null
  )[0];
  console.log('%cVerdict :', 'font-weight:bold; color:' + (matched.match_status === 'certain' ? 'green' : 'orange'), matched);
  return matched;
};

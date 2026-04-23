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

route('#/',          renderDashboard);
route('#/dashboard', renderDashboard);
route('#/import',    renderImport);
route('#/imports',   renderImportsHistory);
route('#/resultats', renderResultsTable);
route('#/membre',    renderMember);
route('#/club',      renderClubHistory);
route('#/revue',     renderMatchingReview);
route('#/course',    renderCourse);

setNotFound((root) => {
  root.appendChild(el('h1', {}, 'Page inconnue'));
  root.appendChild(el('p', {}, [
    'Cette vue n\'existe pas. ',
    el('a', { href: '#/import' }, 'Retour à l\'import'), '.'
  ]));
});

start();

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

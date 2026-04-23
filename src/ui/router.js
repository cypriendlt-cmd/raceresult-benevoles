/** Router hash-based minimal. Routes : #/import #/imports #/resultats #/membre/<id> #/club #/revue */

const routes = new Map();
let notFoundFn = () => {};

export function route(hash, viewFn) {
  routes.set(hash, viewFn);
}

export function setNotFound(fn) {
  notFoundFn = fn;
}

export function navigate(hash) {
  if (location.hash !== hash) location.hash = hash;
  else renderCurrent();
}

function parseHash() {
  const h = location.hash || '#/import';
  // "#/membre/abc" → { route: '#/membre', params: ['abc'] }
  const parts = h.split('/').filter(Boolean);
  if (parts.length <= 2) return { key: h, params: [] };
  return { key: '#/' + parts[1], params: parts.slice(2) };
}

function renderCurrent() {
  const { key, params } = parseHash();
  const fn = routes.get(key);
  const root = document.getElementById('view');
  if (!fn) { notFoundFn(root); return; }
  // état navigation
  document.querySelectorAll('.nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === key);
  });
  root.innerHTML = '';
  fn(root, params);
}

export function start() {
  window.addEventListener('hashchange', renderCurrent);
  if (!location.hash) location.hash = '#/dashboard';
  renderCurrent();
}

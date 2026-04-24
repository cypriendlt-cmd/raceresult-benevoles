/** Helpers DOM légers. Pas de lib, juste du sucre pour éviter la répétition. */

/** Crée un élément : el('div.card', { id: 'x' }, [child1, 'texte']) */
export function el(tag, attrs = {}, children = []) {
  const [name, ...classes] = tag.split('.');
  const node = document.createElement(name);
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') node.className += (node.className ? ' ' : '') + v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    if (typeof c === 'string' || typeof c === 'number') {
      node.appendChild(document.createTextNode(String(c)));
    } else {
      node.appendChild(c);
    }
  }
  return node;
}

export function badge(status) {
  return el('span.badge.badge-' + status, {}, status);
}

export function alert(kind, message) {
  return el('div.alert.alert-' + kind, {}, message);
}

export function spinner() { return el('span.spinner'); }

/** Petit échappement pour mise en innerHTML ponctuelle. */
export function escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Temps à afficher pour un résultat : on privilégie TOUJOURS le temps net
 * (chip time, depuis la ligne de départ du coureur) sur le temps brut/gun
 * (depuis le coup de pistolet). Plus équitable pour les non-élites.
 */
export function tempsAffiche(r) {
  if (!r) return '';
  return (r.temps_net && r.temps_net.trim && r.temps_net.trim())
      || (r.temps && r.temps.trim && r.temps.trim())
      || r.temps_net || r.temps || '';
}

/** Secondes du temps à afficher (net prioritaire), pour tri et comparaisons. */
export function tempsSec(r) {
  if (!r) return null;
  if (r.temps_sec != null && r.temps_sec !== '') {
    const n = typeof r.temps_sec === 'number' ? r.temps_sec : parseInt(r.temps_sec, 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

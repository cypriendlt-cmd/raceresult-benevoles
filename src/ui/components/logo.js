/**
 * Logo Ch'tis Marathoniens — charge le SVG via fetch et injecte dans le DOM
 * pour contourner les limitations <img> (clipPath, defs).
 */

import { el } from './helpers.js';

export const LOGO_URL = 'src/ui/components/logoChtis.svg';

let cache = null;
async function loadSvg() {
  if (cache) return cache;
  const resp = await fetch(LOGO_URL);
  if (!resp.ok) throw new Error('Logo: HTTP ' + resp.status);
  cache = await resp.text();
  return cache;
}

/**
 * Rend le logo en injectant le SVG inline.
 * @param {{size?: number|string, alt?: string}} opts
 */
export function logo({ size = 48 } = {}) {
  const s = typeof size === 'number' ? size + 'px' : size;
  const wrap = el('span', {
    class: 'logo',
    style: `display: inline-flex; width: ${s}; height: ${s}; line-height: 0;`,
    role: 'img',
    'aria-label': "Ch'tis Marathoniens",
  });
  loadSvg().then(svg => {
    wrap.innerHTML = svg;
    const inner = wrap.querySelector('svg');
    if (inner) {
      inner.setAttribute('width', '100%');
      inner.setAttribute('height', '100%');
      inner.style.display = 'block';
    }
  }).catch(() => {
    wrap.textContent = '';
  });
  return wrap;
}

/** Pré-charge pour le header et autres usages immédiats. */
export async function injectLogoInto(element, size = 44) {
  try {
    const svg = await loadSvg();
    element.innerHTML = svg;
    const inner = element.querySelector('svg');
    if (inner) {
      inner.setAttribute('width', String(size));
      inner.setAttribute('height', String(size));
      inner.style.display = 'block';
    }
  } catch (e) {
    element.textContent = '';
  }
}

/** Cache localStorage avec TTL. Jamais source de vérité — uniquement cache. */

import { get as cfg } from '../config.js';

const PREFIX = 'chtis.cache.';

export function getCached(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function setCached(key, value, ttlMs) {
  const ttl = ttlMs || Number(cfg('CACHE_TTL_MS'));
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({
      value,
      expiresAt: Date.now() + ttl
    }));
  } catch (e) {
    // QuotaExceeded : on évacue tout le cache pour repartir propre
    invalidateAll();
  }
}

export function invalidate(key) {
  localStorage.removeItem(PREFIX + key);
}

export function invalidateAll() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) localStorage.removeItem(k);
  }
}

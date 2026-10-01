// Client for the optional live proxy (worker/). When window.UH.live is set,
// search results and un-mirrored property pages come straight from
// unihomes.co.uk; otherwise everything falls back to the crawled snapshot.
import { listingSummary } from './shared/normalize.js';

const API = (window.UH?.live || '').replace(/\/$/, '');
export const liveEnabled = !!API;

// The live site seeds result order per session, so we keep the session the
// proxy hands back and replay it for every page of the same search.
const sessKey = (k) => `uh-live:${k}`;
const getSess = (k) => {
  try { return sessionStorage.getItem(sessKey(k)) || ''; } catch { return ''; }
};
const setSess = (k, v) => {
  try { v && sessionStorage.setItem(sessKey(k), v); } catch {}
};

async function call(endpoint, params, key) {
  const url = `${API}${endpoint}?${new URLSearchParams(params)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: key ? { 'X-UH-Session': getSess(key) } : {} });
    if (!res.ok) throw new Error(`live ${res.status}`);
    if (key) setSess(key, res.headers.get('X-UH-Session'));
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One page of live results for a listing path + filters.
 * @returns {{items, count, more}}
 */
export async function liveSearch(path, filters, page = 1) {
  const params = { path, page };
  for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
  // "houses" is a prototype-only grouping; the live site's equivalent is no type filter.
  if (params.type === 'houses') delete params.type;
  const key = JSON.stringify({ path, ...filters });
  const d = await call('/search', params, key);
  return {
    items: (d.properties || []).map(listingSummary).filter((s) => s.path),
    count: d.propertyCount ?? 0,
    more: !!d.propertiesHasMorePages,
  };
}

/** A whitelisted property record for a live property path (see worker). */
export const liveProperty = (path) => call('/property', { path });

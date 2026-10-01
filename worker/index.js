// Live proxy for the UniHomes prototype.
//
// The live site's search endpoint returns JSON but sends no CORS headers, so a
// GitHub Pages site can't call it from the browser. This Worker forwards a
// small, read-only allowlist of requests and adds CORS for the prototype's
// origin. It never forwards writes, cookies from the browser, or arbitrary URLs.
//
//   GET /search?path=/student-accommodation/leeds&bedrooms=4&page=2
//   GET /property?path=/property/123/leeds/hyde-park/4-bedroom-student-house/x
import { propertyFromHtml } from '../src/shared/normalize.js';

const ORIGIN = 'https://www.unihomes.co.uk';
const UA = 'Mozilla/5.0 (compatible; UniHomesRefreshPOC/0.1; +https://www.andrewgunn.co.uk/unihomes/)';
const FILTERS = ['type', 'bedrooms', 'bathrooms', 'max-price', 'sort', 'page', 'university'];
const LISTING = /^\/student-accommodation\/[a-z0-9-]+(\/[a-z0-9-]+)?$/;
const PROPERTY = /^\/property\/\d+(\/[a-z0-9-]+){1,4}$/;

function cors(req, env) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://www.andrewgunn.co.uk,http://localhost:4173').split(',');
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'X-UH-Session',
    'Access-Control-Expose-Headers': 'X-UH-Session',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });

/** Merge upstream Set-Cookie into the jar; returned to the browser as an opaque header value. */
function sessionFrom(res, previous) {
  const jar = new Map((previous || '').split('; ').filter(Boolean).map((c) => c.split(/=(.*)/s).slice(0, 2)));
  for (const c of res.headers.getSetCookie?.() || []) {
    const [kv] = c.split(';');
    const [k, v] = kv.split(/=(.*)/s);
    // The live site keeps the per-visitor result ordering across several cookies, so keep them all.
    if (k && v !== undefined) jar.set(k.trim(), v);
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'GET') return json({ error: 'method' }, 405, h);
    const url = new URL(req.url);
    const path = url.searchParams.get('path') || '';

    if (url.pathname === '/search') {
      if (!LISTING.test(path)) return json({ error: 'bad path' }, 400, h);
      const q = new URLSearchParams();
      for (const k of FILTERS) {
        const v = url.searchParams.get(k);
        if (v && /^[a-z0-9-]{1,40}$/i.test(v)) q.set(k, v);
      }
      const session = (req.headers.get('X-UH-Session') || '').slice(0, 4000);
      const res = await fetch(`${ORIGIN}${path}?${q}`, {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'User-Agent': UA, ...(session ? { Cookie: session } : {}) },
        cf: { cacheTtl: 0 },
      });
      if (!res.ok) return json({ error: `upstream ${res.status}` }, 502, h);
      const body = await res.json();
      return json(
        { properties: body.properties || [], propertyCount: body.propertyCount, propertiesHasMorePages: body.propertiesHasMorePages, title: body.title },
        200,
        { ...h, 'X-UH-Session': sessionFrom(res, session), 'Cache-Control': 'no-store' },
      );
    }

    if (url.pathname === '/property') {
      if (!PROPERTY.test(path)) return json({ error: 'bad path' }, 400, h);
      const res = await fetch(ORIGIN + path, { headers: { Accept: 'text/html', 'User-Agent': UA }, cf: { cacheTtl: 300, cacheEverything: true } });
      if (res.status === 404) return json({ error: 'not found' }, 404, h);
      if (!res.ok) return json({ error: `upstream ${res.status}` }, 502, h);
      const p = propertyFromHtml(await res.text());
      return p ? json(p, 200, { ...h, 'Cache-Control': 'public, max-age=300' }) : json({ error: 'parse' }, 502, h);
    }

    return json({ ok: true, endpoints: ['/search', '/property'] }, 200, h);
  },
};

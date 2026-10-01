#!/usr/bin/env node
// Render ./data into a static site in ./dist.
//   BASE_PATH=/unihomes LIVE_API=https://…workers.dev node scripts/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import { setBase, href, iconSprite } from '../src/shared/ui.js';
import { page } from '../src/templates/layout.js';
import * as T from '../src/templates/pages.js';
import * as M from '../src/templates/marketing.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const DIST = path.join(ROOT, 'dist');
const cfgFile = path.join(ROOT, 'site.config.json');
const fileCfg = fs.existsSync(cfgFile) ? JSON.parse(fs.readFileSync(cfgFile, 'utf8')) : {};
const BASE = process.env.BASE_PATH ?? fileCfg.basePath ?? '/unihomes';
const LIVE_API = process.env.LIVE_API ?? fileCfg.liveApi ?? '';
const VERSION = Date.now().toString(36);
setBase(BASE);

const t0 = Date.now();
const read = (rel) => JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
const exists = (rel) => fs.existsSync(path.join(DATA, rel));
const list = (dir) =>
  exists(dir)
    ? fs.readdirSync(path.join(DATA, dir), { recursive: true }).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f))
    : [];

// ------------------------------------------------------------------- load
const site = read('site.json');
const meta = exists('meta.json') ? read('meta.json') : { crawledAt: new Date().toISOString() };
const snapshotLabel = new Date(meta.crawledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const summaries = new Map();
const byCity = {};
for (const f of list('props')) {
  const city = path.basename(f, '.json');
  const props = Object.values(read(f).props);
  byCity[city] = props;
  props.forEach((s) => summaries.set(s.id, s));
}

const listings = new Map(); // path (incl. ?type=) -> rec
for (const f of list('listings')) {
  const rec = read(f);
  listings.set(rec.path, rec);
}
const properties = list('property').map(read);
const posts = list('blog')
  .map(read)
  .filter((b) => b.title)
  .map((b) => ({ ...b, slug: b.path.split('/').pop(), excerpt: b.meta?.description, ts: Date.parse(b.date) || 0 }))
  .sort((a, b) => b.ts - a.ts);
const guides = list('guides')
  .map(read)
  .map((g) => ({ ...g, slug: g.path.split('/').pop() }))
  .sort((a, b) => a.city.localeCompare(b.city));
const pages = Object.fromEntries(list('pages').map((f) => [path.basename(f, '.json'), read(f)]));
const cities = site.locations.filter((l) => l.type === 'city');
const cityBySlug = Object.fromEntries(cities.map((c) => [c.slug, c]));
const uniBySlug = Object.fromEntries(site.locations.filter((l) => l.type === 'university').map((u) => [u.slug, u]));

// ------------------------------------------------------- link rewriting
// Paths that exist in the prototype; anything else keeps pointing at the live site.
const built = new Set(['/']);
for (const p of listings.keys()) if (!p.includes('?')) built.add(p);
properties.forEach((p) => built.add(p.path));
posts.forEach((b) => built.add(b.path));
guides.forEach((g) => built.add(g.path));
Object.values(pages).forEach((p) => built.add(p.path));
['/student-accommodation', '/blog', '/city-guides', '/private-halls', '/spare-rooms'].forEach((p) => built.add(p));
const ALIASES = { '/advertise-with-us': '/partner-with-us', '/landlords': '/partner-with-us' };

function rewrite(html) {
  return String(html || '').replace(/href="https?:\/\/(?:www\.)?unihomes\.co\.uk(\/[^"#?]*)?([?#][^"]*)?"/g, (m, p = '/', rest = '') => {
    let clean = p.replace(/\/+$/, '') || '/';
    clean = ALIASES[clean] || clean;
    if (built.has(clean) || /^\/student-accommodation\//.test(clean)) return `href="${href(clean + rest)}"`;
    return m;
  });
}

// --------------------------------------------------------------- output
let written = 0;
function out(p, html) {
  const f = p === '/' ? path.join(DIST, 'index.html') : p.endsWith('.html') ? path.join(DIST, p) : path.join(DIST, p, 'index.html');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
  written++;
}
const config = { liveApi: LIVE_API, snapshot: meta.crawledAt, version: VERSION };
const render = (p, r, current) => out(p, page({ path: p, site, config, current, ...r }));

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

// ---------------------------------------------------------------- home
const latestByCity = (site.homeTiles?.length ? site.homeTiles.map((t) => t.path.split('/').pop()) : cities.map((c) => c.slug)).map((slug) => ({
  slug,
  name: cityBySlug[slug]?.name || slug,
  total: listings.get(`/student-accommodation/${slug}`)?.count || cityBySlug[slug]?.total,
  items: (byCity[slug] || [])
    .filter((s) => s.images?.length)
    .sort((a, b) => Date.parse(b.live || 0) - Date.parse(a.live || 0))
    .slice(0, 10),
}));
render('/', T.home({ site, latestByCity, totals: { properties: summaries.size || properties.length, cities: cities.length } }));

// ------------------------------------------------------------- listings
const kindOf = (p) => {
  const seg = p.split('/').slice(2);
  if (seg.length === 1) return 'city';
  if (seg[1].startsWith('near-')) return 'uni';
  if (/^\d+(-plus)?-bedroom-student-(houses|flats)$/.test(seg[1])) return 'beds';
  return 'area';
};
const areaName = (rec) => {
  const m = rec.meta?.title?.match(/in (.+?), [^|]+\|/) || rec.meta?.title?.match(/in (.+?) \|/);
  return m ? m[1].trim() : rec.path.split('/').pop().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};
const bedsLabel = (slug) => {
  const m = slug.match(/^(\d+)(-plus)?-bedroom-student-(houses|flats)$/);
  return m ? { n: m[1] + (m[2] ? '+' : ''), noun: m[3] === 'flats' ? 'flats' : 'houses', value: m[1] + (m[2] ? '-plus' : '') } : null;
};

// Group listing paths per city for cross-navigation.
const related = {};
for (const [p, rec] of listings) {
  if (p.includes('?')) continue;
  const seg = p.split('/');
  const city = seg[2];
  const r = (related[city] ||= { areas: [], unis: [], beds: [] });
  const k = kindOf(p);
  if (k === 'area') r.areas.push({ name: areaName(rec), path: p, count: rec.count });
  if (k === 'uni') r.unis.push({ name: uniBySlug[seg[3].slice(5)]?.name || areaName(rec), path: p, count: rec.count });
  if (k === 'beds') {
    const b = bedsLabel(seg[3]);
    r.beds.push({ name: `${b.n} bed ${b.noun}`, path: p, count: rec.count, sort: parseInt(b.n) });
  }
}
Object.values(related).forEach((r) => {
  r.areas.sort((a, b) => b.count - a.count);
  r.unis.sort((a, b) => b.count - a.count);
  r.beds.sort((a, b) => a.sort - b.sort);
});

const guideFor = new Set(guides.map((g) => g.slug));
let listingCount = 0;
for (const [p, rec] of listings) {
  if (p.includes('?')) continue;
  const seg = p.split('/');
  const citySlug = seg[2];
  const city = cityBySlug[citySlug] || { slug: citySlug, name: rec.heading?.replace(/^Student accommodation in /i, '') || citySlug };
  const kind = kindOf(p);
  let h1, lede, crumb, location;
  const ids = rec.ids.filter((id) => summaries.has(id));
  const n = ids.length || rec.count;
  const homes = `${n.toLocaleString('en-GB')} ${n === 1 ? 'home' : 'homes'}`;
  if (kind === 'city') {
    h1 = `Student accommodation in ${city.name}`;
    lede = `${homes} with bills included — student houses, flats, private halls and spare rooms.`;
    crumb = city.name;
    location = { name: city.name, slug: city.slug, type: 'city' };
  } else if (kind === 'uni') {
    const uni = uniBySlug[seg[3].slice(5)];
    const name = uni?.name || areaName(rec);
    h1 = `Student homes near ${name}`;
    lede = `${homes} close to campus, all with bills included.`;
    crumb = name;
    location = { name, slug: uni?.slug || seg[3].slice(5), type: 'university' };
  } else if (kind === 'beds') {
    const b = bedsLabel(seg[3]);
    h1 = `${b.n} bedroom student ${b.noun} in ${city.name}`;
    lede = `${homes} for groups of ${b.n}, every one with bills included.`;
    crumb = `${b.n} bedrooms`;
    location = { name: city.name, slug: city.slug, type: 'city' };
  } else {
    const name = areaName(rec);
    h1 = `Student homes in ${name}, ${city.name}`;
    lede = `${homes} in ${name} with bills included.`;
    crumb = name;
    location = { name: `${name}, ${city.name}`, slug: seg[3], type: 'area' };
  }
  const initial = ids.slice(0, 24).map((id) => summaries.get(id));
  const variants = {};
  if (kind === 'city') {
    for (const t of ['spare-rooms', 'private-halls']) {
      const v = listings.get(`${p}?type=${t}`);
      if (v) variants[t] = v.ids.filter((id) => summaries.has(id));
    }
  }
  const r = related[citySlug] || { areas: [], unis: [], beds: [] };
  render(
    p,
    T.listing({
      rec: { ...rec, count: n },
      city,
      kind,
      h1,
      lede,
      crumb,
      location,
      initial,
      variantType: '',
      snapshotLabel,
      rewrite,
      guide: guideFor.has(citySlug) ? `/city-guide/${citySlug}` : null,
      related: { areas: kind === 'area' ? r.areas.filter((a) => a.path !== p) : r.areas, unis: r.unis.filter((u) => u.path !== p), beds: r.beds.filter((b) => b.path !== p) },
      clientData: { path: p, kind, city: citySlug, ids, count: n, variants, beds: kind === 'beds' ? bedsLabel(seg[3]).value : null },
    }),
  );
  listingCount++;
}
render('/student-accommodation', T.cityIndex({ site, page: pages['student-accommodation'], rewrite }));
for (const slug of ['private-halls', 'spare-rooms']) if (site.landing?.[slug]) render('/' + slug, T.landing({ site, slug, data: site.landing[slug] }));

// ----------------------------------------------------------- properties
for (const p of properties) {
  const city = p.city?.slug || p.path.split('/')[3];
  const area = p.path.split('/')[4];
  const pool = (byCity[city] || []).filter((s) => s.id !== p.id && s.images?.length);
  const similar = [...pool.filter((s) => s.path.split('/')[4] === area), ...pool.filter((s) => s.path.split('/')[4] !== area)]
    .sort((a, b) => (a.path.split('/')[4] === area ? 0 : 1) - (b.path.split('/')[4] === area ? 0 : 1) || Math.abs(a.beds - p.beds) - Math.abs(b.beds - p.beds))
    .slice(0, 8);
  render(p.path, T.property({ p, similar, rewrite }));
}

// ----------------------------------------------------------------- blog
render('/blog', T.blogIndex({ posts }));
posts.forEach((b, i) => {
  const rel = posts.filter((x) => x !== b).slice(0, 6);
  render(b.path, T.blogPost({ b, related: rel, rewrite }));
});

// --------------------------------------------------------------- guides
render('/city-guides', T.guidesIndex({ guides, site, pg: pages['city-guides'] }));
for (const g of guides) {
  const latest = (byCity[g.slug] || []).filter((s) => s.images?.length).sort((a, b) => Date.parse(b.live || 0) - Date.parse(a.live || 0)).slice(0, 8);
  render(g.path, T.guide({ g, site, rewrite, latest, cityCount: listings.get(`/student-accommodation/${g.slug}`)?.count }));
}

// ---------------------------------------------------------- other pages
const SPECIAL = new Set(['home', 'blog', 'city-guides', 'student-accommodation', 'private-halls', 'spare-rooms']);
const HERO = {
  about: ['About UniHomes', 'We make finding the perfect student home a whole lot simpler.'],
  contact: ['Contact us', 'Questions about a property, your bills or your account? We’re here to help.'],
  'shared-student-utility-bills': ['Student bills, sorted', 'One simple weekly price for gas, electricity, water and superfast broadband.'],
  'partner-with-us': ['Fill faster. Work smarter. Earn more.', 'Since 2015, UniHomes has helped letting agents across the UK fill their student properties faster.'],
  'partner-with-us-pbsa': ['Turn searching renters into secured bookings.', 'Connect with over 2 million active student home hunters every year.'],
  careers: ['Careers at UniHomes', 'We’re looking for passionate, talented and motivated people to join our team.'],
};
const BESPOKE = {
  'partner-with-us': M.partnerAgents,
  'partner-with-us-pbsa': M.partnerPbsa,
  'shared-student-utility-bills': M.bills,
  about: M.about,
  contact: M.contact,
  careers: M.careers,
};
for (const [slug, pg] of Object.entries(pages)) {
  if (SPECIAL.has(slug)) continue;
  const key = slug.split('__')[0];
  if (BESPOKE[key]) {
    const r = BESPOKE[key]({ pg, site, rewrite });
    render(pg.path, { ...r, head: (r.head || '').replace(/marketing\.css"/, `marketing.css?v=${VERSION}"`) }, pg.path);
    continue;
  }
  const [hero, lead] = HERO[key] || [];
  render(pg.path, T.generic({ pg, rewrite, hero, lead }), pg.path);
}

// ----------------------------------------------------------------- 404
out('404.html', page({ path: '/404', site, config, ...T.notFound() }));

// --------------------------------------------------------------- assets
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
copyDir(path.join(ROOT, 'src/assets'), path.join(DIST, 'assets'));
fs.writeFileSync(path.join(DIST, 'assets/img/icons.svg'), iconSprite());
copyDir(path.join(ROOT, 'src/shared'), path.join(DIST, 'assets/js/shared'));
// Page templates are browser-safe too (used by the 404 live-property fallback).
fs.mkdirSync(path.join(DIST, 'assets/js/templates'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'src/templates/pages.js'), path.join(DIST, 'assets/js/templates/pages.js'));

// Client data: per-city summaries (shared across listing pages) + location index.
const dataDir = path.join(DIST, 'assets/data');
fs.mkdirSync(path.join(dataDir, 'props'), { recursive: true });
for (const [city, props] of Object.entries(byCity)) fs.writeFileSync(path.join(dataDir, 'props', `${city}.json`), JSON.stringify(props));
const areaIndex = [];
for (const [city, r] of Object.entries(related)) r.areas.forEach((a) => areaIndex.push(['area', a.path.split('/').pop(), a.name, city, a.count]));
fs.writeFileSync(
  path.join(dataDir, 'locations.json'),
  JSON.stringify([
    ...site.locations.map((l) => [l.type, l.slug, l.name, l.city || l.slug, l.total, l.searches || 0]),
    ...areaIndex.map((a) => [...a, 0]),
  ]),
);
// Paths in the snapshot, so the 404 fallback can tell "not mirrored" from "gone".
fs.writeFileSync(path.join(dataDir, 'meta.json'), JSON.stringify({ crawledAt: meta.crawledAt, base: BASE }));

// SEO guard rails for the host: no indexing, no sitemap.
fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nDisallow:\n# Every page carries <meta name="robots" content="noindex, nofollow">.\n');
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`built ${written} pages (${listingCount} listings, ${properties.length} properties, ${posts.length} posts, ${guides.length} guides) in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${DIST}`);

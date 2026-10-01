#!/usr/bin/env node
// Crawl www.unihomes.co.uk into ./data as compact JSON.
//
//   node scripts/crawl.mjs                      # everything (incremental)
//   node scripts/crawl.mjs --only=site,blog     # selected sections
//   node scripts/crawl.mjs --limit=20           # cap items per section (dev)
//   node scripts/crawl.mjs --fresh              # ignore caches
//
// Sections: site, pages, listings, properties, blog, guides
import fs from 'node:fs';
import path from 'node:path';
import { get, stats, ORIGIN, cookieJar } from './lib/http.mjs';
import * as X from './lib/extract.mjs';
import pLimit from 'p-limit';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = process.env.DATA_DIR || path.join(ROOT, 'data');
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const FRESH = !!args.fresh;
const DAY = 864e5;
const TTL = {
  property: Number(process.env.PROPERTY_TTL_DAYS || 5) * DAY,
  blog: Number(process.env.BLOG_TTL_DAYS || 30) * DAY,
  guide: Number(process.env.GUIDE_TTL_DAYS || 10) * DAY,
};
const want = (s) => !ONLY || ONLY.has(s);
const take = (arr) => arr.slice(0, LIMIT);

// ------------------------------------------------------------------ helpers

function write(rel, obj) {
  const f = path.join(DATA, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj));
}
function read(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8'));
  } catch {
    return null;
  }
}
function fresh(rel, ttl) {
  if (FRESH) return false;
  const j = read(rel);
  return j && j.fetchedAt && Date.now() - Date.parse(j.fetchedAt) < ttl;
}
const slugOf = (p) => p.split('/').filter(Boolean).pop();
const now = () => new Date().toISOString();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Bound work per *task* (not just per request) so parsed pages don't pile up in memory.
const tasks = pLimit(Number(process.env.CRAWL_CONCURRENCY || 6));

async function progress(label, items, fn) {
  let done = 0;
  const t0 = Date.now();
  await Promise.all(
    items.map(async (it) => {
      await tasks(() => fn(it));
      done++;
      if (done % 100 === 0 || done === items.length)
        log(`  ${label}: ${done}/${items.length} (${Math.round((Date.now() - t0) / 1000)}s)`);
    }),
  );
}

// ------------------------------------------------------------------ sitemap

async function sitemap() {
  const { body } = await get('/sitemap.xml');
  const urls = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => X.livePath(m[1].trim())).filter(Boolean);
  const g = { listings: [], properties: [], blog: [], guides: [], pages: [] };
  for (const u of new Set(urls)) {
    if (u.startsWith('/property/')) g.properties.push(u);
    else if (/^\/student-accommodation\/.+/.test(u)) g.listings.push(u);
    else if (/^\/blog\/.+/.test(u)) g.blog.push(u);
    else if (/^\/city-guide\/.+/.test(u)) g.guides.push(u);
    else if (!/^\/(login|reset-password)$/.test(u)) g.pages.push(u);
  }
  return g;
}

// ---------------------------------------------------------------- site-wide

async function crawlSite() {
  log('site: home, landing pages, reviews');
  const home = X.load((await get('/')).body);
  const html = home.html();
  const i = html.indexOf('var __PROPERTY_COUNTS = ');
  let locations = [];
  if (i > -1) {
    const s = html.slice(i + 24);
    // JSON array ends at the first "];" — parse incrementally to be safe.
    locations = JSON.parse(s.slice(0, s.indexOf('];') + 1));
  }
  const tiles = ($) =>
    $('a')
      .filter((_, a) => $(a).find('img').length && /\d+\s+(properties|private halls?|spare rooms?)/i.test($(a).text()))
      .map((_, a) => {
        const $a = $(a);
        const t = $a.text().replace(/\s+/g, ' ').trim();
        const img = $a.find('img').first();
        const src = (img.attr('srcset') || img.attr('src') || '').split(',')[0].trim().split(/\s+/)[0];
        return {
          name: $a.find('h3').first().text().trim() || t.replace(/\s*\d+.*$/, ''),
          path: X.livePath($a.attr('href')),
          count: Number((t.match(/(\d[\d,]*)\s+(properties|private|spare)/i) || [])[1]?.replace(/,/g, '')) || null,
          image: (src.match(/cdn-p1\.unihomes\.co\.uk\/(.+)$/) || [])[1] || null,
        };
      })
      .get();
  const featuredPosts = [];
  home('a[href*="/blog/"]').each((_, a) => {
    const p = X.livePath(home(a).attr('href'));
    const t = home(a).text().replace(/\s+/g, ' ').trim();
    if (p && p.split('/').length === 3 && t) featuredPosts.push(p);
  });

  const landing = {};
  for (const slug of ['private-halls', 'spare-rooms']) {
    const $ = X.load((await get('/' + slug)).body);
    landing[slug] = { meta: X.pageMeta($), h2: $('h2').first().text().trim(), tiles: tiles($) };
  }

  // Trustpilot reviews (public widget data the live site embeds).
  let reviews = null;
  try {
    const tp = await get(
      'https://widget.trustpilot.com/trustbox-data/54ad5defc6454f065c28af8b?businessUnitId=597b326a0000ff0005a79eac&locale=en-GB&reviewStars=5%2C4&reviewsPerPage=15',
      { json: true },
    );
    const b = tp.body;
    reviews = {
      score: b?.businessUnit?.trustScore ?? null,
      stars: b?.businessUnit?.stars ?? null,
      total: b?.businessUnit?.numberOfReviews?.total ?? null,
      url: b?.links?.profileUrl || 'https://uk.trustpilot.com/review/unihomes.co.uk',
      items: (b?.reviews || []).map((r) => ({
        stars: r.stars,
        title: r.title,
        text: r.text,
        name: r.consumer?.displayName,
        date: r.createdAt,
      })),
    };
  } catch (e) {
    console.warn('  ! trustpilot', e.message);
  }

  // Which city photos/backgrounds exist on the CDN (a few cities have none).
  const cityImages = {};
  await Promise.all(
    locations
      .filter((l) => l.type === 'city')
      .map(async (l) => {
        const head = async (u) => (await fetch(u, { method: 'HEAD' }).catch(() => ({ ok: false }))).ok;
        cityImages[l.slug] = {
          photo: await head(`https://cdn-p1.unihomes.co.uk/locations/${l.slug}.jpg`),
          bg: await head(`https://cdn-p0.unihomes.co.uk/images/city-backgrounds/${l.slug}.webp`),
        };
      }),
  );

  write('site.json', {
    fetchedAt: now(),
    cityImages,
    meta: X.pageMeta(home),
    locations,
    homeTiles: tiles(home),
    featuredPosts: [...new Set(featuredPosts)].slice(0, 8),
    landing,
    reviews,
  });
  log(`  locations=${locations.length} tiles=${tiles(home).length} reviews=${reviews?.items.length ?? 0}`);
}

// ----------------------------------------------------------------- listings

/** data file for a listing path; "?type=spare-rooms" variants become "~spare-rooms". */
export const listingFile = (p) =>
  `listings${p.replace(/^\/student-accommodation/, '').replace(/\?type=/, '~') || '/_all'}.json`;
const summaries = new Map(); // id -> summary

function cityOfSummary(s) {
  return s.path?.split('/')[3] || 'unknown';
}

async function crawlListing(p) {
  const jar = cookieJar();
  const res = await get(p, { jar });
  if (!res.body) return null;
  const L = X.listingPage(X.load(res.body));
  res.body = null;
  const ids = [];
  const add = (arr) =>
    arr.forEach((raw) => {
      const s = X.listingSummary(raw);
      if (!s.path) return;
      summaries.set(s.id, s);
      ids.push(s.id);
    });
  add(L.first);
  // Remaining pages come from the same endpoint the live site's "load more" uses.
  let page = 2;
  let more = L.hasMore;
  while (more && page < 200) {
    const r = await get(`${p}${p.includes('?') ? '&' : '?'}page=${page}`, { json: true, jar });
    const props = r.body?.properties || [];
    add(props);
    more = !!r.body?.propertiesHasMorePages && props.length > 0;
    page++;
  }
  const rec = {
    fetchedAt: now(),
    path: p,
    meta: L.meta,
    heading: L.heading,
    breadcrumbs: L.breadcrumbs,
    intro: L.intro,
    count: L.count || ids.length,
    ids: [...new Set(ids)],
  };
  write(listingFile(p), rec);
  return rec;
}

async function crawlListings(paths) {
  log(`listings: ${paths.length}`);
  // Seed summaries from the previous run so partial (--limit) runs don't lose data.
  if (!FRESH && fs.existsSync(path.join(DATA, 'props'))) {
    for (const f of fs.readdirSync(path.join(DATA, 'props'))) {
      const j = read('props/' + f);
      if (j?.props) Object.values(j.props).forEach((s) => summaries.has(s.id) || summaries.set(s.id, s));
    }
  }
  const seen = new Set();
  await progress('listings', paths, async (p) => {
    const rec = await crawlListing(p);
    rec?.ids.forEach((id) => seen.add(id));
  });
  // Group summaries per city; drop anything no longer listed anywhere (full runs only).
  const byCity = {};
  for (const s of summaries.values()) {
    if (LIMIT === Infinity && !seen.has(s.id)) continue;
    (byCity[cityOfSummary(s)] ||= {})[s.id] = s;
  }
  fs.rmSync(path.join(DATA, 'props'), { recursive: true, force: true });
  for (const [city, props] of Object.entries(byCity)) write(`props/${city}.json`, { fetchedAt: now(), props });
  log(`  summaries=${summaries.size} cities=${Object.keys(byCity).length}`);
}

// --------------------------------------------------------------- properties

async function crawlProperties(paths) {
  // Union of sitemap URLs and every property we saw in listings.
  const all = new Map();
  paths.forEach((p) => all.set(p.split('/')[2], p));
  for (const s of summaries.values()) all.set(String(s.id), s.path);
  const todo = take([...all.entries()].filter(([id]) => !fresh(`property/${id}.json`, TTL.property)));
  log(`properties: ${all.size} known, ${todo.length} to fetch`);
  let gone = 0;
  await progress('properties', todo, async ([id, p]) => {
    const res = await get(p);
    if (!res.body) {
      gone++;
      fs.rmSync(path.join(DATA, `property/${id}.json`), { force: true });
      return;
    }
    const rec = X.propertyPage(X.load(res.body));
    if (!rec) return;
    write(`property/${id}.json`, { fetchedAt: now(), path: p, ...rec });
  });
  // Prune properties that are no longer advertised anywhere (full runs only).
  if (LIMIT === Infinity && fs.existsSync(path.join(DATA, 'property'))) {
    for (const f of fs.readdirSync(path.join(DATA, 'property'))) {
      if (!all.has(f.replace('.json', ''))) {
        fs.rmSync(path.join(DATA, 'property', f));
        gone++;
      }
    }
  }
  log(`  removed ${gone} delisted`);
}

// -------------------------------------------------------------------- blog

async function crawlBlog(paths) {
  const todo = take(paths.filter((p) => !fresh(`blog/${slugOf(p)}.json`, TTL.blog)));
  log(`blog: ${paths.length} posts, ${todo.length} to fetch`);
  await progress('blog', todo, async (p) => {
    const res = await get(p);
    if (!res.body) return;
    write(`blog/${slugOf(p)}.json`, { fetchedAt: now(), path: p, ...X.blogPost(X.load(res.body)) });
  });
  // Blog index page 1 gives us the editorial ordering + category list.
  const idx = X.blogIndex(X.load((await get('/blog')).body));
  write('blog-index.json', { fetchedAt: now(), ...idx });
}

// ------------------------------------------------------------------ guides

async function crawlGuides(paths) {
  const todo = take(paths.filter((p) => !fresh(`guides/${slugOf(p)}.json`, TTL.guide)));
  log(`guides: ${paths.length}, ${todo.length} to fetch`);
  await progress('guides', todo, async (p) => {
    const res = await get(p);
    if (!res.body) return;
    write(`guides/${slugOf(p)}.json`, { fetchedAt: now(), path: p, ...X.cityGuide(X.load(res.body)) });
  });
}

// ------------------------------------------------------------------- pages

async function crawlPages(paths) {
  log(`pages: ${paths.length}`);
  await progress('pages', take(paths), async (p) => {
    const res = await get(p);
    if (!res.body) return;
    let $ = X.load(res.body);
    const meta = X.pageMeta($);
    // Several marketing pages render their body inside /frame-content/<slug>.
    const frame = $('iframe[src*="/frame-content/"]').first().attr('src');
    let body;
    if (frame) {
      const fr = await get(new URL(frame, ORIGIN).href);
      body = fr.body ? X.genericPage(X.load(fr.body)) : { html: '' };
    } else {
      body = X.genericPage($);
    }
    const slug = p === '/' ? 'home' : p.slice(1).replace(/\//g, '__');
    write(`pages/${slug}.json`, { fetchedAt: now(), path: p, meta, html: body.html, framed: !!frame });
  });
}

// -------------------------------------------------------------------- main

const t0 = Date.now();
fs.mkdirSync(DATA, { recursive: true });
const map = await sitemap();
log(
  `sitemap: listings=${map.listings.length} properties=${map.properties.length} blog=${map.blog.length} guides=${map.guides.length} pages=${map.pages.length}`,
);
if (want('site')) await crawlSite();
if (want('pages')) await crawlPages(map.pages);
if (want('listings')) {
  // Spare rooms and private halls are type-filtered variants of each city page.
  const cities = map.listings.filter((p) => p.split('/').length === 3);
  const variants = cities.flatMap((c) => [`${c}?type=spare-rooms`, `${c}?type=private-halls`]);
  await crawlListings(take([...map.listings, ...variants]));
}
else if (want('properties')) {
  for (const f of fs.existsSync(path.join(DATA, 'props')) ? fs.readdirSync(path.join(DATA, 'props')) : [])
    Object.values(read('props/' + f).props).forEach((s) => summaries.set(s.id, s));
}
if (want('properties')) await crawlProperties(map.properties);
if (want('blog')) await crawlBlog(map.blog);
if (want('guides')) await crawlGuides(map.guides);

write('meta.json', { crawledAt: now(), sitemap: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length])), stats });
log(`done in ${Math.round((Date.now() - t0) / 1000)}s — ${stats.requests} requests, ${stats.failures} failures, ${(stats.bytes / 1e6).toFixed(1)}MB`);

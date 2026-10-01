// Page bodies. Each returns { title, description, body, … } for layout.page().
import { esc, href, live, img, srcset, money, plural, fmtDate, icon, card, breadcrumb, stars, propertyTitle } from '../shared/ui.js';

const num = (n) => Number(n || 0).toLocaleString('en-GB');
const homesN = (n) => `${num(n)} ${Number(n) === 1 ? 'home' : 'homes'}`;
const cityPhoto = (site, slug, w = 640) => (site.cityImages?.[slug]?.photo ? img(`locations/${slug}.jpg`, w) : null);

// ------------------------------------------------------------ search widget

export const TYPES = [
  { id: '', label: 'All homes' },
  { id: 'houses', label: 'Houses & flats' },
  { id: 'private-halls', label: 'Private halls' },
  { id: 'spare-rooms', label: 'Spare rooms' },
];
const BEDS = [['', 'Any'], ...Array.from({ length: 9 }, (_, i) => [String(i + 1), `${i + 1} bed${i ? 's' : ''}`]), ['10-plus', '10+ beds']];
const PRICES = [['', 'No max'], ...[100, 120, 140, 160, 180, 200, 250, 300, 400].map((p) => [String(p), `£${p} pppw`])];

export function searchWidget({ id = 'hero', type = '', location = null } = {}) {
  const opts = (arr, sel) => arr.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
  return `<form class="search" role="search" action="${href('/student-accommodation')}" data-search id="search-${id}" novalidate>
  <div class="search-tabs" role="tablist" aria-label="Property type">${TYPES.map(
    (t) => `<button class="search-tab" type="button" role="tab" aria-selected="${t.id === type}" data-type="${t.id}">${t.label}</button>`,
  ).join('')}</div>
  <input type="hidden" name="type" value="${esc(type)}">
  <div class="search-row">
    <div class="field field-loc">
      <label for="loc-${id}">${icon('pin')}Location</label>
      <input id="loc-${id}" name="q" type="text" autocomplete="off" spellcheck="false" placeholder="City, area or university" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-${id}" value="${esc(location?.name || '')}" data-ac${location ? ` data-slug="${esc(location.slug)}" data-kind="${esc(location.type)}" data-city="${esc(location.city || location.slug)}"` : ''}>
      <ul class="ac-list" id="ac-${id}" role="listbox" hidden></ul>
    </div>
    <div class="field"><label for="beds-${id}">${icon('bed')}Bedrooms</label><select id="beds-${id}" name="bedrooms">${opts(BEDS, '')}</select></div>
    <div class="field"><label for="price-${id}">${icon('zap')}Max price</label><select id="price-${id}" name="max-price">${opts(PRICES, '')}</select></div>
    <button class="btn btn-accent search-go" type="submit">${icon('search')}<span>Search</span></button>
  </div>
</form>`;
}

// ------------------------------------------------------------------- home

export function home({ site, latestByCity, totals }) {
  const cities = site.locations.filter((l) => l.type === 'city');
  const byOrder = [...cities].sort((a, b) => (b.searches || 0) - (a.searches || 0));
  const tiles = site.homeTiles?.length ? site.homeTiles : byOrder.slice(0, 12).map((c) => ({ name: c.name, path: `/student-accommodation/${c.slug}` }));
  const count = (slug) => cities.find((c) => c.slug === slug)?.total;
  const unis = site.locations.filter((l) => l.type === 'university').sort((a, b) => (b.searches || 0) - (a.searches || 0)).slice(0, 18);
  const r = site.reviews;
  const tabCities = latestByCity.filter((c) => c.items.length >= 4).slice(0, 7);

  const body = `
<section class="hero">
  <div class="wrap">
    <h1>Find your student home</h1>
    <p class="hero-sub">Search <strong>${num(totals.properties)}</strong> student homes in <strong>${totals.cities}</strong> UK cities — <strong>every one with bills included</strong>.</p>
    ${searchWidget({ id: 'hero' })}
    <div class="quick"><span class="quick-label">Popular:</span>${tiles
      .slice(0, 8)
      .map((t) => {
        const slug = t.path.split('/').pop();
        return `<a href="${href(t.path)}">${esc(t.name)} <small>${num(count(slug) || t.count)}</small></a>`;
      })
      .join('')}</div>
    <div class="hero-stats">
      <span>${icon('check')}Gas, electricity, water & broadband included</span>
      ${r ? `<span>${stars(r.stars || 5)} <strong>${esc(r.score)}</strong>&nbsp;Trustpilot · ${num(r.total)} reviews</span>` : ''}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head">
      <div><h2>Just added</h2><p>The newest bills-included homes, straight from the live site.</p></div>
    </div>
    <div class="tabs" role="tablist" aria-label="City">${tabCities
      .map((c, i) => `<button class="tab" role="tab" type="button" aria-selected="${i === 0}" aria-controls="latest-${c.slug}" id="tab-${c.slug}">${esc(c.name)}</button>`)
      .join('')}</div>
    ${tabCities
      .map(
        (c, i) => `<div class="rail-wrap" id="latest-${c.slug}" role="tabpanel" aria-labelledby="tab-${c.slug}"${i ? ' hidden' : ''}>
      <button class="rail-btn prev" type="button" aria-label="Scroll left">${icon('chevronLeft')}</button>
      <div class="rail" data-rail>${c.items.map((s, j) => card(s, { eager: i === 0 && j < 2 })).join('')}</div>
      <button class="rail-btn next" type="button" aria-label="Scroll right">${icon('chevronRight')}</button>
      <p class="mt-0"><a class="link-arrow" href="${href('/student-accommodation/' + c.slug)}">See all ${homesN(c.total)} in ${esc(c.name)} ${icon('arrowRight')}</a></p>
    </div>`,
      )
      .join('')}
  </div>
</section>

<section class="section section-soft">
  <div class="wrap">
    <div class="section-head"><div><h2>Search by city</h2><p>The most searched university cities right now.</p></div><a class="link-arrow hide-sm" href="${href('/student-accommodation')}">All cities ${icon('arrowRight')}</a></div>
    <div class="city-grid">${tiles
      .slice(0, 12)
      .map((t) => {
        const slug = t.path.split('/').pop();
        const ph = cityPhoto(site, slug, 480);
        return `<a class="city" href="${href(t.path)}">${ph ? `<img src="${ph}" alt="" loading="lazy" width="480" height="360">` : ''}<span class="city-label"><span class="city-name">${esc(t.name)}</span><span class="city-count">${homesN(count(slug) || t.count)}</span></span></a>`;
      })
      .join('')}</div>
    <p class="only-sm" style="margin-top:16px"><a class="btn btn-outline btn-block" href="${href('/student-accommodation')}">View all ${cities.length} cities</a></p>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head"><div><h2>Search near your university</h2><p>Jump straight to homes close to campus.</p></div></div>
    <ul class="uni-list">${unis
      .map((u) => `<li><a href="${href(`/student-accommodation/${u.city}/near-${u.slug}`)}"><span>${esc(u.name)}</span><small>${homesN(u.total)}</small></a></li>`)
      .join('')}</ul>
  </div>
</section>

<section class="section-tight">
  <div class="wrap">
    <div class="bills">
      <div><h2>Every home. Bills included.</h2><p>One simple weekly price — no splitting bills with housemates.</p></div>
      <ul class="bills-icons">
        <li>${icon('flame')}Gas</li><li>${icon('zap')}Electricity</li><li>${icon('wifi')}Broadband</li><li>${icon('droplet')}Water</li>
      </ul>
      <a class="btn btn-accent" href="${href('/shared-student-utility-bills')}">How it works ${icon('arrowRight')}</a>
    </div>
  </div>
</section>

${
  r?.items?.length
    ? `<section class="section">
  <div class="wrap">
    <div class="section-head"><div><h2>Rated excellent by students</h2><div class="tp-score">${stars(r.stars || 5)}<strong>${esc(r.score)} out of 5</strong><span class="muted">based on ${num(r.total)} Trustpilot reviews</span></div></div><a class="link-arrow hide-sm" href="${esc(r.url)}" rel="noopener">Read reviews ${icon('external')}</a></div>
    <div class="reviews">${r.items
      .slice(0, 10)
      .map((v) => `<article class="review">${stars(v.stars)}<h3>${esc(v.title)}</h3><p>${esc(v.text)}</p><footer>${esc(v.name)} · ${fmtDate(v.date)}</footer></article>`)
      .join('')}</div>
  </div>
</section>`
    : ''
}

<section class="section-tight">
  <div class="wrap">
    <div class="cta-band">
      <div><h2>Letting agent or operator?</h2><p>Advertise your student properties with bills included — for free.</p></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-primary" href="${href('/partner-with-us')}">Letting agents</a><a class="btn btn-outline" href="${href('/partner-with-us-pbsa')}">PBSA / BTR</a></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Student accommodation by city</h2>
    <ul class="az">${[...cities].sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<li><a href="${href('/student-accommodation/' + c.slug)}">${esc(c.name)}</a></li>`).join('')}</ul>
  </div>
</section>`;
  return { title: site.meta.title, description: site.meta.description, body, bodyClass: 'page-home' };
}

// ---------------------------------------------------------------- listings

/**
 * City / area / near-uni / bedroom listing.
 * ctx: { rec, site, cityRec, kind, city, related, initial, total, variants }
 */
export function listing(ctx) {
  const { rec, city, kind, related, initial, location, variantType } = ctx;
  const cityName = city?.name || rec.heading;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Student accommodation', path: '/student-accommodation' }];
  if (kind !== 'city') crumbs.push({ name: cityName, path: `/student-accommodation/${city.slug}` });
  const h1 = ctx.h1;
  crumbs.push({ name: ctx.crumb || h1 });

  const subnav = (title, items) =>
    items.length
      ? `<div class="stack-sm" style="margin-bottom:22px"><h3>${title}</h3><ul class="subnav">${items
          .map((x) => `<li><a href="${href(x.path)}">${esc(x.name)}${x.count != null ? `<small>${num(x.count)}</small>` : ''}</a></li>`)
          .join('')}</ul></div>`
      : '';

  const body = `
<div class="wrap results-head">
  ${breadcrumb(crumbs)}
  <h1>${esc(h1)}</h1>
  <p class="lede">${esc(ctx.lede)}</p>
</div>
<div class="searchbar" data-searchbar>
  <div class="wrap">
    <div class="sb-loc">
      <label class="sr-only" for="sb-loc">Location</label>
      <input id="sb-loc" type="text" autocomplete="off" spellcheck="false" placeholder="City, area or university" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="ac-sb" value="${esc(location.name)}" data-ac data-slug="${esc(location.slug)}" data-kind="${esc(location.type)}" data-city="${esc(city.slug)}" data-navigate>
      <ul class="ac-list" id="ac-sb" role="listbox" hidden></ul>
    </div>
    <div class="filters" data-filters>
      <div class="chip-select"><label class="sr-only" for="f-type">Type</label><select id="f-type" data-f="type">${TYPES.map((t) => `<option value="${t.id}"${t.id === variantType ? ' selected' : ''}>${t.label}</option>`).join('')}</select></div>
      <div class="chip-select"><label class="sr-only" for="f-beds">Bedrooms</label><select id="f-beds" data-f="bedrooms">${BEDS.map(([v, l]) => `<option value="${v}">${v ? l : 'Bedrooms'}</option>`).join('')}</select></div>
      <div class="chip-select"><label class="sr-only" for="f-price">Max price</label><select id="f-price" data-f="max-price">${PRICES.map(([v, l]) => `<option value="${v}">${v ? 'Up to ' + l : 'Max price'}</option>`).join('')}</select></div>
      <div class="chip-select"><label class="sr-only" for="f-baths">Bathrooms</label><select id="f-baths" data-f="bathrooms"><option value="">Bathrooms</option>${[1, 2, 3, 4].map((n) => `<option value="${n}">${n}+ baths</option>`).join('')}</select></div>
      <div class="chip-select"><label class="sr-only" for="f-sort">Sort</label><select id="f-sort" data-f="sort"><option value="">Recommended</option><option value="newest">Newest first</option><option value="price-asc">Lowest price</option><option value="price-desc">Highest price</option></select></div>
    </div>
    <button class="btn btn-outline btn-sm filter-btn" type="button" data-open-filters aria-haspopup="dialog">${icon('sliders')}<span>Filters</span><span class="count" hidden data-filter-count></span></button>
    <div class="view-toggle" role="group" aria-label="View">
      <button type="button" aria-pressed="true" data-view="list">${icon('grid')}<span>List</span></button>
      <button type="button" aria-pressed="false" data-view="map">${icon('map')}<span>Map</span></button>
    </div>
  </div>
</div>

<div class="wrap" data-results data-path="${esc(rec.path)}" data-city="${esc(city.slug)}" data-variant="${esc(variantType)}">
  <div class="results-meta">
    <p class="results-count" aria-live="polite" data-count><strong>${num(rec.count)}</strong> ${rec.count === 1 ? 'home' : 'homes'} <small>with bills included</small></p>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><div class="active-filters" data-active></div><span class="source" data-source title="Results from a snapshot of unihomes.co.uk">Snapshot ${esc(ctx.snapshotLabel)}</span></div>
  </div>
  <div class="split">
    <div class="list-pane">
      <div class="grid" data-grid>${initial.map((s, i) => card(s, { eager: i < 2 })).join('') || emptyState(cityName)}</div>
      <div class="load-more" data-more${initial.length >= rec.count ? ' hidden' : ''}>
        <p data-more-label>Showing ${initial.length} of ${num(rec.count)}</p>
        <div class="progress"><i style="width:${Math.round((initial.length / Math.max(rec.count, 1)) * 100)}%"></i></div>
        <button class="btn btn-outline" type="button" data-load-more>Show more homes</button>
      </div>
    </div>
    <div class="map-pane" aria-label="Map of results"><div class="map" data-map></div></div>
  </div>
</div>

<section class="section">
  <div class="wrap">
    ${subnav(`Areas in ${esc(cityName)}`, related.areas)}
    ${subnav(`Universities in ${esc(cityName)}`, related.unis)}
    ${subnav('Browse by bedrooms', related.beds)}
    ${rec.intro ? `<div class="prose seo-copy collapsed" data-collapse>${ctx.rewrite(rec.intro)}</div><button class="btn btn-ghost btn-sm" type="button" data-expand style="margin-top:8px">Read more ${icon('chevronDown')}</button>` : ''}
    ${ctx.guide ? `<div class="cta-band" style="margin-top:28px"><div><h2>Moving to ${esc(cityName)}?</h2><p>Read our student guide to ${esc(cityName)} — areas, nights out and what it’s really like.</p></div><a class="btn btn-primary" href="${href(ctx.guide)}">Read the city guide</a></div>` : ''}
  </div>
</section>

<div class="sheet" hidden data-sheet>
  <div class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
    <div class="sheet-grab"></div>
    <div class="sheet-head"><h2 id="sheet-title">Filters</h2><button class="icon-btn" type="button" aria-label="Close filters" data-close-sheet>${icon('x')}</button></div>
    <fieldset><legend>Property type</legend><div class="seg">${TYPES.map((t) => `<label><input type="radio" name="s-type" value="${t.id}"${t.id === variantType ? ' checked' : ''}><span>${t.label}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Bedrooms</legend><div class="seg">${BEDS.map(([v, l]) => `<label><input type="radio" name="s-bedrooms" value="${v}"${v === '' ? ' checked' : ''}><span>${v ? v.replace('-plus', '+') : 'Any'}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Bathrooms</legend><div class="seg">${['', '1', '2', '3', '4'].map((v) => `<label><input type="radio" name="s-bathrooms" value="${v}"${v === '' ? ' checked' : ''}><span>${v ? v + '+' : 'Any'}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Max price per week</legend><div class="seg">${PRICES.map(([v, l]) => `<label><input type="radio" name="s-max-price" value="${v}"${v === '' ? ' checked' : ''}><span>${v ? '£' + v : 'Any'}</span></label>`).join('')}</div></fieldset>
    <fieldset><legend>Sort by</legend><div class="seg">${[['', 'Recommended'], ['newest', 'Newest'], ['price-asc', 'Lowest price'], ['price-desc', 'Highest price']].map(([v, l]) => `<label><input type="radio" name="s-sort" value="${v}"${v === '' ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <div class="sheet-foot"><button class="btn btn-outline" type="button" data-clear-filters>Clear all</button><button class="btn btn-accent" type="button" data-apply-filters>Show homes</button></div>
  </div>
</div>
<script type="application/json" id="listing-data">${JSON.stringify(ctx.clientData).replace(/</g, '\\u003c')}</script>`;
  return { title: rec.meta.title, description: rec.meta.description, body, bodyClass: 'page-listing', scripts: ['listing.js'] };
}

function emptyState(city) {
  return `<div class="empty" style="grid-column:1/-1">${icon('search')}<h2>No homes match right now</h2><p class="muted">Try removing a filter or searching all of ${esc(city)}.</p></div>`;
}

/** /student-accommodation — every city, A–Z with counts. */
export function cityIndex({ site, page: pg, rewrite }) {
  const cities = site.locations.filter((l) => l.type === 'city').sort((a, b) => a.name.localeCompare(b.name));
  const groups = {};
  cities.forEach((c) => (groups[c.name[0]] ||= []).push(c));
  const body = `
<section class="hero" style="padding-bottom:40px"><div class="wrap">
  ${breadcrumb([{ name: 'Home', path: '/' }, { name: 'Student accommodation' }])}
  <h1>Student accommodation</h1>
  <p class="hero-sub">Choose a city, area or university. Every home on UniHomes includes gas, electricity, water and broadband.</p>
  ${searchWidget({ id: 'cities' })}
</div></section>
<section class="section"><div class="wrap">
  <div class="city-grid">${cities
    .filter((c) => site.cityImages?.[c.slug]?.photo)
    .sort((a, b) => (b.total || 0) - (a.total || 0))
    .slice(0, 12)
    .map((c) => `<a class="city" href="${href('/student-accommodation/' + c.slug)}"><img src="${cityPhoto(site, c.slug, 480)}" alt="" loading="lazy" width="480" height="360"><span class="city-label"><span class="city-name">${esc(c.name)}</span><span class="city-count">${homesN(c.total)}</span></span></a>`)
    .join('')}</div>
</div></section>
<section class="section section-soft"><div class="wrap">
  <h2>All cities A–Z</h2>
  ${Object.entries(groups)
    .map(([l, cs]) => `<div style="margin-top:18px"><h3 style="color:var(--blue-700)">${l}</h3><ul class="uni-list">${cs.map((c) => `<li><a href="${href('/student-accommodation/' + c.slug)}"><span>${esc(c.name)}</span><small>${homesN(c.total)}</small></a></li>`).join('')}</ul></div>`)
    .join('')}
</div></section>
${pg?.html ? `<section class="section"><div class="wrap"><div class="prose">${rewrite(pg.html)}</div></div></section>` : ''}`;
  return { title: pg?.meta?.title || 'Student Accommodation | UniHomes', description: pg?.meta?.description, body };
}

/** /private-halls and /spare-rooms landing pages. */
export function landing({ site, slug, data, totals }) {
  const isHalls = slug === 'private-halls';
  const type = isHalls ? 'private-halls' : 'spare-rooms';
  const noun = isHalls ? 'private halls' : 'spare rooms';
  const body = `
<section class="hero"><div class="wrap">
  ${breadcrumb([{ name: 'Home', path: '/' }, { name: isHalls ? 'Private halls' : 'Spare rooms' }])}
  <h1>${esc(data.meta.h1 || (isHalls ? 'Find your perfect private hall' : 'Find your perfect spare room'))}</h1>
  <p class="hero-sub">${esc(data.h2 || data.meta.description)}</p>
  ${searchWidget({ id: slug, type })}
</div></section>
<section class="section"><div class="wrap">
  <div class="section-head"><div><h2>Popular cities for ${noun}</h2><p>${isHalls ? 'Studios, en-suites and apartments in purpose-built blocks.' : 'A room of your own in an existing student home.'}</p></div></div>
  <div class="city-grid">${data.tiles
    .map((t) => {
      const c = t.path.split('/')[2].split('?')[0];
      const ph = cityPhoto(site, c, 480);
      return `<a class="city" href="${href(t.path)}">${ph ? `<img src="${ph}" alt="" loading="lazy" width="480" height="360">` : ''}<span class="city-label"><span class="city-name">${esc(t.name)}</span><span class="city-count">${t.count ? plural(t.count, noun.replace(/s$/, '')) : 'View ' + noun}</span></span></a>`;
    })
    .join('')}</div>
</div></section>
<section class="section-tight"><div class="wrap">
  <div class="bills"><div><h2>All bills included</h2><p>One weekly price covers your energy, water and Wi-Fi.</p></div><ul class="bills-icons"><li>${icon('flame')}Gas</li><li>${icon('zap')}Electricity</li><li>${icon('wifi')}Broadband</li><li>${icon('droplet')}Water</li></ul><a class="btn btn-accent" href="${href('/student-accommodation')}">All homes ${icon('arrowRight')}</a></div>
</div></section>`;
  return { title: data.meta.title, description: data.meta.description, body };
}

// --------------------------------------------------------------- property

const UTIL = [
  ['gas', 'Gas', 'flame'],
  ['electricity', 'Electricity', 'zap'],
  ['broadband', 'Superfast broadband', 'wifi'],
  ['water', 'Water', 'droplet'],
  ['tv', 'TV licence', 'tv'],
];

export function property({ p, similar, rewrite }) {
  const title = p.name || `${p.beds} bedroom ${p.type === 'apartment' ? 'apartment' : 'house'}`;
  const where = [p.street, p.area?.name, p.city?.name].filter(Boolean).join(', ');
  const imgs = p.images.length ? p.images : [];
  const livePath = p.path;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: p.city?.name || 'Student accommodation', path: p.city ? `/student-accommodation/${p.city.slug}` : '/student-accommodation' },
  ];
  if (p.area) crumbs.push({ name: p.area.name, path: `/student-accommodation/${p.city.slug}/${p.area.slug}` });
  crumbs.push({ name: p.street || title });
  const nu = p.noUtilities;
  const noUtil = new Set((Array.isArray(nu) ? nu : nu && typeof nu === 'object' ? Object.keys(nu).filter((k) => nu[k]) : String(nu || '').split(',')).map((u) => String(u).trim().toLowerCase()));
  const utilities = UTIL.filter(([k]) => !noUtil.has(k));
  const availDate = p.availableFrom && Date.parse(p.availableFrom) > Date.now() ? p.availableFrom : null;
  const avail = availDate ? fmtDate(availDate) : 'Now';
  const rooms = p.rooms || [];
  const priceMax = Math.max(...rooms.map((r) => r.pppw || 0), p.pricePppw || 0);
  const ranged = rooms.length && priceMax > (p.pricePppw || 0) + 0.5;
  const desc = p.description || '';
  const yt = p.youtube || p.media?.find((m) => m.youtube)?.youtube;

  const gallery = imgs.length
    ? `<div class="gallery${imgs.length < 3 ? ' few' : ''}" data-gallery>
  <div class="gallery-main">
    <div class="gallery-track">${imgs.map((ph, i) => `<button type="button" data-open="${i}" aria-label="Open photo ${i + 1} of ${imgs.length}"><img src="${img(ph, 1200)}" srcset="${srcset(ph, [640, 960, 1400])}" sizes="(min-width: 800px) 60vw, 100vw" alt="${i === 0 ? esc(title + ' on ' + where) : ''}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="1200" height="900"></button>`).join('')}</div>
    <button class="gallery-count" type="button" data-open="0">${icon('expand')}${imgs.length} photos</button>
  </div>
  ${imgs.length >= 3 ? `<div class="gallery-thumbs">${imgs.slice(1, 5).map((ph, i) => `<button type="button" data-open="${i + 1}" aria-label="Open photo ${i + 2}"><img src="${img(ph, 640)}" alt="" loading="lazy" width="640" height="480"></button>`).join('')}</div>` : ''}
</div>
<script type="application/json" id="gallery-data">${JSON.stringify(imgs.map((ph) => img(ph, 1600)))}</script>`
    : '';

  const body = `
<div class="wrap" style="padding-top:14px">
  ${breadcrumb(crumbs)}
  ${gallery}
  <div class="prop-layout">
    <div>
      <div class="prop-head">
        <h1>${esc(title)}</h1>
        <p class="prop-sub"><span>${icon('pin')}${esc(where)}${p.postcode ? ', ' + esc(p.postcode) : ''}</span>${p.advert === 'btr' ? `<span>${icon('building')}Private halls</span>` : ''}</p>
        <p class="prop-price only-sm">${ranged ? '<span>From</span> ' : ''}<strong>${money(p.pricePppw, (p.pricePppw || 0) % 1 ? 2 : 0)}</strong> <span>pppw</span> <span class="pill-bills">${icon('check')}Bills included</span></p>
      </div>
      <ul class="keyfacts">
        <li>${icon('bed')}<strong>${p.beds}</strong><span>${p.beds === 1 ? 'Bedroom' : 'Bedrooms'}${p.roomsAvailable != null && p.roomsAvailable !== p.beds ? ` · ${p.roomsAvailable} available` : ''}</span></li>
        <li>${icon('bath')}<strong>${p.baths}</strong><span>${p.baths === 1 ? 'Bathroom' : 'Bathrooms'}</span></li>
        <li>${icon('calendar')}<strong>${esc(avail)}</strong><span>Available from</span></li>
        <li>${icon('home')}<strong>${p.type === 'apartment' ? 'Apartment' : 'House'}</strong><span>${p.epc ? `EPC rating ${esc(p.epc)}` : 'Property type'}</span></li>
      </ul>
      ${p.offers?.length ? `<p class="notice" style="margin-top:16px">${icon('sparkles')}<span>${p.offers.map(esc).join(' · ')}</span></p>` : ''}

      ${rooms.length && p.showRoomTypes ? `<section class="prop-section"><h2>Rooms & prices</h2><div style="overflow-x:auto"><table class="rooms"><thead><tr><th>Room</th><th>Type</th><th>Per week</th><th>Per month</th></tr></thead><tbody>${rooms
        .map((r) => `<tr><td><strong>Room ${r.n}</strong></td><td>${esc(r.type || '—')}</td><td><strong>${money(r.pppw, r.pppw % 1 ? 2 : 0)}</strong></td><td>${money(r.pcm)}</td></tr>`)
        .join('')}</tbody></table></div></section>` : ''}

      <section class="prop-section">
        <h2>Bills included</h2>
        <ul class="utilities">${utilities.map(([, l, ic]) => `<li><span class="ub">${icon(ic)}</span>${l}</li>`).join('')}</ul>
        <p class="muted" style="margin-top:12px;font-size:.93rem">Your utilities are set up and managed by UniHomes, with 24/7 wellbeing support included.</p>
      </section>

      ${desc ? `<section class="prop-section"><h2>About this home</h2><div class="desc collapsed" data-collapse>${esc(desc)}</div><button class="btn btn-ghost btn-sm" type="button" data-expand>Read more ${icon('chevronDown')}</button></section>` : ''}

      ${p.features?.length ? `<section class="prop-section"><h2>Features</h2><ul class="features">${p.features.map((f) => `<li>${icon('check')}<span>${esc(f)}</span></li>`).join('')}</ul></section>` : ''}

      ${yt ? `<section class="prop-section"><h2>Video tour</h2><div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}" loading="lazy" allowfullscreen title="Video tour"></iframe></div></section>` : ''}

      ${p.lat && p.lng ? `<section class="prop-section"><h2>Location</h2><div class="prop-map" data-prop-map data-lat="${p.lat}" data-lng="${p.lng}"></div><p class="muted" style="margin-top:10px;font-size:.88rem">Map shows the approximate location.</p></section>` : ''}
    </div>

    <aside class="aside-stack">
      <div class="price-box">
        <div><span class="per">${ranged ? 'From ' : ''}</span><span class="big">${money(p.pricePppw, (p.pricePppw || 0) % 1 ? 2 : 0)}</span> <span class="per">pppw</span></div>
        <span class="pill-bills">${icon('check')}All bills included</span>
        <dl>
          ${p.pricePerMonthHousehold ? `<dt>Whole house / month</dt><dd>${money(p.pricePerMonthHousehold)}</dd>` : ''}
          <dt>Available from</dt><dd>${esc(avail)}</dd>
          ${p.availableTo ? `<dt>Tenancy until</dt><dd>${fmtDate(p.availableTo)}</dd>` : ''}
          ${p.deposit != null ? `<dt>Deposit</dt><dd>${p.deposit ? money(p.deposit) : 'None'}</dd>` : ''}
          ${p.councilTax ? `<dt>Council tax band</dt><dd>${esc(p.councilTax)}</dd>` : ''}
        </dl>
        <a class="btn btn-accent btn-lg" href="${live(livePath)}#enquire">${p.bookable ? 'Book a viewing' : 'Enquire now'}</a>
        <a class="btn btn-outline" href="${live(livePath)}">${icon('heart')}Save to shortlist</a>
        <p class="fine">Enquiries and bookings are handled on unihomes.co.uk</p>
      </div>
    </aside>
  </div>
</div>

${similar.length ? `<section class="section section-soft"><div class="wrap"><div class="section-head"><div><h2>Similar homes nearby</h2></div>${p.city ? `<a class="link-arrow" href="${href(p.area ? `/student-accommodation/${p.city.slug}/${p.area.slug}` : `/student-accommodation/${p.city.slug}`)}">See more ${icon('arrowRight')}</a>` : ''}</div><div class="rail-wrap"><div class="rail" data-rail>${similar.map((s) => card(s)).join('')}</div></div></div></section>` : ''}

<div class="mobile-cta"><div class="mc-price"><strong>${money(p.pricePppw, (p.pricePppw || 0) % 1 ? 2 : 0)} <span>pppw</span></strong><span>Bills included</span></div><a class="btn btn-accent" href="${live(livePath)}#enquire">${p.bookable ? 'Book viewing' : 'Enquire'}</a></div>`;
  return { title: p.meta?.title || title, description: p.meta?.description, body, bodyClass: 'page-property has-mobile-cta', scripts: ['property.js'] };
}

// -------------------------------------------------------------------- blog

export function postCard(b, { featured = false } = {}) {
  return `<article class="post${featured ? ' post-featured' : ''}">
  <div class="post-img">${b.image ? `<img src="${img(b.image, featured ? 1200 : 640)}" alt="" loading="lazy" width="640" height="360">` : ''}</div>
  <div class="post-body">
    <div class="post-meta">${b.date ? `<span>${esc(b.date)}</span>` : ''}${b.readMins ? `<span>${b.readMins} min read</span>` : ''}</div>
    <h3><a href="${href(b.path)}">${esc(b.title)}</a></h3>
    ${b.excerpt ? `<p>${esc(b.excerpt)}</p>` : ''}
  </div>
</article>`;
}

export function blogIndex({ posts }) {
  const [first, ...rest] = posts;
  const body = `
<section class="page-hero"><div class="wrap">${breadcrumb([{ name: 'Home', path: '/' }, { name: 'Blog' }])}<h1>Our student blog</h1><p>The hub of student lifestyle — house-hunting advice, money tips, city guides and more.</p></div></section>
<section class="section"><div class="wrap">
  ${first ? postCard(first, { featured: true }) : ''}
  <div class="blog-tools" style="margin-top:32px"><label class="sr-only" for="blog-q">Search posts</label><input class="blog-search" id="blog-q" type="search" placeholder="Search ${posts.length} posts…" data-blog-search></div>
  <div class="post-grid" data-blog-grid>${rest.slice(0, 12).map((b) => postCard(b)).join('')}</div>
  <div class="load-more" data-blog-more><button class="btn btn-outline" type="button">Load more posts</button></div>
</div></section>
<script type="application/json" id="blog-data">${JSON.stringify(rest.map(({ path, title, date, readMins, image, excerpt }) => ({ path, title, date, readMins, image, excerpt }))).replace(/</g, '\\u003c')}</script>`;
  return { title: 'Blog | Tips & Advice | UniHomes', description: 'Student tips, advice and city guides from UniHomes.', body, scripts: ['blog.js'] };
}

export function blogPost({ b, related, rewrite }) {
  const body = `
<div class="wrap">
  <header class="article-head">
    ${breadcrumb([{ name: 'Home', path: '/' }, { name: 'Blog', path: '/blog' }, { name: b.title }])}
    <h1>${esc(b.title)}</h1>
    <div class="article-meta">${b.date ? `<span>${icon('calendar')}${esc(b.date)}</span>` : ''}${b.readMins ? `<span>${icon('clock')}${b.readMins} min read</span>` : ''}</div>
    ${b.image ? `<div class="article-hero"><img src="${img(b.image, 1400)}" srcset="${srcset(b.image, [640, 1000, 1400])}" sizes="(min-width: 1240px) 1200px, 100vw" alt="" fetchpriority="high" width="1400" height="612"></div>` : ''}
  </header>
  <div class="content-layout">
    <article class="prose">${rewrite(b.html)}</article>
    <aside><div class="side-sticky">
      <div class="side-card" style="background:var(--blue-50);border-color:var(--blue-150)"><h2>Find your student home</h2><p class="muted" style="font-size:.93rem">Thousands of homes, every one with bills included.</p><a class="btn btn-accent btn-block" href="${href('/student-accommodation')}">${icon('search')}Start searching</a></div>
      ${related.length ? `<div class="side-card"><h2>Recent posts</h2><ul class="side-links">${related.map((r) => `<li><a href="${href(r.path)}">${esc(r.title)}</a></li>`).join('')}</ul></div>` : ''}
    </div></aside>
  </div>
</div>`;
  return { title: b.meta?.title || b.title, description: b.meta?.description, body };
}

// ----------------------------------------------------------------- guides

export function guidesIndex({ guides, site, pg }) {
  const body = `
<section class="page-hero"><div class="wrap">${breadcrumb([{ name: 'Home', path: '/' }, { name: 'City guides' }])}<h1>City guides</h1><p>${esc(pg?.meta?.description || 'With insights from our UniHomes ambassadors — current students living in your city — these are student guides you can trust.')}</p></div></section>
<section class="section"><div class="wrap"><div class="guide-index">${guides
    .map((g) => {
      const ph = cityPhoto(site, g.slug, 480);
      return `<a class="city" href="${href(g.path)}">${ph ? `<img src="${ph}" alt="" loading="lazy" width="480" height="360">` : ''}<span class="city-label"><span class="city-name">${esc(g.city)}</span><span class="city-count">Student guide</span></span></a>`;
    })
    .join('')}</div></div></section>`;
  return { title: pg?.meta?.title || 'Student Life City Guides | UniHomes', description: pg?.meta?.description, body };
}

export function guide({ g, site, rewrite, latest, cityCount }) {
  const slug = g.path.split('/').pop();
  const hero = g.hero || (site.cityImages?.[slug]?.photo ? img(`locations/${slug}.jpg`, 1600) : null);
  const copy = g.sections.filter((s) => s.kind === 'copy');
  const anchor = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const faq = g.sections.find((s) => s.kind === 'faq');
  const quotes = g.sections.filter((s) => s.kind === 'quote' && !/frequently asked/i.test(s.html));

  const faqHtml = faq ? renderFaq(rewrite(faq.html)) : '';
  let qi = 0;
  const body = `
<section class="page-hero${hero ? ' has-img' : ''}">${hero ? `<img class="bg" src="${esc(hero)}" alt="" fetchpriority="high">` : ''}<div class="wrap">${breadcrumb([{ name: 'Home', path: '/' }, { name: 'City guides', path: '/city-guides' }, { name: g.city }])}<h1>Student life in ${esc(g.city)}</h1><p>${esc(g.meta?.description || '')}</p><p style="margin-top:18px"><a class="btn btn-accent" href="${href('/student-accommodation/' + slug)}">${icon('search')}View ${cityCount ? num(cityCount) + ' ' : ''}homes in ${esc(g.city)}</a></p></div></section>
${copy.length > 1 ? `<nav class="guide-nav" aria-label="Guide sections"><div class="wrap"><ul>${copy.map((s) => `<li><a href="#${anchor(s.title)}">${esc(s.title)}</a></li>`).join('')}${faq ? '<li><a href="#faq">FAQs</a></li>' : ''}</ul></div></nav>` : ''}
<div class="wrap"><div class="content-layout guide-copy">
  <div>
    ${copy
      .map((s, i) => {
        const q = quotes[qi] && i % 2 === 1 ? quotes[qi++] : null;
        return `<section id="${anchor(s.title)}" style="margin-bottom:36px"><h2>${esc(s.title)}</h2><div class="prose">${rewrite(s.html)}</div></section>${q ? `<figure class="quote" style="margin-bottom:36px">${rewrite(q.html)}</figure>` : ''}`;
      })
      .join('')}
    ${latest.length ? `<section style="margin-bottom:36px"><div class="section-head"><h2>New homes in ${esc(g.city)}</h2><a class="link-arrow" href="${href('/student-accommodation/' + slug)}">View all ${icon('arrowRight')}</a></div><div class="rail-wrap"><div class="rail" data-rail style="grid-auto-columns:min(82%,300px)">${latest.map((s) => card(s)).join('')}</div></div></section>` : ''}
    ${faqHtml ? `<section id="faq"><h2>Frequently asked questions</h2>${faqHtml}</section>` : ''}
  </div>
  <aside><div class="side-sticky">
    ${g.universities.length ? `<div class="side-card"><h2>Homes near your university</h2><ul class="side-links">${g.universities.map((u) => `<li><a href="${href(u.href)}">${esc(u.name)}</a></li>`).join('')}</ul></div>` : ''}
    ${g.posts.length ? `<div class="side-card"><h2>Read more about ${esc(g.city)}</h2><ul class="side-links">${g.posts.map((p) => `<li><a href="${href(p.path)}">${esc(p.title)}</a></li>`).join('')}</ul></div>` : ''}
  </div></aside>
</div></div>`;
  return { title: g.meta?.title, description: g.meta?.description, body };
}

/** Turn "<h4>Question</h4><p>answer…</p>…" into accessible <details>. */
export function renderFaq(html) {
  const parts = html.split(/<h4>/).slice(1);
  if (!parts.length) return `<div class="prose">${html}</div>`;
  return `<div class="faq">${parts
    .map((p) => {
      const [q, a = ''] = p.split('</h4>');
      return `<details><summary>${q}${icon('chevronDown')}</summary><div class="faq-a prose">${a}</div></details>`;
    })
    .join('')}</div>`;
}

// ------------------------------------------------------------- generic pages

export function generic({ pg, rewrite, hero, aside = true, lead }) {
  const crumbs = [{ name: 'Home', path: '/' }, { name: hero || pg.meta?.h1 || pg.meta?.title?.split('|')[0].trim() }];
  const html = rewrite(pg.html || '');
  const body = `
<section class="page-hero"><div class="wrap">${breadcrumb(crumbs)}<h1>${esc(hero || pg.meta?.h1 || pg.meta?.title?.split('|')[0].trim())}</h1>${lead || pg.meta?.description ? `<p>${esc(lead || pg.meta.description)}</p>` : ''}</div></section>
<div class="wrap"><div class="content-layout"${aside ? '' : ' style="grid-template-columns:1fr"'}>
  <article class="prose">${/<h4>/.test(html) && /faq/i.test(pg.path) ? renderFaq(html) : html}</article>
  ${aside ? `<aside><div class="side-sticky"><div class="side-card" style="background:var(--blue-50);border-color:var(--blue-150)"><h2>Looking for a home?</h2><p class="muted" style="font-size:.93rem">Search thousands of student homes with bills included.</p><a class="btn btn-accent btn-block" href="${href('/student-accommodation')}">${icon('search')}Search homes</a></div><div class="side-card"><h2>Need help?</h2><ul class="side-links"><li><a href="https://help.unihomes.co.uk/">Help centre</a></li><li><a href="${href('/contact')}">Contact us</a></li><li><a href="${href('/about')}">About UniHomes</a></li></ul></div></div></aside>` : ''}
</div></div>`;
  return { title: pg.meta?.title, description: pg.meta?.description, body };
}

export function notFound() {
  const body = `<section class="section" data-404><div class="wrap center" style="max-width:640px;padding:40px 0 80px">
  <div data-404-msg><p style="font-size:4rem;font-weight:900;color:var(--blue);margin:0;line-height:1">404</p><h1>We couldn’t find that page</h1><p class="muted">It may have moved, or this listing has been let. Try a new search:</p></div>
  <div style="text-align:left;margin-top:20px">${searchWidget({ id: 'nf' })}</div>
</div></section>`;
  return { title: 'Page not found | UniHomes', description: '', body, scripts: ['fallback.js'] };
}

export { propertyTitle };

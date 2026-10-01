// Search results page: filters, sort, pagination, map — over live data when
// the proxy is configured, otherwise over the crawled snapshot.
import { card, esc, icon, money, href, img } from './shared/ui.js';
import { bindCards } from './app.js';
import { liveEnabled, liveSearch } from './live.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const UH = window.UH || {};
const PAGE = 24;
const FILTERS = ['type', 'bedrooms', 'bathrooms', 'max-price', 'sort'];
const LABEL = {
  type: { houses: 'Houses & flats', 'private-halls': 'Private halls', 'spare-rooms': 'Spare rooms' },
  sort: { newest: 'Newest', 'price-asc': 'Lowest price', 'price-desc': 'Highest price' },
};

const root = $('[data-results]');
const data = JSON.parse($('#listing-data').textContent);
const grid = $('[data-grid]', root);
const more = $('[data-more]', root);
const countEl = $('[data-count]', root);
const sourceEl = $('[data-source]', root);
const activeEl = $('[data-active]', root);

// ------------------------------------------------------------------ state
const state = Object.fromEntries(FILTERS.map((k) => [k, new URLSearchParams(location.search).get(k) || '']));
let mode = liveEnabled ? 'live' : 'snapshot';
let results = []; // snapshot: full filtered list; live: accumulated pages
let shown = 0;
let liveCount = 0;
let livePage = 0;
let liveMore = false;
let reqId = 0;

// Snapshot data: summaries for this city (shared across the city's pages).
let summaries = null;
async function loadSnapshot() {
  if (summaries) return summaries;
  const res = await fetch(`${UH.base}/assets/data/props/${data.city}.json`);
  summaries = new Map((await res.json()).map((s) => [s.id, s]));
  return summaries;
}

function snapshotResults() {
  let ids = data.ids;
  if (state.type === 'private-halls' && data.variants?.['private-halls']) ids = data.variants['private-halls'];
  if (state.type === 'spare-rooms' && data.variants?.['spare-rooms']) ids = data.variants['spare-rooms'];
  let list = ids.map((id) => summaries.get(id)).filter(Boolean);
  const t = state.type;
  if (t === 'houses') list = list.filter((s) => s.advert !== 'btr' && !/spare/.test(s.advert || ''));
  if (t === 'private-halls' && !data.variants?.['private-halls']) list = list.filter((s) => s.advert === 'btr' || s.btr);
  if (t === 'spare-rooms' && !data.variants?.['spare-rooms']) list = list.filter((s) => /spare/.test(s.advert || ''));
  if (state.bedrooms) {
    const plus = state.bedrooms.endsWith('-plus');
    const n = parseInt(state.bedrooms);
    list = list.filter((s) => (plus ? s.beds >= n : s.beds === n));
  }
  if (state.bathrooms) list = list.filter((s) => (s.baths || 0) >= +state.bathrooms);
  if (state['max-price']) list = list.filter((s) => (s.price || 0) <= +state['max-price']);
  if (state.sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  if (state.sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
  if (state.sort === 'newest') list = [...list].sort((a, b) => Date.parse(b.live || 0) - Date.parse(a.live || 0));
  return list;
}

// ----------------------------------------------------------------- render
const total = () => (mode === 'live' ? liveCount : results.length);

function renderMeta() {
  const n = total();
  countEl.innerHTML = `<strong>${n.toLocaleString('en-GB')}</strong> ${n === 1 ? 'home' : 'homes'} <small>with bills included</small>`;
  sourceEl.classList.toggle('is-live', mode === 'live');
  sourceEl.textContent = mode === 'live' ? 'Live results' : `Snapshot ${new Date(UH.snapshot).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  sourceEl.title = mode === 'live' ? 'Fetched just now from unihomes.co.uk' : 'From the latest crawl of unihomes.co.uk';
  const chips = FILTERS.filter((k) => state[k]).map((k) => {
    const v = state[k];
    const label =
      LABEL[k]?.[v] ||
      (k === 'bedrooms' ? `${v.replace('-plus', '+')} bed${v === '1' ? '' : 's'}` : k === 'bathrooms' ? `${v}+ baths` : k === 'max-price' ? `Up to ${money(v)}` : v);
    return `<button class="af" type="button" data-clear="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)}${icon('x')}</button>`;
  });
  activeEl.innerHTML = chips.join('');
  const fc = $('[data-filter-count]');
  const active = FILTERS.filter((k) => state[k]).length;
  fc.hidden = !active;
  fc.textContent = active;
  $$('[data-f]').forEach((sel) => {
    const v = state[sel.dataset.f];
    // Values from a shared URL may not be one of the presets; add them so the select reflects state.
    if (v && ![...sel.options].some((o) => o.value === v)) {
      const label = sel.dataset.f === 'max-price' ? `Up to ${money(v)} pppw` : v;
      sel.add(new Option(label, v));
    }
    sel.value = v;
    sel.classList.toggle('on', !!state[sel.dataset.f]);
  });
}

function renderMore() {
  const n = total();
  const has = mode === 'live' ? liveMore || shown < results.length : shown < n;
  more.hidden = !has;
  if (has) {
    $('[data-more-label]', more).textContent = `Showing ${shown.toLocaleString('en-GB')} of ${n.toLocaleString('en-GB')}`;
    $('.progress i', more).style.width = `${Math.round((shown / Math.max(n, 1)) * 100)}%`;
  }
}

function append(items, { replace = false } = {}) {
  const html = items.map((s) => card(s)).join('');
  if (replace) grid.innerHTML = html || empty();
  else grid.insertAdjacentHTML('beforeend', html);
  bindCards(grid);
  shown = replace ? items.length : shown + items.length;
  renderMore();
}

const empty = () =>
  `<div class="empty" style="grid-column:1/-1">${icon('search')}<h2>No homes match those filters</h2><p class="muted">Try widening your search.</p><button class="btn btn-outline" type="button" data-clear-all>Clear filters</button></div>`;

function skeleton(n = 6) {
  grid.innerHTML = Array.from({ length: n }, () => '<div class="card skeleton"><div class="card-media"></div><div class="card-body"><div class="sk" style="width:40%"></div><div class="sk" style="width:80%"></div><div class="sk" style="width:60%"></div></div></div>').join('');
}

// ------------------------------------------------------------------ fetch
async function run({ initial = false } = {}) {
  const my = ++reqId;
  syncUrl();
  if (mode === 'live') {
    if (!initial) skeleton();
    try {
      const r = await liveSearch(data.path, state, 1);
      if (my !== reqId) return;
      results = r.items;
      liveCount = r.count;
      livePage = 1;
      liveMore = r.more;
      renderMeta();
      append(results.slice(0, PAGE), { replace: true });
      updateMap();
      return;
    } catch (e) {
      console.warn('Live results unavailable, using snapshot', e);
      mode = 'snapshot';
    }
  }
  await loadSnapshot();
  if (my !== reqId) return;
  results = snapshotResults();
  renderMeta();
  // On first load with no filters the server already rendered page one.
  if (initial && !FILTERS.some((k) => state[k])) {
    shown = grid.querySelectorAll('.card').length;
    renderMore();
  } else {
    append(results.slice(0, PAGE), { replace: true });
  }
  updateMap();
}

async function loadMore() {
  const btn = $('[data-load-more]', more);
  if (mode === 'live') {
    if (shown < results.length) return append(results.slice(shown, shown + PAGE));
    btn.disabled = true;
    try {
      const r = await liveSearch(data.path, state, livePage + 1);
      livePage++;
      const seen = new Set(results.map((s) => s.id));
      const fresh = r.items.filter((s) => !seen.has(s.id));
      liveMore = r.more && r.items.length > 0;
      results = results.concat(fresh);
      append(fresh);
      updateMap();
    } catch {
      liveMore = false;
      renderMore();
    } finally {
      btn.disabled = false;
    }
    return;
  }
  append(results.slice(shown, shown + PAGE));
}

function syncUrl() {
  const q = new URLSearchParams();
  FILTERS.forEach((k) => state[k] && q.set(k, state[k]));
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
}

function set(k, v) {
  if (state[k] === v) return;
  state[k] = v;
  run();
}

// ----------------------------------------------------------------- events
$$('[data-f]').forEach((sel) => sel.addEventListener('change', () => set(sel.dataset.f, sel.value)));
$('[data-load-more]', more).addEventListener('click', loadMore);
root.addEventListener('click', (e) => {
  const c = e.target.closest('[data-clear]');
  if (c) set(c.dataset.clear, '');
  if (e.target.closest('[data-clear-all]')) {
    FILTERS.forEach((k) => (state[k] = ''));
    run();
  }
});
// Infinite-ish scroll: auto-load when the button comes into view (after the first click).
let autoLoad = false;
$('[data-load-more]', more).addEventListener('click', () => (autoLoad = true), { once: true });
new IntersectionObserver((es) => es[0].isIntersecting && autoLoad && !more.hidden && loadMore(), { rootMargin: '400px' }).observe(more);

// Mobile filter sheet
const sheet = $('[data-sheet]');
const openSheet = () => {
  FILTERS.forEach((k) => {
    const r = $(`input[name="s-${k}"][value="${state[k]}"]`, sheet);
    if (r) r.checked = true;
  });
  sheet.hidden = false;
  document.body.style.overflow = 'hidden';
  $('[data-close-sheet]', sheet).focus();
};
const closeSheet = () => {
  sheet.hidden = true;
  document.body.style.overflow = '';
  $('[data-open-filters]').focus();
};
$('[data-open-filters]').addEventListener('click', openSheet);
sheet.addEventListener('click', (e) => (e.target === sheet || e.target.closest('[data-close-sheet]')) && closeSheet());
sheet.addEventListener('keydown', (e) => e.key === 'Escape' && closeSheet());
$('[data-apply-filters]', sheet).addEventListener('click', () => {
  FILTERS.forEach((k) => (state[k] = $(`input[name="s-${k}"]:checked`, sheet)?.value || ''));
  closeSheet();
  run();
});
$('[data-clear-filters]', sheet).addEventListener('click', () => {
  FILTERS.forEach((k) => {
    const r = $(`input[name="s-${k}"][value=""]`, sheet);
    if (r) r.checked = true;
  });
});

// -------------------------------------------------------------------- map
let map = null;
let markerLayer = null;
const LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
const CLUSTER = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3';
const addCss = (h) => document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: h }));
const addJs = (src) =>
  new Promise((resolve, reject) => document.head.appendChild(Object.assign(document.createElement('script'), { src, onload: resolve, onerror: reject })));
async function loadLeaflet() {
  if (window.L?.markerClusterGroup) return window.L;
  addCss(`${LEAFLET}/leaflet.min.css`);
  addCss(`${CLUSTER}/MarkerCluster.min.css`);
  await addJs(`${LEAFLET}/leaflet.min.js`);
  await addJs(`${CLUSTER}/leaflet.markercluster.min.js`);
  return window.L;
}
async function showMap() {
  const L = await loadLeaflet();
  if (!map) {
    map = L.map($('[data-map]'), { scrollWheelZoom: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markerLayer = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 44,
      iconCreateFunction: (c) => L.divIcon({ className: '', html: `<span class="pin pin-cluster">${c.getChildCount()} homes</span>`, iconSize: [0, 0] }),
    }).addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 50);
  updateMap();
}
function updateMap() {
  if (!map || !document.body.classList.contains('view-map')) return;
  const L = window.L;
  markerLayer.clearLayers();
  const pts = (mode === 'live' ? results : results.length ? results : []).filter((s) => s.lat && s.lng).slice(0, 600);
  const bounds = [];
  pts.forEach((s) => {
    const m = L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: '', html: `<span class="pin">${money(s.price)}</span>`, iconSize: [0, 0] }),
      title: `${s.address} — ${money(s.price)} pppw`,
    });
    m.bindPopup(
      `<div class="map-pop"><a href="${href(s.path)}">${s.images?.[0] ? `<img src="${img(s.images[0], 480)}" alt="">` : ''}<div><strong>${money(s.price)}</strong> pppw · ${s.beds} bed<span>${esc(s.address || '')}</span></div></a></div>`,
    );
    m.addTo(markerLayer);
    bounds.push([s.lat, s.lng]);
  });
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
}
$$('[data-view]').forEach((b) =>
  b.addEventListener('click', () => {
    const isMap = b.dataset.view === 'map';
    $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    document.body.classList.toggle('view-map', isMap);
    if (isMap) showMap();
  }),
);

run({ initial: true });

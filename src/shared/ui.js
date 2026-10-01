// Rendering helpers shared by the static build (Node) and the browser
// (live/filtered results). Pure string templates — no DOM, no deps.
import { LIVE_ORIGIN } from './normalize.js';

let BASE = '';
/** Set the path prefix the site is served under (e.g. "/unihomes"). */
export function setBase(b) {
  BASE = (b || '').replace(/\/$/, '');
}
export const base = () => BASE;

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Internal link: "/student-accommodation/leeds" -> "/unihomes/student-accommodation/leeds/". */
export function href(p) {
  if (!p) return BASE + '/';
  if (/^(https?:|mailto:|tel:|#)/.test(p)) return p;
  const [pathPart, q = ''] = p.split('?');
  const [path, hash = ''] = pathPart.split('#');
  const clean = path.replace(/\/+$/, '');
  const slash = /\.[a-z0-9]+$/i.test(clean) ? '' : '/';
  return `${BASE}${clean}${slash}${q ? '?' + q : ''}${hash ? '#' + hash : ''}`;
}

/** Link to the real site, for actions the prototype doesn't own (login, enquire…). */
export const live = (p = '/') => LIVE_ORIGIN + p;

/** Resized CDN image URL for a stored path ("property/123/x.jpg"). */
export function img(path, w = 768) {
  if (!path) return '';
  if (/^https?:/.test(path)) return path;
  return `${LIVE_ORIGIN}/cdn-cgi/image/width=${w},dpr=1,format=auto,quality=75/https://cdn-p1.unihomes.co.uk/${path}`;
}
export const srcset = (path, widths = [384, 768, 1200]) => widths.map((w) => `${img(path, w)} ${w}w`).join(', ');

export const money = (n, dp = 0) =>
  n == null ? '' : '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '';
  const t = new Date(d);
  return isNaN(t) ? String(d) : t.toLocaleDateString('en-GB', opts);
}

// ------------------------------------------------------------------- icons
// Small inline SVG set (Lucide-style strokes) so the site needs no icon font.
const P = {
  bed: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  bath: '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="7" x2="7" y1="19" y2="21"/><line x1="17" x2="17" y1="19" y2="21"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  user: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.859a10 10 0 0 1 14 0M8.5 16.429a5 5 0 0 1 7 0"/>',
  tv: '<rect width="20" height="15" x="2" y="7" rx="2"/><polyline points="17 2 12 7 7 2"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.12 2.12 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.12 2.12 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.12 2.12 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
  key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  graduation: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
};
// Icons reference a shared sprite (assets/img/icons.svg) to keep pages small.
export const icon = (name, cls = '') =>
  `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="${BASE}/assets/img/icons.svg#${name}"/></svg>`;

/** The sprite file contents (written by the build). */
export function iconSprite() {
  return `<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(P)
    .map(([k, v]) => `<symbol id="${k}" viewBox="0 0 24 24">${v}</symbol>`)
    .join('')}</svg>`;
}

// Brand social glyphs (filled).
export const SOCIAL = {
  facebook: '<path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6Z"/>',
  instagram: '<path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/>',
  x: '<path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z"/>',
  tiktok: '<path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.8 5.8 0 1 0 4.9 5.7V9.2a7.4 7.4 0 0 0 4.3 1.4V7.5a4.3 4.3 0 0 1-3.2-1.7Z"/>',
};
export const social = (name) =>
  `<svg class="i" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">${SOCIAL[name]}</svg>`;

// -------------------------------------------------------------- components

export function stars(n, max = 5) {
  let out = '<span class="stars" aria-label="' + n + ' out of 5 stars">';
  for (let i = 1; i <= max; i++) out += `<span class="star${i <= Math.round(n) ? ' on' : ''}">${icon('star')}</span>`;
  return out + '</span>';
}

const TYPE_LABEL = { house: 'House', apartment: 'Apartment', flat: 'Flat', studio: 'Studio' };

export function propertyTitle(s) {
  if (s.name && !/^\d+ bedroom/i.test(s.name)) return s.name;
  return `${s.beds || 1} bed ${(TYPE_LABEL[s.type] || s.type || 'home').toLowerCase()}`;
}

/** Search-results card. `s` is a listingSummary(). */
export function card(s, { eager = false } = {}) {
  const imgs = (s.images || []).slice(0, 5);
  const title = propertyTitle(s);
  const priceLabel = s.from || (s.priceMin && s.priceMax && s.priceMin !== s.priceMax) ? 'from ' : '';
  const isNew = s.live && Date.now() - Date.parse(s.live) < 3 * 864e5;
  const badges = [
    s.featured ? '<span class="badge badge-featured">Featured</span>' : '',
    isNew ? '<span class="badge badge-new">New</span>' : '',
    s.advert === 'btr' ? '<span class="badge">Private halls</span>' : '',
    /spare/.test(s.advert || '') ? '<span class="badge">Spare room</span>' : '',
  ].join('');
  // Only the first photo is real markup; the rest hydrate on first interaction (keeps pages light).
  const slides = imgs.length
    ? imgs
        .map((p, i) =>
          i === 0
            ? `<img src="${img(p, 640)}" srcset="${img(p, 400)} 400w, ${img(p, 640)} 640w" sizes="(min-width: 1200px) 380px, (min-width: 700px) 45vw, 92vw" alt="${esc(title + ' — ' + (s.address || ''))}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" width="640" height="480">`
            : `<img data-p="${esc(p)}" alt="" decoding="async" width="640" height="480">`,
        )
        .join('')
    : `<div class="card-noimg">${icon('home')}</div>`;
  return `<article class="card" data-id="${s.id}">
  <a class="card-link" href="${href(s.path)}" aria-label="${esc(title)}, ${esc(s.address || '')}, ${esc(money(s.price))} per person per week"></a>
  <div class="card-media" data-carousel>
    <div class="card-track">${slides}</div>
    ${imgs.length > 1 ? `<button class="card-nav prev" type="button" aria-label="Previous photo" tabindex="-1">${icon('chevronLeft')}</button><button class="card-nav next" type="button" aria-label="Next photo" tabindex="-1">${icon('chevronRight')}</button><div class="card-dots" aria-hidden="true">${imgs.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>` : ''}
    <div class="card-badges">${badges}</div>
    <a class="card-save" href="${live('/student/shortlist')}" aria-label="Save to shortlist on UniHomes" tabindex="-1">${icon('heart')}</a>
  </div>
  <div class="card-body">
    <div class="card-price"><span class="card-from">${priceLabel}</span><strong>${money(s.price)}</strong><span class="card-unit">pppw</span><span class="pill-bills">${icon('check')}Bills inc.</span></div>
    <h3 class="card-title">${esc(title)}</h3>
    <p class="card-addr">${icon('pin')}<span>${esc(s.address || '')}</span></p>
    <ul class="card-facts">
      <li>${icon('bed')}${plural(s.beds || 0, 'bed')}</li>
      <li>${icon('bath')}${plural(s.baths || 0, 'bath')}</li>
      ${s.available ? `<li class="card-avail">${icon('calendar')}${esc(s.available.replace(/^Available from /, 'From '))}</li>` : ''}
    </ul>
    ${s.incentive ? `<p class="card-incentive">${icon('sparkles')}${esc(s.incentive)}</p>` : ''}
  </div>
</article>`;
}

export function breadcrumb(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items
    .map((c, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(c.name)}</li>`
        : `<li><a href="${href(c.path)}">${esc(c.name)}</a></li>`,
    )
    .join('')}</ol></nav>`;
}

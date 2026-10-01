// Turns live-site HTML into small, whitelisted JSON records.
// Only fields that the live site already shows publicly are kept — internal
// fields embedded in the page JSON (markups, landlord settings, etc.) are dropped
// on purpose because this repo and its data branch are public.
import * as cheerio from 'cheerio';
import vm from 'node:vm';
import { ORIGIN } from './http.mjs';
import { listingSummary, propertyDetail, imgPath, livePath as sharedLivePath } from '../../src/shared/normalize.js';

const CDN_IMG = (path, w = 768) =>
  `${ORIGIN}/cdn-cgi/image/width=${w},dpr=1,format=auto,quality=75/https://cdn-p1.unihomes.co.uk/${path}`;

// ---------------------------------------------------------------- utilities

export const load = (html) => cheerio.load(html, { decodeEntities: true });

const txt = (s) => (s || '').replace(/\s+/g, ' ').trim();

export function pageMeta($) {
  return {
    title: txt($('title').first().text()),
    description: txt($('meta[name="description"]').attr('content')),
    h1: txt($('h1').first().text()),
    image: $('meta[property="og:image"]').attr('content') || null,
  };
}

/** Decode a Vue prop such as `:initial-properties="JSON.parse('…')"`. */
export function vueProp($, name) {
  const raw = $(`[\\:${name}]`).first().attr(`:${name}`);
  if (raw == null) return undefined;
  const v = raw.trim();
  const m = v.match(/^JSON\.parse\(('(?:[^'\\]|\\.)*')\)$/s);
  try {
    if (m) {
      // The argument is a JS single-quoted string literal; evaluate just that
      // literal in an empty sandbox, then parse the JSON it contains.
      const str = vm.runInNewContext(m[1], Object.create(null), { timeout: 1000 });
      return JSON.parse(str);
    }
    return JSON.parse(v);
  } catch {
    return v;
  }
}

export function ldJson($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      const j = JSON.parse($(s).html());
      (Array.isArray(j) ? j : [j]).forEach((x) => out.push(x));
    } catch {}
  });
  return out;
}

export function breadcrumbs($) {
  const bl = ldJson($).find((x) => x['@type'] === 'BreadcrumbList');
  if (!bl) return [];
  return bl.itemListElement.map((i) => ({ name: i.name, href: i.item }));
}

/** Path part of a live URL ("https://www.unihomes.co.uk/a/b" -> "/a/b"). */
export function livePath(href) {
  if (!href) return null;
  try {
    const u = new URL(href, ORIGIN);
    if (u.hostname !== 'www.unihomes.co.uk' && u.hostname !== 'unihomes.co.uk') return null;
    return (u.pathname.replace(/\/+$/, '') || '/') + u.search;
  } catch {
    return null;
  }
}

// ------------------------------------------------------ content sanitising

const ALLOWED = new Set([
  'p', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i', 'br', 'img',
  'figure', 'figcaption', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'iframe',
]);
const DROP = new Set([
  'script', 'style', 'svg', 'form', 'input', 'select', 'textarea', 'nav', 'noscript',
  'header', 'footer', 'template', 'video', 'picture>source', 'link', 'meta',
]);
const BLOCKS = new Set(['p', 'h2', 'h3', 'h4', 'h5', 'ul', 'ol', 'figure', 'blockquote', 'table', 'hr', 'iframe', 'div', 'section']);
const IFRAME_OK = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.instagram\.com|www\.tiktok\.com)\//;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => esc(String(s)).replace(/"/g, '&quot;');

function imgSrc($el) {
  const srcset = $el.attr('srcset') || $el.attr('data-srcset');
  if (srcset) {
    const first = srcset.split(',')[0].trim().split(/\s+/)[0];
    if (first && !first.startsWith('data:')) return first;
  }
  const s = $el.attr('data-src') || $el.attr('src');
  return s && !s.startsWith('data:') ? s : null;
}

export function sanitize($, root) {
  const walk = (node) => {
    if (node.type === 'text') return esc(node.data);
    if (node.type !== 'tag') return '';
    const tag = node.tagName.toLowerCase();
    if (DROP.has(tag)) return '';
    const $n = $(node);
    if ($n.attr('aria-hidden') === 'true' && tag !== 'img') return '';
    const inner = () => node.children.map(walk).join('');

    if (tag === 'h1') return `<h2>${inner()}</h2>`;
    // Accordion triggers (FAQ questions) live in buttons; keep meaningful ones as headings.
    if (tag === 'button') {
      const t = txt($n.text());
      return t.length > 15 ? `<h4>${esc(t)}</h4>` : '';
    }
    if (!ALLOWED.has(tag)) {
      const html = inner();
      // An unwrapped div that held only inline text becomes a paragraph.
      const hasBlock = node.children.some((c) => c.type === 'tag' && BLOCKS.has(c.tagName.toLowerCase()));
      if ((tag === 'div' || tag === 'section') && !hasBlock && txt(html.replace(/<[^>]+>/g, ''))) return `<p>${html}</p>`;
      return html;
    }
    if (tag === 'img') {
      const src = imgSrc($n);
      if (!src || /pixel|spacer|1x1/.test(src)) return '';
      return `<img src="${escAttr(new URL(src, ORIGIN).href)}" alt="${escAttr($n.attr('alt') || '')}" loading="lazy">`;
    }
    if (tag === 'iframe') {
      const src = $n.attr('src') || $n.attr('data-src') || '';
      if (!IFRAME_OK.test(src)) return '';
      return `<div class="embed"><iframe src="${escAttr(src)}" loading="lazy" allowfullscreen title="Embedded media"></iframe></div>`;
    }
    if (tag === 'a') {
      const href = $n.attr('href');
      if (!href || href.startsWith('javascript:')) return inner();
      const abs = href.startsWith('mailto:') || href.startsWith('tel:') ? href : new URL(href, ORIGIN).href;
      return `<a href="${escAttr(abs)}">${inner()}</a>`;
    }
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    if (tag === 'td' || tag === 'th') {
      const span = $n.attr('colspan');
      return `<${tag}${span ? ` colspan="${escAttr(span)}"` : ''}>${inner()}</${tag}>`;
    }
    return `<${tag}>${inner()}</${tag}>`;
  };
  let html = $(root)
    .toArray()
    .map((n) => n.children.map(walk).join(''))
    .join('');
  // Tidy: drop empty paragraphs/headings, collapse whitespace, unwrap bold-only headings.
  for (let i = 0; i < 3; i++) {
    html = html
      .replace(/<(p|h2|h3|h4|h5|li|strong|b|em|i)>\s*(?:&nbsp;| |<br>)*\s*<\/\1>/g, '')
      .replace(/<(h[2-5])>\s*<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>\s*<\/\1>/g, '<$1>$2</$1>');
  }
  return html.replace(/\n\s*\n+/g, '\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/** Element with the densest run of direct paragraph/heading children. */
export function densest($, scope = 'body') {
  let best = null;
  let score = 0;
  $(scope)
    .find('article,div,section,main')
    .each((_, e) => {
      const $e = $(e);
      const s = $e.children('p').length + 0.6 * $e.children('h2,h3,h4,ul,ol').length;
      if (s > score) {
        score = s;
        best = e;
      }
    });
  return best;
}

// ----------------------------------------------------------------- listings

export { listingSummary };

/** Parse a listing (city / area / near-uni / bedrooms) HTML page. */
export function listingPage($) {
  const meta = pageMeta($);
  // The SEO copy block that sits under the results ("Student Houses in Beeston…").
  const guide = $('[class*="guide-content"]').first();
  const intro = guide.length ? sanitize($, guide) : '';
  const props = vueProp($, 'initial-properties');
  return {
    meta,
    breadcrumbs: breadcrumbs($),
    intro,
    count: Number(vueProp($, 'initial-property-count')) || 0,
    hasMore: !!vueProp($, 'initial-properties-has-more-pages'),
    first: Array.isArray(props) ? props : [],
    heading: txt($('h2').first().text()) || meta.h1,
  };
}

// --------------------------------------------------------------- properties

export function propertyPage($) {
  const p = vueProp($, 'property');
  if (!p || typeof p !== 'object') return null;
  return propertyDetail(p, vueProp($, 'rooms'), {
    householdPcm: vueProp($, 'total-house-price-per-month'),
    showRoomTypes: vueProp($, 'show-room-types'),
    bookable: vueProp($, 'is-bookable'),
    meta: pageMeta($),
    breadcrumbs: breadcrumbs($),
  });
}

export { CDN_IMG };

// --------------------------------------------------------------- blog posts

export function blogPost($) {
  const meta = pageMeta($);
  const art = $('article.post').first();
  const scope = art.length ? art : $('main').first();
  const head = txt(scope.find('h4').first().text());
  const date = (head.match(/\d{1,2} [A-Z][a-z]+ \d{4}/) || [])[0] || null;
  const read = (head.match(/(\d+) min read/) || [])[1] || null;
  const body = densest($, scope);
  const $body = $(body);
  $body.find('[class*="recent"], [class*="related"], [class*="share"]').remove();
  return {
    meta,
    title: meta.h1,
    date,
    readMins: read ? Number(read) : null,
    image: imgPath(meta.image) || null,
    html: body ? sanitize($, body) : '',
  };
}

/** Blog index pages: cards with title, excerpt, date, image, category. */
export function blogIndex($) {
  const posts = [];
  $('a[href*="/blog/"]').each((_, a) => {
    const $a = $(a);
    const href = livePath($a.attr('href'));
    const h3 = txt($a.find('h3').first().text());
    if (!href || !h3 || href.split('/').length !== 3) return;
    const h4 = txt($a.find('h4').first().text());
    const img = $a.find('img').first();
    posts.push({
      path: href,
      title: h3,
      excerpt: txt($a.find('p').first().text()),
      date: (h4.match(/\d{1,2} [A-Z][a-z]+ \d{4}/) || [])[0] || null,
      readMins: Number((h4.match(/(\d+) min read/) || [])[1]) || null,
      image: imgPath(img.length ? imgSrc(img) : null),
    });
  });
  const categories = [];
  $('a[href*="/blog/category/"], a[href*="category="]').each((_, a) => {
    const name = txt($(a).text());
    if (name) categories.push({ name, href: livePath($(a).attr('href')) });
  });
  return { posts, categories };
}

// ---------------------------------------------------------------- city guide

export function cityGuide($) {
  const meta = pageMeta($);
  const main = $('main').first();
  const sections = [];
  main.find('.guide-body').first().children().each((_, el) => {
    const $el = $(el);
    const text = txt($el.text());
    if (text.length < 120 || /^(new homes|more new homes|blog posts|what students|view \d+)/i.test(text)) return;
    const h = $el.find('h1,h2,h3').first();
    const title = txt(h.text());
    const clone = $el.clone();
    clone.find('h1,h2,h3').first().remove();
    clone.find('a[href*="/property/"]').remove();
    const html = sanitize($, clone);
    if (html.replace(/<[^>]+>/g, '').trim().length < 60) return;
    sections.push({ kind: title ? (/frequently asked/i.test(title) ? 'faq' : 'copy') : 'quote', title, html });
  });
  const unis = [];
  main.find('a[href*="/near-"]').each((_, a) => {
    const name = txt($(a).text());
    if (name) unis.push({ name, href: livePath($(a).attr('href')) });
  });
  const posts = [];
  main.find('a[href*="/blog/"]').each((_, a) => {
    const t = txt($(a).find('h3,h4,p').first().text()) || txt($(a).text());
    const href = livePath($(a).attr('href'));
    if (t && href && href.split('/').length === 3) posts.push({ title: t, path: href });
  });
  const video = (main.find('iframe[src*="youtube"]').first().attr('src') || '').match(/embed\/([\w-]+)/)?.[1] || null;
  return {
    meta,
    city: meta.h1,
    hero: $('[style*="background-image"]').first().attr('style')?.match(/url\(['"]?([^'")]+)/)?.[1] || meta.image,
    sections: dedupe(sections, (s) => s.html),
    universities: dedupe(unis, (u) => u.href),
    posts: dedupe(posts, (p) => p.path).slice(0, 6),
    video,
  };
}

// --------------------------------------------------------------- generic page

export function genericPage($) {
  const meta = pageMeta($);
  $('header, footer, nav, [class*="cookie"], [id*="cookie"], [class*="trustpilot"], [class*="newsletter"]').remove();
  const main = $('main').length ? $('main').first() : $('body');
  // Prefer the densest article-like block; fall back to the whole main.
  const best = densest($, main);
  const html = sanitize($, best && $(best).text().length > main.text().length * 0.4 ? best : main);
  return { meta, html };
}

function dedupe(arr, key) {
  const seen = new Set();
  return arr.filter((x) => {
    const k = key(x);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

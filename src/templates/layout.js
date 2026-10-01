import { esc, href, live, icon, social, stars, base } from '../shared/ui.js';

const NAV = [
  {
    label: 'Student accommodation',
    items: [
      { label: 'All cities', path: '/student-accommodation', desc: 'Browse every UniHomes city' },
      { label: 'Student houses', path: '/student-accommodation', desc: 'Shared houses with bills included' },
      { label: 'Private halls', path: '/private-halls', desc: 'Studios & en-suites in purpose-built blocks' },
      { label: 'Spare rooms', path: '/spare-rooms', desc: 'Single rooms in existing student homes', tag: 'New' },
    ],
  },
  {
    label: 'Blogs & guides',
    items: [
      { label: 'Latest posts', path: '/blog', desc: 'Tips, advice & student life' },
      { label: 'City guides', path: '/city-guides', desc: 'What it’s really like to live there' },
    ],
  },
  { label: 'Student bills', path: '/shared-student-utility-bills' },
  {
    label: 'Partner with us',
    items: [
      { label: 'Letting agents', path: '/partner-with-us', desc: 'Advertise student properties for free' },
      { label: 'PBSA / BTR operators', path: '/partner-with-us-pbsa', desc: 'Turn searches into secured bookings' },
    ],
  },
];

const FOOTER = [
  ['Students', [['Accommodation', '/student-accommodation'], ['Private halls', '/private-halls'], ['Spare rooms', '/spare-rooms'], ['Utilities', '/shared-student-utility-bills'], ['Blog', '/blog'], ['City guides', '/city-guides'], ['Help centre', 'https://help.unihomes.co.uk/']]],
  ['Partners', [['Letting agents', '/partner-with-us'], ['PBSA/BTR operators', '/partner-with-us-pbsa'], ['Brand ambassadors', '/ambassador'], ['Content ambassadors', '/content-ambassador-programme']]],
  ['UniHomes', [['About', '/about'], ['Careers', '/careers'], ['Community', live('/community')], ['Contact us', '/contact']]],
  ['Legal', [['Privacy & cookie policy', '/privacy-and-cookie-policies'], ['Website terms', '/website-terms'], ['Responsible use policy', 'https://cdn-p0.unihomes.co.uk/files/responsible-energy-use-policy.pdf'], ['Code of conduct', 'https://cdn-p1.unihomes.co.uk/documents/legal/Code_of_Conduct.pdf'], ['Modern slavery statement', 'https://cdn-p0.unihomes.co.uk/files/modern-slavery-statement.pdf']]],
];

const SOCIALS = [
  ['facebook', 'https://www.facebook.com/unihomes.co.uk', 'Facebook'],
  ['instagram', 'https://www.instagram.com/unihomes/', 'Instagram'],
  ['x', 'https://twitter.com/unihomes', 'X (Twitter)'],
  ['tiktok', 'https://www.tiktok.com/@unihomes', 'TikTok'],
];

const ext = (u) => /^https?:/.test(u);
const a = (label, u, cls = '') =>
  `<a${cls ? ` class="${cls}"` : ''} href="${href(u)}"${ext(u) ? ' rel="noopener"' : ''}>${esc(label)}</a>`;

function header(current) {
  const desktop = NAV.map((n, i) =>
    n.items
      ? `<li class="nav-item has-menu">
          <button class="nav-btn" type="button" aria-expanded="false" aria-controls="menu-${i}">${esc(n.label)}${icon('chevronDown', 'caret')}</button>
          <div class="nav-menu" id="menu-${i}" hidden><ul>${n.items
            .map(
              (it) =>
                `<li><a href="${href(it.path)}"><span class="nm-label">${esc(it.label)}${it.tag ? ` <em class="tag">${it.tag}</em>` : ''}</span><span class="nm-desc">${esc(it.desc)}</span></a></li>`,
            )
            .join('')}</ul></div>
        </li>`
      : `<li class="nav-item"><a class="nav-btn${current === n.path ? ' active' : ''}" href="${href(n.path)}">${esc(n.label)}</a></li>`,
  ).join('');

  const mobile = NAV.map((n) =>
    n.items
      ? `<details class="mnav-group"><summary>${esc(n.label)}${icon('chevronDown', 'caret')}</summary><ul>${n.items.map((it) => `<li>${a(it.label, it.path)}</li>`).join('')}</ul></details>`
      : `<div class="mnav-group">${a(n.label, n.path, 'mnav-link')}</div>`,
  ).join('');

  return `<header class="site-header" data-header>
  <div class="wrap header-inner">
    <a class="brand" href="${href('/')}" aria-label="UniHomes home"><img src="${base()}/assets/img/logo-blue.svg" alt="UniHomes" width="150" height="33"></a>
    <nav class="nav-desktop" aria-label="Main"><ul>${desktop}</ul></nav>
    <div class="header-actions">
      <a class="btn btn-ghost btn-sm hide-sm" href="${live('/account/login')}">${icon('user')}<span>Log in</span></a>
      <a class="btn btn-soft btn-sm hide-sm" href="${live('/student/shortlist')}">${icon('heart')}<span>Shortlist</span></a>
      <button class="icon-btn nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mnav" data-nav-toggle>${icon('menu')}</button>
    </div>
  </div>
  <div class="mnav" id="mnav" hidden data-mnav>
    <div class="mnav-panel" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="mnav-head">
        <img src="${base()}/assets/img/logo-blue.svg" alt="UniHomes" width="130" height="29">
        <button class="icon-btn" type="button" aria-label="Close menu" data-nav-close>${icon('x')}</button>
      </div>
      <nav aria-label="Mobile">${mobile}</nav>
      <div class="mnav-actions">
        <a class="btn btn-primary btn-block" href="${href('/student-accommodation')}">${icon('search')}Find a home</a>
        <a class="btn btn-outline btn-block" href="${live('/account/login')}">${icon('user')}Log in</a>
        <a class="btn btn-outline btn-block" href="${live('/student/shortlist')}">${icon('heart')}My shortlist</a>
      </div>
    </div>
  </div>
</header>`;
}

function footer(site) {
  const r = site?.reviews;
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div class="footer-brand">
        <img src="${base()}/assets/img/logo.svg" alt="UniHomes" width="160" height="35" loading="lazy">
        <p>The home of stress-free student living. Compare thousands of student homes across the UK — every one with bills included.</p>
        ${r ? `<a class="tp-mini" href="${esc(r.url)}" rel="noopener">${stars(r.stars || 5)}<span><strong>${esc(r.score)}</strong> on Trustpilot · ${Number(r.total).toLocaleString('en-GB')} reviews</span></a>` : ''}
        <ul class="socials">${SOCIALS.map(([k, u, l]) => `<li><a href="${u}" rel="noopener" aria-label="${l}">${social(k)}</a></li>`).join('')}</ul>
      </div>
      <div class="footer-cols">
        ${FOOTER.map(([h, links]) => `<div class="footer-col"><h2>${h}</h2><ul>${links.map(([l, u]) => `<li>${a(l, u)}</li>`).join('')}</ul></div>`).join('')}
      </div>
    </div>
    <div class="footer-alerts">
      <div><h2>Get property alerts for your city</h2><p>Be first to hear about new bills-included homes.</p></div>
      <a class="btn btn-accent" href="${live('/')}#footer-mailing-list">Sign up on UniHomes ${icon('arrowRight')}</a>
    </div>
    <div class="footer-base">
      <p>© ${new Date().getFullYear()} UniHomes. All rights reserved.</p>
      <p class="poc-note">Design concept preview · content mirrored from <a href="${live('/')}">unihomes.co.uk</a></p>
    </div>
  </div>
</footer>`;
}

/**
 * Full HTML document.
 * SEO safety: every page is noindex/nofollow and canonicalises to the live
 * URL, so the prototype can never compete with (or dilute) unihomes.co.uk.
 */
export function page({ path, title, description, body, site, current, bodyClass = '', head = '', scripts = [], config = {} }) {
  const canonical = live(path === '/' ? '/' : path);
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title || 'UniHomes')}</title>
<meta name="description" content="${esc(description || '')}">
<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">
<meta name="googlebot" content="noindex, nofollow">
<link rel="canonical" href="${esc(canonical)}">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#1BA2DC">
<meta name="format-detection" content="telephone=no">
<link rel="icon" type="image/png" sizes="32x32" href="${base()}/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="${base()}/assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://www.unihomes.co.uk" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap">
<link rel="stylesheet" href="${base()}/assets/css/site.css?v=${config.version || ''}">
<script>window.UH=${JSON.stringify({ base: base(), live: config.liveApi || '', snapshot: config.snapshot || '', version: config.version || '' })};document.documentElement.classList.add('js')</script>
${head}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">Skip to content</a>
<div class="poc-bar" data-poc-bar><div class="wrap"><span>${icon('sparkles')}<strong>Design preview</strong> — a concept refresh of UniHomes. Listings mirrored from the live site.</span><a href="${esc(canonical)}">View live page ${icon('external')}</a><button type="button" class="poc-close" aria-label="Dismiss" data-poc-close>${icon('x')}</button></div></div>
${header(current)}
<main id="main">${body}</main>
${footer(site)}
<script type="module" src="${base()}/assets/js/app.js?v=${config.version || ''}"></script>
${scripts.map((s) => `<script type="module" src="${base()}/assets/js/${s}?v=${config.version || ''}"></script>`).join('\n')}
</body>
</html>`;
}

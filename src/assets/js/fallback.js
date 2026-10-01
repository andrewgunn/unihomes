// 404 handler. GitHub Pages serves this for any path we didn't pre-render.
// Properties that appeared after the last crawl are fetched live (via the
// proxy) and rendered with the same template as mirrored ones.
import { href, live as liveUrl, icon, esc } from './shared/ui.js';
import { liveEnabled, liveProperty } from './live.js';

const UH = window.UH || {};
const path = location.pathname.slice((UH.base || '').length).replace(/\/+$/, '') || '/';
const main = document.getElementById('main');
const msg = document.querySelector('[data-404-msg]');

async function run() {
  if (path.startsWith('/property/')) {
    if (liveEnabled) {
      msg.innerHTML = `<p class="muted" style="padding:60px 0">${icon('home')} Loading this home from unihomes.co.uk…</p>`;
      try {
        const p = await liveProperty(path);
        if (p && p.id) {
          const [{ property }, { initGallery, initMap }, { bindCards }] = await Promise.all([
            import('./templates/pages.js'),
            import('./property.js'),
            import('./app.js'),
          ]);
          const r = property({ p: { ...p, path }, similar: [], rewrite: (h) => h });
          document.title = r.title;
          main.innerHTML = r.body;
          document.body.classList.add('page-property', 'has-mobile-cta');
          initGallery();
          initMap();
          bindCards(main);
          return;
        }
      } catch (e) {
        console.warn('live property failed', e);
      }
    }
    msg.innerHTML = `<p style="font-size:3rem;margin:0;color:var(--blue)">${icon('home')}</p><h1>This home isn’t in the preview yet</h1><p class="muted">It was listed after the latest snapshot. You can view it on the live site:</p><p><a class="btn btn-accent" href="${esc(liveUrl(path))}">View on unihomes.co.uk ${icon('external')}</a></p>`;
    return;
  }
  // Unknown listing variants, renamed pages, etc. — offer the live equivalent.
  msg.insertAdjacentHTML('beforeend', `<p><a class="link-arrow" href="${esc(liveUrl(path + location.search))}">Try this page on unihomes.co.uk ${icon('arrowRight')}</a> · <a class="link-arrow" href="${href('/')}">Go home</a></p>`);
}
run();

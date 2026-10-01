// Property page: gallery lightbox + location map.
import { icon } from './shared/ui.js';

const $ = (s, r = document) => r.querySelector(s);

export function initGallery() {
  const g = $('[data-gallery]');
  const data = $('#gallery-data');
  if (!g || !data) return;
  const photos = JSON.parse(data.textContent);
  let lb = null;
  let last = null;
  const open = (i) => {
    last = document.activeElement;
    lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Photo gallery');
    lb.innerHTML = `<div class="lb-top"><span data-lb-count>${i + 1} / ${photos.length}</span><button class="icon-btn" type="button" aria-label="Close gallery" data-lb-close>${icon('x')}</button></div>
      <div class="lb-track">${photos.map((src, j) => `<figure><img src="${src}" alt="Photo ${j + 1} of ${photos.length}" ${Math.abs(j - i) > 1 ? 'loading="lazy"' : ''}></figure>`).join('')}</div>
      <button class="lb-nav prev" type="button" aria-label="Previous photo">${icon('chevronLeft')}</button><button class="lb-nav next" type="button" aria-label="Next photo">${icon('chevronRight')}</button>`;
    document.body.appendChild(lb);
    document.body.style.overflow = 'hidden';
    const track = $('.lb-track', lb);
    const count = $('[data-lb-count]', lb);
    requestAnimationFrame(() => (track.scrollLeft = i * track.clientWidth));
    const go = (d) => track.scrollBy({ left: d * track.clientWidth, behavior: 'smooth' });
    track.addEventListener('scroll', () => (count.textContent = `${Math.round(track.scrollLeft / track.clientWidth) + 1} / ${photos.length}`), { passive: true });
    $('.lb-nav.prev', lb).onclick = () => go(-1);
    $('.lb-nav.next', lb).onclick = () => go(1);
    $('[data-lb-close]', lb).onclick = close;
    lb.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    });
    $('[data-lb-close]', lb).focus();
  };
  const close = () => {
    lb?.remove();
    lb = null;
    document.body.style.overflow = '';
    last?.focus();
  };
  g.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open]');
    if (b) open(+b.dataset.open);
  });
}

export function initMap() {
  const el = $('[data-prop-map]');
  if (!el) return;
  const io = new IntersectionObserver(async (es) => {
    if (!es[0].isIntersecting) return;
    io.disconnect();
    const base = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';
    if (!window.L) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = `${base}/leaflet.min.css`;
      document.head.appendChild(css);
      await new Promise((r, j) => {
        const s = document.createElement('script');
        s.src = `${base}/leaflet.min.js`;
        s.onload = r;
        s.onerror = j;
        document.head.appendChild(s);
      });
    }
    const L = window.L;
    const ll = [+el.dataset.lat, +el.dataset.lng];
    const map = L.map(el, { scrollWheelZoom: false }).setView(ll, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
    L.circle(ll, { radius: 120, color: '#1ba2dc', weight: 2, fillColor: '#1ba2dc', fillOpacity: 0.2 }).addTo(map);
  }, { rootMargin: '300px' });
  io.observe(el);
}

initGallery();
initMap();

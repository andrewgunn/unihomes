// Site-wide behaviour: header, nav, autocomplete search, carousels, rails, tabs.
import { setBase, href, esc, icon, img } from './shared/ui.js';

const UH = window.UH || {};
setBase(UH.base || '');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k) {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch {}
  },
};

// ------------------------------------------------------------ preview bar
const bar = $('[data-poc-bar]');
if (bar && store.get('uh-poc-dismissed') === '1') bar.hidden = true;
$('[data-poc-close]')?.addEventListener('click', () => {
  bar.hidden = true;
  store.set('uh-poc-dismissed', '1');
});

// ----------------------------------------------------------------- header
const header = $('[data-header]');
const onScroll = () => header?.classList.toggle('scrolled', scrollY > 4);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Desktop dropdowns
$$('.nav-item.has-menu').forEach((item) => {
  const btn = $('.nav-btn', item);
  const menu = $('.nav-menu', item);
  let t;
  const open = (v) => {
    btn.setAttribute('aria-expanded', String(v));
    menu.hidden = !v;
  };
  btn.addEventListener('click', () => open(btn.getAttribute('aria-expanded') !== 'true'));
  item.addEventListener('mouseenter', () => { clearTimeout(t); open(true); });
  item.addEventListener('mouseleave', () => { t = setTimeout(() => open(false), 120); });
  item.addEventListener('keydown', (e) => e.key === 'Escape' && (open(false), btn.focus()));
  item.addEventListener('focusout', (e) => !item.contains(e.relatedTarget) && open(false));
});

// Mobile drawer
const mnav = $('[data-mnav]');
const toggle = $('[data-nav-toggle]');
const setNav = (v) => {
  mnav.hidden = !v;
  toggle.setAttribute('aria-expanded', String(v));
  document.body.classList.toggle('nav-open', v);
  if (v) $('[data-nav-close]', mnav).focus();
  else toggle.focus();
};
toggle?.addEventListener('click', () => setNav(true));
mnav?.addEventListener('click', (e) => (e.target === mnav || e.target.closest('[data-nav-close]')) && setNav(false));
addEventListener('keydown', (e) => e.key === 'Escape' && mnav && !mnav.hidden && setNav(false));

// ----------------------------------------------------------- autocomplete
let locations = null;
async function loadLocations() {
  if (locations) return locations;
  const res = await fetch(`${UH.base}/assets/data/locations.json`);
  const rows = await res.json();
  locations = rows.map(([type, slug, name, city, total, searches]) => ({ type, slug, name, city, total, searches, key: name.toLowerCase() }));
  return locations;
}
const KIND = { city: ['City', 'building'], university: ['University', 'graduation'], area: ['Area', 'pin'] };
const RANK = { city: 0, university: 1, area: 2 };

function match(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    return locations.filter((l) => l.type === 'city').sort((a, b) => b.searches - a.searches).slice(0, 8);
  }
  const words = q.split(/\s+/);
  return locations
    .map((l) => {
      const name = l.key;
      const cityName = l.type !== 'city' ? l.city : '';
      const hay = name + ' ' + cityName;
      if (!words.every((w) => hay.includes(w))) return null;
      const score = (name.startsWith(q) ? 0 : name.split(/[\s,-]+/).some((p) => p.startsWith(words[0])) ? 1 : 2) * 10 + RANK[l.type];
      return { l, score };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score || (b.l.total || 0) - (a.l.total || 0))
    .slice(0, 9)
    .map((x) => x.l);
}

export function locationPath(l) {
  if (l.type === 'city') return `/student-accommodation/${l.slug}`;
  if (l.type === 'university') return `/student-accommodation/${l.city}/near-${l.slug}`;
  return `/student-accommodation/${l.city}/${l.slug}`;
}
const cityName = (slug) => locations?.find((x) => x.type === 'city' && x.slug === slug)?.name || '';

function highlight(name, q) {
  if (!q) return esc(name);
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  return i < 0 ? esc(name) : esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
}

function setupAutocomplete(input) {
  const list = document.getElementById(input.getAttribute('aria-controls'));
  let items = [];
  let active = -1;
  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  };
  const choose = (l) => {
    input.value = l.type === 'area' ? `${l.name}, ${cityName(l.city)}` : l.name;
    Object.assign(input.dataset, { slug: l.slug, kind: l.type, city: l.city });
    close();
    input.closest('.field')?.classList.remove('field-error');
    input.dispatchEvent(new CustomEvent('uh:location', { bubbles: true, detail: l }));
  };
  const render = async () => {
    await loadLocations();
    const q = input.value;
    items = match(q);
    active = -1;
    if (!items.length) {
      list.innerHTML = `<li class="ac-head" role="presentation">No matching cities or universities</li>`;
    } else {
      list.innerHTML =
        (q.trim() ? '' : '<li class="ac-head" role="presentation">Popular cities</li>') +
        items
          .map((l, i) => {
            const [label, ic] = KIND[l.type];
            const sub = l.type === 'city' ? label : `${label} · ${cityName(l.city)}`;
            return `<li role="option" id="${list.id}-${i}" data-i="${i}" aria-selected="false"><span class="ac-ico">${icon(ic)}</span><span class="ac-main"><span class="ac-name">${highlight(l.name, q.trim())}</span><span class="ac-sub">${esc(sub)}</span></span>${l.total ? `<span class="ac-count">${l.total.toLocaleString('en-GB')}</span>` : ''}</li>`;
          })
          .join('');
    }
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };
  const move = (d) => {
    if (!items.length) return;
    active = (active + d + items.length) % items.length;
    $$('[role=option]', list).forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    input.setAttribute('aria-activedescendant', `${list.id}-${active}`);
    $(`#${list.id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  };
  input.addEventListener('focus', () => { input.select(); render(); });
  input.addEventListener('input', () => {
    delete input.dataset.slug;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); list.hidden ? render() : move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Escape') close();
    else if (e.key === 'Enter') {
      if (!list.hidden && items.length) {
        e.preventDefault();
        choose(items[active >= 0 ? active : 0]);
      }
    }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => {
    const li = e.target.closest('[data-i]');
    if (li) choose(items[+li.dataset.i]);
  });
  input.addEventListener('blur', () => setTimeout(close, 100));
  return { choose, firstMatch: async () => (await loadLocations(), match(input.value)[0]) };
}

// Search forms (home hero, landing pages, 404)
$$('[data-search]').forEach((form) => {
  const input = $('[data-ac]', form);
  const ac = setupAutocomplete(input);
  const typeInput = $('input[name=type]', form);
  $$('.search-tab', form).forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.search-tab', form).forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      typeInput.value = tab.dataset.type;
    }),
  );
  // Choosing a location from the list jumps straight to results.
  input.addEventListener('uh:location', () => form.requestSubmit());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let l = input.dataset.slug ? { slug: input.dataset.slug, type: input.dataset.kind, city: input.dataset.city } : await ac.firstMatch();
    if (!l) {
      input.closest('.field').classList.add('field-error');
      input.focus();
      return;
    }
    const q = new URLSearchParams();
    if (typeInput.value) q.set('type', typeInput.value);
    const beds = $('[name=bedrooms]', form)?.value;
    const price = $('[name="max-price"]', form)?.value;
    if (beds) q.set('bedrooms', beds);
    if (price) q.set('max-price', price);
    location.href = href(locationPath(l) + (q.toString() ? '?' + q : ''));
  });
});

// Listing page location box navigates on choose.
$$('[data-ac][data-navigate]').forEach((input) => {
  setupAutocomplete(input);
  input.addEventListener('uh:location', (e) => {
    const q = new URLSearchParams(location.search);
    q.delete('page');
    location.href = href(locationPath(e.detail) + (q.toString() ? '?' + q : ''));
  });
});

// ------------------------------------------------------- card carousels
export function bindCards(root = document) {
  $$('.card', root).forEach((c) => {
    if (c.dataset.bound) return;
    c.dataset.bound = '1';
    const track = $('.card-track', c);
    const dots = $$('.card-dots i', c);
    const link = $('.card-link', c);
    if (!track) return;
    const hydrate = () => {
      $$('img[data-p]', track).forEach((im) => {
        im.srcset = `${img(im.dataset.p, 400)} 400w, ${img(im.dataset.p, 640)} 640w`;
        im.sizes = '(min-width: 1200px) 380px, (min-width: 700px) 45vw, 92vw';
        im.src = img(im.dataset.p, 640);
        im.removeAttribute('data-p');
      });
    };
    ['pointerenter', 'touchstart', 'focusin'].forEach((ev) => c.addEventListener(ev, hydrate, { once: true, passive: true }));
    const go = (d) => (hydrate(), track.scrollBy({ left: d * track.clientWidth, behavior: 'smooth' }));
    $('.card-nav.prev', c)?.addEventListener('click', (e) => { e.preventDefault(); go(-1); });
    $('.card-nav.next', c)?.addEventListener('click', (e) => { e.preventDefault(); go(1); });
    // Taps on the photo open the property (the track sits above the card link so it can swipe).
    track.addEventListener('click', () => (location.href = link.href));
    if (dots.length) {
      let raf;
      track.addEventListener(
        'scroll',
        () => {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(() => {
            const i = Math.round(track.scrollLeft / track.clientWidth);
            dots.forEach((d, j) => d.classList.toggle('on', j === i));
          });
        },
        { passive: true },
      );
    }
  });
}
bindCards();

// ---------------------------------------------------------------- rails
$$('.rail-wrap').forEach((w) => {
  const rail = $('[data-rail]', w);
  const prev = $('.rail-btn.prev', w);
  const next = $('.rail-btn.next', w);
  if (!rail || !prev) return;
  const update = () => {
    prev.disabled = rail.scrollLeft < 8;
    next.disabled = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
  };
  prev.addEventListener('click', () => rail.scrollBy({ left: -rail.clientWidth * 0.9, behavior: 'smooth' }));
  next.addEventListener('click', () => rail.scrollBy({ left: rail.clientWidth * 0.9, behavior: 'smooth' }));
  rail.addEventListener('scroll', update, { passive: true });
  update();
});

// ----------------------------------------------------------------- tabs
$$('[role=tablist].tabs').forEach((tl) => {
  const tabs = $$('[role=tab]', tl);
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    panel && $$('.rail-wrap', panel.parentNode).forEach((w) => w.querySelector('[data-rail]')?.dispatchEvent(new Event('scroll')));
  };
  tabs.forEach((t, i) => {
    t.tabIndex = i === 0 ? 0 : -1;
    t.addEventListener('click', () => select(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) {
        const n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus();
        select(n);
      }
    });
  });
});

// ------------------------------------------------------------- read more
$$('[data-expand]').forEach((btn) => {
  const box = btn.previousElementSibling;
  if (!box?.matches('[data-collapse]')) return;
  if (box.scrollHeight <= box.clientHeight + 40) {
    box.classList.remove('collapsed');
    btn.remove();
    return;
  }
  btn.addEventListener('click', () => {
    const open = box.classList.toggle('collapsed');
    btn.innerHTML = open ? `Read more ${icon('chevronDown')}` : `Show less ${icon('chevronDown').replace('class="i ', 'class="i " style="transform:rotate(180deg)" ')}`;
  });
});

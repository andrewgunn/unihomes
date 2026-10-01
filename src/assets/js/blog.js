// Blog index: instant search + load more over the embedded post list.
import { href, img, esc } from './shared/ui.js';

const posts = JSON.parse(document.getElementById('blog-data').textContent);
const grid = document.querySelector('[data-blog-grid]');
const more = document.querySelector('[data-blog-more]');
const input = document.querySelector('[data-blog-search]');
const STEP = 12;
let list = posts;
let shown = grid.children.length;

const cardHtml = (b) => `<article class="post">
  <div class="post-img">${b.image ? `<img src="${img(b.image, 640)}" alt="" loading="lazy" width="640" height="360">` : ''}</div>
  <div class="post-body"><div class="post-meta">${b.date ? `<span>${esc(b.date)}</span>` : ''}${b.readMins ? `<span>${b.readMins} min read</span>` : ''}</div>
  <h3><a href="${href(b.path)}">${esc(b.title)}</a></h3>${b.excerpt ? `<p>${esc(b.excerpt)}</p>` : ''}</div></article>`;

const update = () => (more.hidden = shown >= list.length);
more.querySelector('button').addEventListener('click', () => {
  grid.insertAdjacentHTML('beforeend', list.slice(shown, shown + STEP).map(cardHtml).join(''));
  shown = Math.min(shown + STEP, list.length);
  update();
});
let t;
input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(() => {
    const q = input.value.trim().toLowerCase();
    list = q ? posts.filter((b) => (b.title + ' ' + (b.excerpt || '')).toLowerCase().includes(q)) : posts;
    shown = Math.min(STEP, list.length);
    grid.innerHTML = list.slice(0, shown).map(cardHtml).join('') || `<p class="muted">No posts match “${esc(input.value)}”.</p>`;
    update();
  }, 120);
});
update();

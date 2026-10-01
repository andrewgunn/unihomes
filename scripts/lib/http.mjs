// Polite HTTP client for crawling the live site: bounded concurrency, retries
// with backoff, and a small delay between requests so we never hammer it.
import pLimit from 'p-limit';

export const ORIGIN = 'https://www.unihomes.co.uk';
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 UniHomesRefreshPOC/0.1';

const limit = pLimit(Number(process.env.CRAWL_CONCURRENCY || 6));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const stats = { requests: 0, failures: 0, bytes: 0 };

/**
 * A tiny cookie jar. Listing pagination is seeded per session on the live site
 * (relevance order is shuffled per visitor), so every page of one listing must
 * be fetched with the same session cookie or results repeat/skip.
 */
export function cookieJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
    store(res) {
      for (const c of res.headers.getSetCookie?.() || []) {
        const [kv] = c.split(';');
        const i = kv.indexOf('=');
        jar.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
      }
    },
  };
}

async function attempt(url, { json = false, jar = null } = {}) {
  const headers = { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9' };
  if (jar?.header()) headers['Cookie'] = jar.header();
  if (json) {
    headers['Accept'] = 'application/json';
    headers['X-Requested-With'] = 'XMLHttpRequest';
  } else {
    headers['Accept'] = 'text/html,application/xhtml+xml';
  }
  const res = await fetch(url, { headers, redirect: 'follow' });
  stats.requests++;
  jar?.store(res);
  if (res.status === 404 || res.status === 410) return { status: res.status, body: null, url: res.url };
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status} ${url}`), { status: res.status });
  const text = await res.text();
  stats.bytes += text.length;
  return { status: res.status, body: json ? JSON.parse(text) : text, url: res.url };
}

export function get(pathOrUrl, opts = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : ORIGIN + pathOrUrl;
  return limit(async () => {
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        const out = await attempt(url, opts);
        await sleep(Number(process.env.CRAWL_DELAY_MS || 120));
        return out;
      } catch (e) {
        lastErr = e;
        await sleep(800 * 2 ** i + Math.random() * 400);
      }
    }
    stats.failures++;
    console.warn(`  ! giving up on ${url}: ${lastErr?.message}`);
    return { status: 0, body: null, url };
  });
}

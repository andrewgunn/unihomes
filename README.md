# UniHomes — refresh concept (POC)

A design-refresh proof of concept for [unihomes.co.uk](https://www.unihomes.co.uk), built to show the owner.
Same branding, search-first (Rightmove-style), mobile-first. Every page of the live site is mirrored
from a crawl and re-rendered with the new design.

**Preview:** https://andrewgunn.github.io/unihomes/

## SEO safety

The preview must never compete with the live site:

- Every page sends `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">`.
- Every page has `<link rel="canonical">` pointing at the matching live URL.
- No sitemap and no structured data (JSON-LD) are published.
- Crawled content is **not committed** — it lives in the GitHub Actions cache and only ships inside the Pages artifact.
- Enquiries, bookings, login and shortlists link to the live site.

## How it works

```
scripts/crawl.mjs   sitemap → fetch (polite, cookie-aware) → whitelisted JSON in data/
scripts/build.mjs   data/ → static HTML in dist/ (≈7k pages)
src/templates/      page templates (shared with the browser for live rendering)
src/shared/         normalisers + UI helpers used by crawler, browser and worker
src/assets/         CSS + client JS (search, filters, map, gallery)
worker/             optional Cloudflare Worker: live-search CORS proxy
```

### Search

- **Snapshot (default):** listing pages filter/sort/paginate client-side over the crawled data,
  refreshed daily by the workflow.
- **Live (optional):** set the repo variable `LIVE_API` to a deployed `worker/` URL and listing pages
  query the real UniHomes search endpoint through it (properties listed after the crawl render on the fly
  via the 404 fallback). If the proxy is down, pages fall back to the snapshot automatically.

```sh
cd worker && npx wrangler deploy           # then:
gh variable set LIVE_API --body https://unihomes-poc-proxy.<you>.workers.dev
```

## Local

```sh
npm ci
npm run crawl            # ~30 min first run; incremental afterwards (--limit=20 for a quick sample)
npm run build && npm run serve   # http://127.0.0.1:4173/unihomes/
```

## Deploy

`.github/workflows/deploy.yml` crawls daily (04:15 UTC), builds and deploys to GitHub Pages.
Pushes to `main` rebuild from the cached crawl.

#!/usr/bin/env node
// Serve ./dist the way GitHub Pages does: under BASE_PATH, dir → index.html,
// trailing-slash redirects, and 404.html for anything missing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = path.resolve(import.meta.dirname, '../dist');
const BASE = process.env.BASE_PATH ?? '/unihomes';
const PORT = Number(process.env.PORT || 4173);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain' };

process.on('uncaughtException', (e) => console.error(e.message));
http
  .createServer({ maxHeaderSize: 65536 }, (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/' && BASE) return res.writeHead(302, { Location: BASE + '/' }).end();
    if (!url.pathname.startsWith(BASE)) return res.writeHead(404).end('outside base');
    let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || '/';
    let f = path.join(DIST, rel);
    if (!f.startsWith(DIST)) return res.writeHead(403).end();
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
      if (!rel.endsWith('/')) return res.writeHead(301, { Location: url.pathname + '/' + url.search }).end();
      f = path.join(f, 'index.html');
    }
    const ok = fs.existsSync(f);
    const file = ok ? f : path.join(DIST, '404.html');
    res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).on('error', () => res.end()).pipe(res);
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}${BASE}/`));

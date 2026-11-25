import http from 'node:http';
import { readFile } from 'node:fs/promises';
import inspect from '../api/inspect.mjs';
import download from '../api/download.mjs';
const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const staticFiles = { '/analytics.js': ['../node_modules/@vercel/analytics/dist/index.mjs', 'text/javascript'], '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/logo.svg': ['logo.svg', 'image/svg+xml'] };
const server = http.createServer(async (req, res) => {
  for (const { key, value } of config.headers[0].headers) res.setHeader(key, value);
  res.status = code => { res.statusCode = code; return res; };
  res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
  res.send = value => res.end(value);
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (path === '/api/inspect' || path === '/api/download') {
      let body = ''; for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 8192) { res.status(413).json({ error: 'Permintaan terlalu besar.' }); return; } }
      try { req.body = body ? JSON.parse(body) : {}; } catch { res.status(400).json({ error: 'JSON tidak valid.' }); return; }
      await (path === '/api/inspect' ? inspect : download)(req, res);
    } else if (staticFiles[path]) {
      const [name, mime] = staticFiles[path]; res.setHeader('Content-Type', mime); res.end(await readFile(new URL(`../public/${name}`, import.meta.url)));
    } else { res.status(404).end('Not found'); }
  } catch { if (!res.headersSent) res.status(500).end('Server error'); else res.end(); }
});
server.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`http://127.0.0.1:${server.address().port}`));

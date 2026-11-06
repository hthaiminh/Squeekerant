// Serves the built game on this computer only, for trying it before it goes on a domain.
// `npm start` builds first. Each request reads the file again, so after a rebuild a refresh shows the new game.
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { createApp } = require('../server/app');
const { memoryStore } = require('../server/store');
const dist = path.join(__dirname, '..', 'dist');
const PAGES = { '/': 'index.html', '/vi': 'vi/index.html', '/vi/': 'vi/index.html' };
const LAST_TRY = 10;
// A leaderboard for trying things here. It lives in memory and is empty again after a restart.
const api = createApp({ store: memoryStore(), secret: crypto.randomBytes(32), local: true });
function serveApi(req, res, pathname) {
  let raw = '';
  req.on('data', (part) => {
    if (raw.length < 100000) raw += part;
  });
  req.on('end', async () => {
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {}
    const out = await api({ method: req.method, path: pathname, headers: req.headers, body });
    res.writeHead(out.status, { 'content-type': out.type || (out.html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8'), 'cache-control': 'no-store' });
    res.end(out.body || out.html || JSON.stringify(out.json));
  });
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  // The server's own pages: the API, and the links shared pictures get.
  if (pathname.startsWith('/api/') || pathname.startsWith('/p/')) return serveApi(req, res, pathname);
  if (pathname === '/og.png') {
    res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
    return fs.createReadStream(path.join(__dirname, '..', 'src', 'ui', 'og.png')).pipe(res);
  }
  const page = PAGES[pathname];
  if (!page) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('Not found. The game is at / and the Vietnamese test build at /vi/.');
  }
  fs.readFile(path.join(dist, page), (err, html) => {
    if (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      return res.end('Build the game first: npm run build && npm run build:vi');
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  });
});

const first = Number(process.env.PORT) || 3000;
let port = first;
server.on('error', (err) => {
  if (err.code !== 'EADDRINUSE' || port >= first + LAST_TRY) throw err;
  server.listen(++port, '127.0.0.1');
});
server.on('listening', () => {
  console.log('\nSqueekerant is running on this computer:');
  console.log(`  Vietnamese test build  http://localhost:${port}/vi/`);
  console.log(`  English public build   http://localhost:${port}/`);
  console.log('Press Ctrl+C to stop.\n');
});
server.listen(port, '127.0.0.1');

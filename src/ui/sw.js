// Squeekerant's service worker. It only lets the game and the updates page open with no network:
// the network always comes first, so a new version shows at once, and the copy kept here is for when there is none.
// Everything else, the API, shared pictures and other sites, goes straight past it.
const CACHE = 'squeekerant-pages-1';
const PAGES = ['/', '/updates'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || req.mode !== 'navigate' || url.origin !== self.location.origin || !PAGES.includes(url.pathname)) return;
  e.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        if (res.ok) {
          const copy = res.clone();
          e.waitUntil(caches.open(CACHE).then((c) => c.put(url.pathname, copy)));
        }
        return res;
      } catch (err) {
        const kept = await caches.match(url.pathname);
        if (kept) return kept;
        throw err;
      }
    })()
  );
});

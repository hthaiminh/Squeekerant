// Squeekerant's service worker. It lets the game and the updates page open with no network:
// the network always comes first, so a new version shows at once, and the copy kept here is for when there is none.
// Everything else, the API, shared pictures and other sites, goes straight past it.
// It also shows the wake up alerts the server sends, and opens the game when one is tapped.
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

// A wake up alert. Only pages of this site are ever opened from one.
const local = (path) => {
  try {
    const url = new URL(path || '/', self.location.origin);
    return url.origin === self.location.origin ? url.href : self.location.origin + '/';
  } catch (err) {
    return self.location.origin + '/';
  }
};
self.addEventListener('push', (e) => {
  let m = {};
  try {
    m = e.data ? e.data.json() : {};
  } catch (err) {}
  const image = typeof m.image === 'string' && m.image.startsWith('https://') ? m.image : undefined;
  e.waitUntil(
    self.registration.showNotification(String(m.title || 'Squeektoshi is awake'), {
      body: String(m.body || 'Your guests are on their way.'),
      icon: '/app-192.png',
      image,
      tag: String(m.tag || 'wake'),
      data: { url: local(m.url) },
    })
  );
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = local(e.notification.data && e.notification.data.url);
  e.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const game = open.find((c) => new URL(c.url).origin === self.location.origin && new URL(c.url).pathname === '/');
      if (game) {
        game.postMessage({ kind: 'alert-opened' });
        return game.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
// The browser renewed its subscription by itself. The server hears about the new one.
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    (async () => {
      const old = e.oldSubscription;
      const sub = e.newSubscription || (old && old.options ? await self.registration.pushManager.subscribe(old.options) : null);
      const post = (path, body) => fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (sub) await post('/api/push/subscribe', sub.toJSON());
      if (old && (!sub || old.endpoint !== sub.endpoint)) await post('/api/push/unsubscribe', { endpoint: old.endpoint });
    })().catch(() => {})
  );
});

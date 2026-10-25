const cacheName = 'get-bent-__VERSION__';
const shell = ['/bending/', '/bending/style.css', '/bending/app.js', '/bending/companies.js', '/bending/spoon.js', '/bending/inter-latin.woff2', '/bending/icon.svg', '/bending/icon-192.png', '/bending/icon-512.png', '/bending/icon-maskable.png', '/bending/manifest.webmanifest', ...__LOGOS__];
self.addEventListener('install', event => { event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(shell))); self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('get-bent-') && key !== cacheName).map(key => caches.delete(key)))),
    self.clients.claim(),
  ]));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/bending/') || url.pathname.startsWith('/bending/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match('/bending/') : null) || new Response('Offline', { status: 503 });
    }
  })());
});

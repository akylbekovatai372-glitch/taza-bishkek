/* Only the public offline page is stored. Auth, reports, photos and API responses
   always use the network and are never written to a service-worker cache. */
const CACHE_PREFIX = 'taza-bishkek-offline-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const OFFLINE_URL = new URL('offline.html', self.registration.scope).href;
const APP_PAGES = new Set(['', 'index.html', 'home.html', 'account.html', 'events.html', 'install.html']);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (!APP_PAGES.has(url.pathname.slice(scope.pathname.length))) return;
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match(OFFLINE_URL) || new Response('Нет соединения / Байланыш жок', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});

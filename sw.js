const CACHE_NAME = 'itac-energy-audit-v3';
const CACHE_VERSION = '3';
const URLS = [
  './',
  './index.html',
  './styles.css?v=' + CACHE_VERSION,
  './app.js?v=' + CACHE_VERSION,
  './manifest.json',
  './image1.png',
  './image2.png',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => {
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'SW_UPDATED' });
        });
      });
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((r) => {
        const url = e.request.url;
        const ok = (url.startsWith(self.location.origin) || url.includes('cdnjs.cloudflare.com')) && r.ok;
        if (ok) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return r;
      }).catch(() => {
        const url = e.request.url;
        if (url.includes('styles.css') || url.includes('app.js')) {
          return caches.match(url.split('?')[0]).then((cached) => {
            if (cached) return cached;
            return caches.match('./index.html');
          });
        }
        return caches.match(e.request);
      });
    })
  );
});

const CACHE_NAME = 'itac-energy-audit-v2';
const URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
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
    ).then(() => self.clients.claim())
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
      }).catch(() => caches.match(e.request));
    })
  );
});

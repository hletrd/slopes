const CACHE_NAME = 'slopes-cam-v1';
const urlsToCache = [
  './',
  './index.html',
  './main.css',
  './pwa.js',
  './manifest.json',
  './favicon.ico',
  './icons/skiing-192x192.png',
  './icons/skiing-512x512.png',
  './icons/skiing-maskable-192x192.png',
  './icons/skiing-maskable-512x512.png',
  './preview.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          response => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const responseToCache = response.clone();

            if (!event.request.url.includes('/links.json') &&
                !event.request.url.includes('/weather.json')) {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          }
        ).catch(error => {
          console.log('Fetch failed:', error);
        });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

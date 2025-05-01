const CACHE_NAME = 'slopes-cam-v4';
const urlsToCache = [
  './',
  './index.html',
  './main.css',
  './main.js',
  './pwa.js',
  './analytics.js',
  './manifest.json',
  './favicon.ico',
  './icons/skiing-16x16.png',
  './icons/skiing-32x32.png',
  './icons/skiing-64x64.png',
  './icons/skiing-128x128.png',
  './icons/skiing-180x180.png',
  './icons/skiing-192x192.png',
  './icons/skiing-512x512.png',
  './icons/skiing-maskable-192x192.png',
  './icons/skiing-maskable-512x512.png',
  './preview.png',
  './vivaldi.html',
  './WespJSSDKEncV4.min.js',
];

const externalResources = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/video-js.min.css',
  'https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/forest/index.css',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/alt/video.novtt.min.js',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.min.css',
  'https://buttons.github.io/buttons.js'
];

const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', event => {
  if (isLocalhost) return;

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache)
          .then(() => {
            return Promise.allSettled(
              externalResources.map(url =>
                fetch(url, { mode: 'no-cors' })
                  .then(response => {
                    return cache.put(url, response);
                  })
                  .catch(err => {
                    console.warn(`Failed to cache external resource: ${url}`, err);
                  })
              )
            );
          });
      })
  );
});

self.addEventListener('fetch', event => {
  if (isLocalhost) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (requestUrl.hostname.includes('googletagmanager.com') ||
      requestUrl.hostname.includes('google-analytics.com') ||
      requestUrl.hostname.includes('ghbtns.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        return fetch(event.request.clone())
          .then(response => {
            if (!response || response.status !== 200) {
              return response;
            }

            const shouldCache = (
              (requestUrl.origin === self.location.origin) ||
              externalResources.includes(event.request.url) ||
              event.request.url.endsWith('.json') ||
              event.request.url.includes('font') ||
              event.request.url.includes('.woff') ||
              event.request.url.includes('.woff2') ||
              event.request.url.endsWith('.css') ||
              event.request.url.endsWith('.js') ||
              event.request.url.endsWith('.png') ||
              event.request.url.endsWith('.jpg') ||
              event.request.url.endsWith('.svg')
            );

            if (shouldCache) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }

            return response;
          })
          .catch(error => {
            console.log('Fetch failed:', error);
            return caches.match(event.request);
          });
      })
  );
});

self.addEventListener('activate', event => {
  const cacheAllowlist = isLocalhost ? [] : [CACHE_NAME];

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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

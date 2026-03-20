const CACHE_NAME = 'slopes-vinext-v1';
const BASE = '/vinext/';

const APP_SHELL = [
  BASE,
  BASE + 'manifest.json',
  BASE + 'favicon.ico',
  BASE + 'icons/skiing-16x16.png',
  BASE + 'icons/skiing-32x32.png',
  BASE + 'icons/skiing-64x64.png',
  BASE + 'icons/skiing-128x128.png',
  BASE + 'icons/skiing-180x180.png',
  BASE + 'icons/skiing-192x192.png',
  BASE + 'icons/skiing-512x512.png',
  BASE + 'icons/skiing-maskable-192x192.png',
  BASE + 'icons/skiing-maskable-512x512.png',
  BASE + 'lang/ko.json',
  BASE + 'lang/en.json',
  BASE + 'vivaldi.html',
  BASE + 'vivaldi.js',
];

const EXTERNAL_RESOURCES = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.5/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/video-js.min.css',
  'https://cdn.jsdelivr.net/npm/@videojs/themes@1/dist/forest/index.css',
  'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.0/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
  'https://cdn.jsdelivr.net/npm/video.js@8.23.3/dist/alt/video.novtt.min.js',
];

// Network-first resources (stale data is worse than no data)
const NETWORK_ONLY_PATTERNS = [
  '/weather.json',
  '/forecast.json',
];

// Network-first with cache fallback
const NETWORK_FIRST_PATTERNS = [
  'links.json',
];

const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

self.addEventListener('install', event => {
  if (isLocalhost) return;

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL).then(() => {
        return Promise.allSettled(
          EXTERNAL_RESOURCES.map(url =>
            fetch(url, { mode: 'no-cors' })
              .then(response => cache.put(url, response))
              .catch(err => console.warn('Failed to cache:', url, err))
          )
        );
      });
    })
  );
});

self.addEventListener('activate', event => {
  const allowlist = isLocalhost ? [] : [CACHE_NAME];

  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.map(name => {
          if (allowlist.indexOf(name) === -1) {
            return caches.delete(name);
          }
        })
      )
    )
  );
});

self.addEventListener('fetch', event => {
  if (isLocalhost) return;

  const url = new URL(event.request.url);

  // Skip analytics and tracking
  if (url.hostname.includes('googletagmanager.com') ||
      url.hostname.includes('google-analytics.com') ||
      url.hostname.includes('ghbtns.com') ||
      url.hostname.includes('recaptcha')) {
    return;
  }

  // Network-only for weather/forecast (stale data is worse than no data)
  if (NETWORK_ONLY_PATTERNS.some(p => url.pathname.endsWith(p))) {
    return;
  }

  // Network-first for links.json
  if (NETWORK_FIRST_PATTERNS.some(p => url.pathname.endsWith(p))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request.clone()).then(response => {
        if (!response || response.status !== 200) return response;

        const shouldCache =
          url.origin === self.location.origin ||
          EXTERNAL_RESOURCES.includes(event.request.url) ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.jpg') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.includes('.woff') ||
          url.pathname.includes('.woff2');

        if (shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }

        return response;
      }).catch(() => caches.match(event.request));
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// The Flock Herald — Service Worker
// CACHE_NAME: flock-herald-v1.0
// Strategy: cache-first for all static assets; network-first for Firestore

const CACHE_NAME = 'flock-newspaper-gas-v1.0';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './Styles/the_broadsheet.css',
  './Scripts/the_living_water.js',
  './Scripts/firm_foundation.js',
  './Scripts/the_adornment.js',
  './Scripts/the_cistern.js',
  './Sections/herald/index.html'
];

// Install — precache core shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS).catch(() => {}))
  );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for same-origin assets; network-only for cross-origin
self.addEventListener('fetch', event => {
  const { request } = event;
  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, toCache));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});

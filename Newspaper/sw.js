/* The Flock Herald — Service Worker */
const CACHE_NAME = 'flock-newspaper-v1.0';

const PRECACHE = [
  '/Newspaper/',
  '/Newspaper/index.html',
  '/Newspaper/Styles/the_broadsheet.css',
  '/Newspaper/Scripts/firm_foundation.js',
  '/Newspaper/Scripts/the_adornment.js',
  '/Newspaper/Scripts/the_gates.js',
  '/Newspaper/Scripts/the_proclamation.js',
  '/Newspaper/Scripts/the_standard.js',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).catch(function () { return cached; });
    })
  );
});

/* ══════════════════════════════════════════════════════════════════════════════
   FlockDocs Service Worker
   SESSION 10: Offline Support & Progressive Performance
   "I will never leave you nor forsake you." — Hebrews 13:5
   ══════════════════════════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'flockdocs-v1';

// Static assets to pre-cache on install
const PRECACHE_URLS = [
  './app.flockdocs.html',
  './flockdocs.js',
  '../Styles/new_covenant.css',
  '../Scripts/the_foundation/firm_foundation.js',
];

// ── Install: pre-cache core assets ──────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // Cache what we can; ignore failures for third-party URLs
      return Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(url).catch(() => { /* ignore pre-cache failures */ })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: purge old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for same-origin; network-only for Firestore
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Firebase / Firestore / Auth requests
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    request.method !== 'GET'
  ) {
    return; // Let browser handle it normally
  }

  // For CDN JS libraries: try cache first, then network + cache
  if (
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('cdn.sheetjs.com') ||
    url.hostname.includes('unpkg.com')
  ) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(c => c.put(request, clone));
          }
          return response;
        }).catch(() => cached || new Response('', { status: 503 }));
      })
    );
    return;
  }

  // For same-origin requests: stale-while-revalidate
  if (url.origin === location.origin || url.pathname.startsWith('/FlockOS/')) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request).then(response => {
          if (response && response.status === 200 && response.type !== 'opaque') {
            cache.put(request, response.clone());
          }
          return response;
        }).catch(() => null);

        return cached || fetchPromise || new Response('Offline', { status: 503 });
      })
    );
  }
});

// ── Message: force-update cache ──────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_VERSION).then(() => {
      event.ports[0]?.postMessage({ cleared: true });
    });
  }
});

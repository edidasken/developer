/* ══════════════════════════════════════════════════════════════════════════════
   THE FLOCK HERALD — Service Worker
   "A herald went before him and cried, 'Bow the knee!'" — Genesis 41:43
   "When the enemy comes in like a flood, the Spirit of the Lord will
    lift up a standard against him." — Isaiah 59:19

   Strategy:
   • SHELL / CSS / JS  → Cache-first, background refresh (fast loads)
   • NAVIGATION        → Network-first, offline fallback to index.html
   • FONTS / CDN       → Cache-first (immutable after first fetch)
   • IMAGES            → Cache-first, stale-while-revalidate

   CACHE_NAME is patched per-church by C-Build_Newspaper.sh.
   Bump the version suffix whenever the precache manifest changes.
   ══════════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'flock-newspaper-gas-v1.0';

/* Derive base path from SW location — works at root or any subpath.
   e.g. '/FlockOS/Newspaper/' on GitHub Pages, or '/' at a Firebase Hosting root */
const SW_BASE = self.location.pathname.replace(/\/[^/]+$/, '/');

/* ── Precache manifest ───────────────────────────────────────────────────────
   Relative to SW_BASE. Fetched with Promise.allSettled so one 404 never
   blocks the rest. Bump CACHE_NAME whenever this list changes.
   ─────────────────────────────────────────────────────────────────────────── */
const PRECACHE_URLS = [
  /* Entry point */
  '',
  'index.html',
  'manifest.json',

  /* Design system */
  'Styles/the_broadsheet.css',

  /* Core scripts */
  'Scripts/firm_foundation.js',
  'Scripts/the_adornment.js',
  'Scripts/the_gates.js',
  'Scripts/the_proclamation.js',
  'Scripts/the_standard.js',
  'Scripts/the_cistern.js',
  'Scripts/the_witness.js',

  /* Section entry points */
  'Sections/herald/index.html',
  'Sections/straight_path/index.html',
  'Sections/great_commission/index.html',
  'Sections/living_water/index.html',
  'Sections/epistles/index.html',
  'Sections/gatehouse/index.html',

  /* Section CSS */
  'Styles/sections/herald.css',
  'Styles/sections/straight_path.css',
  'Styles/sections/great_commission.css',
  'Styles/sections/living_water.css',
  'Styles/sections/epistles.css',
  'Styles/sections/gatehouse.css',
];

/* ── Install — precache all shell assets ─────────────────────────────────── */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var requests = PRECACHE_URLS.map(function (path) {
        return new Request(SW_BASE + path, { cache: 'reload' });
      });
      return Promise.allSettled(
        requests.map(function (req) {
          return fetch(req).then(function (res) {
            if (res.ok) return cache.put(req, res);
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

/* ── Activate — evict old caches ─────────────────────────────────────────── */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (k) { return k !== CACHE_NAME; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* ── Fetch — tiered caching strategy ─────────────────────────────────────── */
self.addEventListener('fetch', function (event) {
  var req = event.request;
  var url = new URL(req.url);

  /* Skip non-GET and cross-origin (Firebase, CDN fonts handled separately) */
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) {
    /* CDN fonts: cache-first */
    if (url.hostname === 'fonts.googleapis.com' ||
        url.hostname === 'fonts.gstatic.com') {
      event.respondWith(
        caches.match(req).then(function (cached) {
          if (cached) return cached;
          return fetch(req).then(function (res) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
            return res;
          });
        })
      );
    }
    return;
  }

  var path = url.pathname;

  /* Navigation requests — network-first, fall back to index.html offline */
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match(SW_BASE + 'index.html');
      })
    );
    return;
  }

  /* CSS / JS / fonts — cache-first, background refresh */
  if (/\.(css|js|woff2?|ttf|otf)(\?.*)?$/.test(path)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        var networkFetch = fetch(req).then(function (res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
          }
          return res;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  /* Images — cache-first */
  if (/\.(png|jpe?g|gif|webp|svg|ico)(\?.*)?$/.test(path)) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res.ok) {
            var clone = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, clone); });
          }
          return res;
        }).catch(function () { return cached; });
      })
    );
    return;
  }

  /* Everything else — network-first */
  event.respondWith(
    fetch(req).catch(function () {
      return caches.match(req);
    })
  );
});

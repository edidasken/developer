/* FlockOS Launcher — Service Worker
 *
 * Lightweight SW for the root launcher page (index.html). Its job is twofold:
 *   1) Make the launcher installable as a PWA on Android/iOS.
 *   2) Keep the launcher shell available offline (cache-first for shell,
 *      network-first for navigation so updates land immediately).
 *
 * NOTE: This SW is scoped to "/" and only manages the launcher itself.
 * The Nations/* church installs each ship their own SW (the_living_water.js)
 * scoped to their own folder, so they are unaffected.
 *
 * Cache-version discipline: bump LAUNCHER_CACHE when you add/remove files
 * from CORE_ASSETS so clients re-cache.
 */

const LAUNCHER_CACHE = 'flockos-launcher-v1.01';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './New_Covenant/Images/FlockIcon-192.png',
  './New_Covenant/Images/FlockIcon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(LAUNCHER_CACHE).then(async (cache) => {
      // Cache best-effort; don't fail install on a single 404.
      await Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k !== LAUNCHER_CACHE).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only manage the launcher itself. Anything under Nations/ or other apps
  // is owned by their own service workers.
  const path = url.pathname;
  const scopePath = new URL('./', self.location).pathname;
  const relative = path.startsWith(scopePath) ? path.slice(scopePath.length) : path;
  if (relative.startsWith('Nations/')) return;
  if (relative.startsWith('flockchat-public/')) return;

  // Navigation requests → network-first, fall back to cached launcher shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(LAUNCHER_CACHE).then((cache) => cache.put('./index.html', copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match('./index.html').then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // Static assets → cache-first, with background refresh.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(LAUNCHER_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

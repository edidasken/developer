/* ══════════════════════════════════════════════════════════════════════════════
   THE LIVING WATER — Service Worker (New Covenant Shell)
   "Whosoever drinketh of the water that I shall give him shall never thirst."
   — John 4:14

   Strategy:
   • APP SHELL   → Cache-first, background refresh (fast loads)
   • NAVIGATION  → Network-first, offline fallback to cached index.html
   • FONTS       → Cache-first (immutable after first fetch)
   • PUSH        → Show notification; click → focus or open app
   ══════════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'flockos-gas-v1.05';

/* Derive base path from SW location (works at root or any subpath) */
const SW_BASE = self.location.pathname.replace(/\/[^\/]+$/, '/');
// e.g. '/FlockOS/New_Covenant/' on GitHub Pages, or '/' at Firebase root

/* ─── Complete file manifest ─────────────────────────────────────────────────
   All JS modules, CSS, data files, and images needed to run the full app
   offline. On SW install every file is fetched individually — one 404 never
   blocks the rest (we use Promise.allSettled, not cache.addAll).

   Bump CACHE_NAME whenever you add/remove a file here so clients re-cache.
   ─────────────────────────────────────────────────────────────────────────── */
const PRECACHE_URLS = [
  /* ── Entry points ─────────────────────────────────────────────────────── */
  '',
  'index.html',
  'manifest.json',

  /* ── The Flock Herald (primary app) ──────────────────────────────────── */
  'app.flocknews/flocknews.html',
  'app.flocknews/flocknews.css',

  /* ── GROW public PWA ─────────────────────────────────────────────────── */
  'app.grow/app.grow.html',
  'Scripts/grow_public.js',

  /* ── Invite standalone PWA ───────────────────────────────────────────── */
  'app.invite/app.invite.html',
  'app.invite/manifest.json',

  /* ── Styles ───────────────────────────────────────────────────────────── */
  'Styles/new_covenant.css', /* american_garments merged in — one CSS file */

  /* ── Images ───────────────────────────────────────────────────────────── */
  'Images/FlockIcon.png',
  'Images/FlockIcon-512.webp',
  'Images/NewCovenant.png',
  'Images/icon-flockos.svg',
  'Images/icon-grow.svg',
  'Images/icon-invite.svg',
  'Images/icon-chat.svg',
  'Images/icon-feed.svg',
  'Images/icon-show.svg',
  'Images/icon-stand.svg',

  /* ── Boot scripts ─────────────────────────────────────────────────────── */
  'Scripts/the_ark.js',
  'Scripts/the_adornment.js',
  'Scripts/the_lampstand.js',
  'Scripts/the_oil.js',
  'Scripts/the_watchmen.js',
  'Scripts/the_living_water_register.js',
  'Scripts/fine_linen.js',
  'Scripts/firm_foundation.js',
  'Scripts/the_app_switcher.js',

  /* ── Chrome / shell ───────────────────────────────────────────────────── */
  'Scripts/the_veil/index.js',
  'Scripts/the_veil/the_crown.js',
  'Scripts/the_veil/the_pillars.js',
  'Scripts/the_veil/the_hem.js',
  'Scripts/the_veil/the_courtyard.js',
  'Scripts/the_veil/the_refresh.js',

  /* ── Router ───────────────────────────────────────────────────────────── */
  'Scripts/the_scribes/index.js',
  'Scripts/the_scribes/the_chronicle.js',
  'Scripts/the_scribes/the_herald.js',
  'Scripts/the_scribes/the_path.js',

  /* ── Auth ─────────────────────────────────────────────────────────────── */
  'Scripts/the_priesthood/index.js',
  'Scripts/the_priesthood/the_anointing.js',
  'Scripts/the_priesthood/the_breastplate.js',
  'Scripts/the_priesthood/the_garments.js',

  /* ── Data / cache layer ───────────────────────────────────────────────── */
  'Scripts/the_manna.js',
  'Scripts/the_cistern.js',
  'Scripts/the_wellspring.js',
  'Scripts/the_wellspring/index.js',

  /* ── API layer ────────────────────────────────────────────────────────── */
  'Scripts/the_true_vine.js',
  'Scripts/the_window_bridge.js',
  'Scripts/the_living_water_adapter.js',

  /* ── Backend modules (Upper Room / Firestore) ─────────────────────────── */
  'Scripts/the_upper_room/index.js',
  'Scripts/the_upper_room/the_attachments.js',
  'Scripts/the_upper_room/the_channels.js',
  'Scripts/the_upper_room/the_dms.js',
  'Scripts/the_upper_room/the_emoji.js',
  'Scripts/the_upper_room/the_firebase_config.js',
  'Scripts/the_upper_room/the_identity.js',
  'Scripts/the_upper_room/the_mentions.js',
  'Scripts/the_upper_room/the_messages.js',
  'Scripts/the_upper_room/the_presence.js',
  'Scripts/the_upper_room/the_push.js',
  'Scripts/the_upper_room/the_seeding.js',
  'Scripts/the_upper_room/the_tenant.js',
  'Scripts/the_upper_room/the_typing.js',
  'Scripts/the_upper_room/the_unread.js',

  /* ── Domain modules ───────────────────────────────────────────────────── */
  'Scripts/the_life/index.js',
  'Scripts/the_harvest/index.js',
  'Scripts/the_seasons/index.js',
  'Scripts/the_truth/index.js',
  'Scripts/the_way/index.js',
  'Scripts/the_well/index.js',
  'Scripts/the_fold/index.js',
  'Scripts/the_shepherd/index.js',
  'Scripts/the_scrolls/index.js',
  'Scripts/the_scrolls/the_bible_link.js',
  'Scripts/the_shofar/index.js',
  'Scripts/the_trumpet/index.js',

  /* ── Domain flat-export shims (coexist alongside /index.js) ───────────── */
  'Scripts/the_life.js',
  'Scripts/the_harvest.js',
  'Scripts/the_seasons.js',
  'Scripts/the_truth.js',
  'Scripts/the_way.js',
  'Scripts/the_well.js',
  'Scripts/the_fold.js',
  'Scripts/the_shepherd.js',
  'Scripts/the_scrolls.js',
  'Scripts/the_upper_room.js',
  'Scripts/the_stones.js',
  'Scripts/the_tabernacle.js',

  /* ── Shared utilities ─────────────────────────────────────────────────── */
  'Scripts/the_comms.js',
  'Scripts/the_legacy_bridge.js',
  'Scripts/the_witness.js',

  /* ── Gospel sub-modules ───────────────────────────────────────────────── */
  'Scripts/the_gospel/the_gospel_shared.js',
  'Scripts/the_gospel/the_gospel_analytics.js',
  'Scripts/the_gospel/the_gospel_apologetics.js',
  'Scripts/the_gospel/the_gospel_certificates.js',
  'Scripts/the_gospel/the_gospel_counseling.js',
  'Scripts/the_gospel/the_gospel_courses.js',
  'Scripts/the_gospel/the_gospel_devotionals.js',
  'Scripts/the_gospel/the_gospel_genealogy.js',
  'Scripts/the_gospel/the_gospel_heart.js',
  'Scripts/the_gospel/the_gospel_invitation.js',
  'Scripts/the_gospel/the_gospel_journal.js',
  'Scripts/the_gospel/the_gospel_lexicon.js',
  'Scripts/the_gospel/the_gospel_library.js',
  'Scripts/the_gospel/the_gospel_mirror.js',
  'Scripts/the_gospel/the_gospel_missions.js',
  'Scripts/the_gospel/the_gospel_quizzes.js',
  'Scripts/the_gospel/the_gospel_reading.js',
  'Scripts/the_gospel/the_gospel_teaching_plans.js',
  'Scripts/the_gospel/the_gospel_theology.js',
  'Scripts/the_gospel/the_gospel_why.js',

  /* ── UI vessels ───────────────────────────────────────────────────────── */
  'Scripts/vessels/the_basin.js',
  'Scripts/vessels/the_censer.js',
  'Scripts/vessels/the_chalice.js',
  'Scripts/vessels/the_cup.js',
  'Scripts/vessels/the_mantle.js',
  'Scripts/vessels/the_menorah.js',
  'Scripts/vessels/the_rod.js',
  'Scripts/vessels/the_seal.js',
  'Scripts/vessels/the_signet.js',
  'Scripts/vessels/the_staff.js',

  /* ── Views — shared frame ─────────────────────────────────────────────── */
  'Views/_frame.js',

  /* ── Views — individual ───────────────────────────────────────────────── */
  'Views/about_flockos/index.js',
  'Views/bezalel/index.js',
  'Views/content-admin/index.js',
  'Views/fishing_for_data/index.js',
  'Views/fishing_for_men/index.js',
  'Views/learn_more/index.js',
  'Views/prayerful_action/index.js',
  'Views/quarterly_worship/index.js',
  'Views/software_deployment_referral/index.js',
  'Views/the_anatomy_of_worship/index.js',
  'Views/the_announcements/index.js',
  'Views/the_call_to_forgive/index.js',
  'Views/the_fellowship/index.js',
  'Views/the_fellowship/the_channel_list.js',
  'Views/the_fellowship/the_composer.js',
  'Views/the_fellowship/the_dm_drawer.js',
  'Views/the_fellowship/the_flockchat_pane.js',
  'Views/the_fellowship/the_interactions_pane.js',
  'Views/the_fellowship/the_member_pane.js',
  'Views/the_fellowship/the_message.js',
  'Views/the_fellowship/the_thread.js',
  'Views/the_fold/index.js',
  'Views/the_generations/index.js',
  'Views/the_gift_drift/index.js',
  'Views/the_good_shepherd/index.js',
  'Views/the_good_shepherd/the_birthdays.js',
  'Views/the_good_shepherd/the_call.js',
  'Views/the_good_shepherd/the_count.js',
  'Views/the_good_shepherd/the_flock_feed.js',
  'Views/the_good_shepherd/the_next_steps.js',
  'Views/the_good_shepherd/the_pasture.js',
  'Views/the_good_shepherd/the_prayer_hours.js',
  'Views/the_good_shepherd/the_today_events.js',
  'Views/the_good_shepherd/the_todos.js',
  'Views/the_good_shepherd/the_word.js',
  'Views/the_gospel_analytics/index.js',
  'Views/the_gospel_apologetics/index.js',
  'Views/the_gospel_certificates/index.js',
  'Views/the_gospel_counseling/index.js',
  'Views/the_gospel_courses/index.js',
  'Views/the_gospel_devotionals/index.js',
  'Views/the_gospel_genealogy/index.js',
  'Views/the_gospel_heart/index.js',
  'Views/the_gospel_invitation/index.js',
  'Views/the_gospel_journal/index.js',
  'Views/the_gospel_lexicon/index.js',
  'Views/the_gospel_library/index.js',
  'Views/the_gospel_mirror/index.js',
  'Views/the_gospel_quizzes/index.js',
  'Views/the_gospel_reading/index.js',
  'Views/the_gospel_teaching_plans/index.js',
  'Views/the_gospel_theology/index.js',
  'Views/the_great_commission/index.js',
  'Views/the_great_commission/bal_data.js',
  'Views/the_great_commission/ow_data.js',
  'Views/the_growth/index.js',
  'Views/the_harvest/index.js',
  'Views/the_invitation/index.js',
  'Views/the_life/index.js',
  'Views/the_pentecost/index.js',
  'Views/the_prayer_chain/index.js',
  'Views/the_seasons/index.js',
  'Views/the_truth/index.js',
  'Views/the_upper_room/index.js',
  'Views/the_upper_room/the_devotional.js',
  'Views/the_upper_room/the_journal.js',
  'Views/the_upper_room/the_reading.js',
  'Views/the_wall/index.js',
  'Views/the_way/index.js',
  'Views/the_weavers_plan/index.js',

  /* ── Offline data files (app content — no network needed) ─────────────── */
  'Data/apologetics.js',
  'Data/books-of-the-bible.js',
  'Data/counseling.js',
  'Data/devotionals.js',
  'Data/genealogy.js',
  'Data/heart.js',
  'Data/library.js',
  'Data/mirror.js',
  'Data/missions.js',
  'Data/one_year_bible.js',
  'Data/psalms.js',
  'Data/quiz.js',
  'Data/reading-plans.js',
  'Data/strongs-greek.js',
  'Data/strongs-hebrew.js',
  'Data/teaching_plans.js',
  'Data/theology.js',
].map((p) => SW_BASE + p);

/* ─── Install: cache the complete app ───────────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use individual puts instead of addAll so one missing file never
      // aborts the install. Log failures but keep going.
      const results = await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'no-store' }).then((res) => {
            if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
            return cache.put(url, res);
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length) {
        console.warn('[SW] ' + failed.length + ' file(s) failed to precache:',
          failed.map((r) => r.reason && r.reason.message).join(', '));
      }
    })
  );
  /* Do NOT call self.skipWaiting() here — let the launcher detect the
     waiting SW and show the "Update Available" banner. The user then
     explicitly triggers the update, which sends SKIP_WAITING. */
});

/* ─── Activate: purge old caches ────────────────────────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/* ─── Listen for messages from the page ────────────────────────────────────── */
self.addEventListener('message', (event) => {
  if (!event.data) return;

  /* Standard update-on-demand signal sent by the_living_water_register.js */
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  /* Developer force-refresh: wipe all caches so next install re-fetches everything.
     Triggered by FlockSW.forceRefresh() in the browser console, or ?flock_refresh=1 */
  if (event.data.type === 'FORCE_REFRESH') {
    event.waitUntil(
      caches.keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => self.skipWaiting())
    );
  }
});

/* ─── Fetch: routing strategies ─────────────────────────────────────────────── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Skip non-GET and cross-origin API calls (Firebase, GAS) */
  if (request.method !== 'GET') return;
  if (!url.origin.includes(self.location.hostname) &&
      !url.hostname.includes('fonts.googleapis.com') &&
      !url.hostname.includes('fonts.gstatic.com')) return;

  /* Google Fonts — cache-first (essentially immutable) */
  if (url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(_cacheFirst(request));
    return;
  }

  /* Navigation requests (HTML pages) — network-first with offline fallback */
  if (request.mode === 'navigate') {
    event.respondWith(_networkFirstNav(request));
    return;
  }

  /* View modules — network-first so deploys are visible immediately.
     Falls back to cache when offline. */
  if (url.pathname.includes('/Views/') && /\.js$/.test(url.pathname)) {
    event.respondWith(_networkFirst(request));
    return;
  }

  /* Static assets (JS, CSS, SVG, images) — stale-while-revalidate */
  if (/\.(js|css|svg|png|jpg|webp|woff2?)$/.test(url.pathname)) {
    event.respondWith(_staleWhileRevalidate(request));
    return;
  }
});

/* ─── Push notifications ────────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let data = { title: 'FlockOS', body: 'You have a new notification.' };
  try { data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/Images/FlockIcon-512.webp',
      badge:   '/Images/FlockIcon-512.webp',
      data:    data,
      vibrate: [150, 60, 150],
      tag:     data.tag || 'flockos',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) return existing.focus().then((c) => c.navigate(target));
      return self.clients.openWindow(target);
    })
  );
});

/* ─── Helpers ───────────────────────────────────────────────────────────────── */

async function _networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (_) {
    const cached = await cache.match(request);
    return cached || new Response('Offline', { status: 503 });
  }
}

async function _cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
  }
  return fresh;
}

async function _staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((fresh) => {
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  }).catch(() => null);
  return cached || (await fetchPromise) || new Response('Offline', { status: 503 });
}

async function _networkFirstNav(request) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (_) {
    const cached = await caches.match(request) ||
                   await caches.match(SW_BASE + 'index.html') ||
                   await caches.match(SW_BASE);
    if (cached) return cached;
    return new Response(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem">' +
      '<h2>You\'re offline.</h2><p>FlockOS will be available when you reconnect.</p>' +
      '</body></html>',
      { headers: { 'Content-Type': 'text/html' } }
    );
  }
}

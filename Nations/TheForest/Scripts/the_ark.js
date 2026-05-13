/* ══════════════════════════════════════════════════════════════════════════════
   THE ARK — FlockOS Boot
   "And Noah did according unto all that the LORD commanded him." — Genesis 7:5

   The Ark carries the covenant through the redesign. This is the ONLY entry
   point for the new shell. It does three things and nothing else:

     1. Install a global error boundary (the_watchmen surfaces crashes calmly).
     2. Wake the chrome (the_veil), the router (the_scribes), the splash
        (the_lampstand), and the auth shell (the_priesthood) — in that order.
     3. Hand the reins to the_scribes for the first navigation.

   No views are imported here. No business logic lives here.
   Hard rule: this file stays under ~120 lines.
   ══════════════════════════════════════════════════════════════════════════════ */

import { kindle, darken } from './the_lampstand.js';
import { dress } from './the_veil/index.js';
import { register, go, current } from './the_scribes/index.js';
import { whoAmI, enter } from './the_priesthood/index.js';
import { report } from './the_watchmen.js';
import * as adornment from './the_adornment.js';
import * as livingWater from './the_living_water_register.js';
import { installScriptureLinks } from './the_scrolls/the_bible_link.js';

const flock = {
  /** Boot the new FlockOS shell. Idempotent.
   *
   *  Boot order is optimised for "shell-first" perceived performance:
   *    1. Kick off auth + cache hydration + view preloads in parallel with
   *       chrome mount — none of them depend on each other.
   *    2. Resolve auth (usually instant — localStorage check). If not signed
   *       in, show login modal. Login modal sits over the splash, no flash.
   *    3. Wrap data sources, fire warm-up fetches (non-blocking).
   *    4. Render the initial view → skeletons paint, cached values appear
   *       instantly from hydrated Manna, fresh values stream in via SWR.
   *    5. Drop the splash. The user now sees the formatted shell with
   *       data filling in progressively as backends respond.
   */
  async start() {
    if (flock._started) return;
    flock._started = true;

    adornment.init();       // theme tokens before any paint
    _installErrorBoundary();
    kindle();               // splash on

    // ── Fire all independent boot work in parallel ──────────────────────
    const whoAmIPromise  = whoAmI().catch(() => null);
    const hydratePromise = _hydrateAllFromCistern();
    const dressPromise   = dress();
    _preloadViews();

    // ── Auth gate (usually instant — Nehemiah reads localStorage) ────────
    const user = await whoAmIPromise;
    if (!user) {
      darken(); // fade splash so the modal sits on a clean backdrop
      const result = await enter();
      if (!result || !result.ok) return;
      await whoAmI(); // re-hydrate _profile now that login has written the session
      kindle(); // splash back on while the shell finishes booting
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Now safe to wire data sources + warm caches in the background.
    _wrapDataSources();   // auto-cache UpperRoom + TheVine read methods
    _warmHomeData();
    _warmCommonData();    // pre-fetch members / events / cases / etc.
    _guardWellspring().catch(() => {});

    // ── Wait for hydration + chrome mount, then render the view.
    //    Hydration ensures cached values are in Manna so the home view's
    //    SWR reads return them synchronously on first paint.
    await Promise.all([hydratePromise, dressPromise]);
    await _registerViews();
    try {
      await go(_initialRoute(), { replace: true });
      installScriptureLinks(document.body); // auto-linkify all scripture refs to bible.com (ESV)
    } catch (err) {
      report(err, 'initial-route');
    } finally {
      darken();             // splash off — always, even if the initial view crashed
    }

    livingWater.register().catch(() => {}); // SW after the first paint
  },

  _started: false,
  current: () => current(),
  theme: adornment,
};

/* ── View registration ────────────────────────────────────────────────────── */
async function _registerViews() {
  // Lazy view loaders — each view is its own folder with index.js.
  const V = (n) => () => import(`../Views/${n}/index.js`);

  register('the_good_shepherd',          V('the_good_shepherd'),          { command: 'Go to: Home' });
  register('the_great_commission',       V('the_great_commission'),       { command: 'Go to: Missions' });
  register('the_invitation',             V('the_invitation'),             { command: 'Go to: Sign in' });
  register('the_pentecost',              V('the_pentecost'),              { command: 'Go to: Events' });
  register('the_wall',                   V('the_wall'),                   { command: 'Go to: Admin' });
  register('content-admin',              V('content-admin'),              { command: 'Go to: Truth Editor' });
  register('the_generations',            V('the_generations'),            { command: 'Go to: History' });
  register('the_anatomy_of_worship',     V('the_anatomy_of_worship'),     { command: 'Go to: Worship' });
  register('the_call_to_forgive',        V('the_call_to_forgive'),        { command: 'Go to: Reconciliation' });
  register('the_gift_drift',             V('the_gift_drift'),             { command: 'Go to: Giving' });
  register('the_weavers_plan',           V('the_weavers_plan'),           { command: 'Go to: Strategy' });
  register('prayerful_action',           V('prayerful_action'),           { command: 'Go to: Prayer journal' });
  register('quarterly_worship',          V('quarterly_worship'),          { command: 'Go to: Worship plan' });
  register('software_deployment_referral', V('software_deployment_referral'), { command: 'Go to: Deployment' });
  register('fishing_for_men',            V('fishing_for_men'),            { command: 'Go to: Outreach' });
  register('fishing_for_data',           V('fishing_for_data'),           { command: 'Go to: Analytics' });
  register('bezalel',                    V('bezalel'),                    { command: 'Go to: Bezalel codex' });
  register('about_flockos',              V('about_flockos'),              { command: 'About FlockOS' });
  register('learn_more',                 V('learn_more'),                 { command: 'Learn more' });

  // Comms views — three surfaces: GAS ledger, Firebase live, FlockChat embed.
  register('the_fellowship',           V('the_fellowship'),           { command: 'Go to: Fellowship' });
  register('the_announcements',        V('the_announcements'),        { command: 'Go to: Announcements' });
  register('the_prayer_chain',         V('the_prayer_chain'),         { command: 'Go to: Prayer chain' });

  // Care views
  register('the_fold',                 V('the_fold'),                 { command: 'Go to: The Fold' });
  register('the_life',                 V('the_life'),                 { command: 'Go to: Pastoral Care' });
  register('the_seasons',              V('the_seasons'),              { command: 'Go to: Seasons' });

  // Word & devotion
  register('the_upper_room',           V('the_upper_room'),           { command: 'Go to: The Upper Room' });

  // Mission views
  register('the_harvest',              V('the_harvest'),              { command: 'Go to: Harvest' });
  register('the_way',                  V('the_way'),                  { command: 'Go to: The Way' });
  register('the_truth',                V('the_truth'),                { command: 'Go to: Content' });
  register('the_gospel_invitation',    V('the_gospel_invitation'),    { command: 'Go to: The Invitation' });

  // Grow — discipleship dashboard + the_gospel/* learning modules
  register('the_growth',               V('the_growth'),               { command: 'Go to: Grow' });
  register('the_gospel_courses',       V('the_gospel_courses'),       { command: 'Go to: Courses' });
  register('the_gospel_quizzes',       V('the_gospel_quizzes'),       { command: 'Go to: Quizzes' });
  register('the_gospel_reading',       V('the_gospel_reading'),       { command: 'Go to: Reading Plans' });
  register('the_gospel_theology',      V('the_gospel_theology'),      { command: 'Go to: Theology' });
  register('the_gospel_teaching_plans', V('the_gospel_teaching_plans'), { command: 'Go to: Teaching Plans' });
  register('the_gospel_lexicon',       V('the_gospel_lexicon'),       { command: 'Go to: Lexicon' });
  register('the_gospel_library',       V('the_gospel_library'),       { command: 'Go to: The Word library' });
  register('the_gospel_devotionals',   V('the_gospel_devotionals'),   { command: 'Go to: Devotionals' });
  register('the_gospel_apologetics',   V('the_gospel_apologetics'),   { command: 'Go to: Apologetics' });
  register('the_gospel_counseling',    V('the_gospel_counseling'),    { command: 'Go to: Counseling' });
  register('the_gospel_heart',         V('the_gospel_heart'),         { command: 'Go to: Heart Check' });
  register('the_gospel_mirror',        V('the_gospel_mirror'),        { command: 'Go to: Shepherd\u2019s Mirror' });
  register('the_gospel_genealogy',     V('the_gospel_genealogy'),     { command: 'Go to: Biblical Genealogy' });
  register('the_gospel_journal',       V('the_gospel_journal'),       { command: 'Go to: Journal' });
  register('the_gospel_certificates',  V('the_gospel_certificates'),  { command: 'Go to: Certificates' });
  register('the_gospel_analytics',     V('the_gospel_analytics'),     { command: 'Go to: Learning analytics' });
}

/* ── Initial route ────────────────────────────────────────────────────────── */
function _initialRoute() {
  const params = new URLSearchParams(location.search);
  const v = params.get('view');
  return v && v.trim() ? v.trim() : 'the_good_shepherd';
}

/* ── View preload ─────────────────────────────────────────────────────────── */
function _preloadViews() {
  // Fire-and-forget: begin fetching+compiling the home view tree in the
  // background while dress() is running.  When go('the_good_shepherd') fires
  // the module is already in the browser's module registry — zero-latency.
  // _frame.js is shared by every view so it's cheap to preload once here.
  import('../Views/_frame.js').catch(() => {});
  import('../Views/the_good_shepherd/index.js').catch(() => {});
  // Sub-modules — without these the home view has to await each one after mount.
  import('../Views/the_good_shepherd/the_count.js').catch(() => {});
  import('../Views/the_good_shepherd/the_pasture.js').catch(() => {});
  import('../Views/the_good_shepherd/the_today_events.js').catch(() => {});
  import('../Views/the_good_shepherd/the_birthdays.js').catch(() => {});
  import('../Views/the_good_shepherd/the_todos.js').catch(() => {});
  import('../Views/the_good_shepherd/the_next_steps.js').catch(() => {});
  import('../Views/the_good_shepherd/the_flock_feed.js').catch(() => {});
  import('../Views/the_good_shepherd/the_call.js').catch(() => {});
  import('../Views/the_good_shepherd/the_word.js').catch(() => {});
  import('../Views/the_good_shepherd/the_prayer_hours.js').catch(() => {});
  // The Upper Room — surfaced from the home dashboard, parse it now.
  import('../Views/the_upper_room/index.js').catch(() => {});
  import('../Views/the_upper_room/the_devotional.js').catch(() => {});
}

/* ── Home data pre-warm ──────────────────────────────────────────────────── */

// All home dashboard data sources, in one place. Used by both the boot
// pre-warm AND the per-card SWR fetches so cache keys never drift.
const HOME_DATA_KEYS = [
  { key: 'shepherd:fellowship',    mod: './the_upper_room/index.js', fn: 'unreadTotal' },
  { key: 'shepherd:care',          mod: './the_life/index.js',       fn: 'pendingCount' },
  { key: 'shepherd:today',         mod: './the_seasons/index.js',    fn: 'todayCount' },
  { key: 'shepherd:next',          mod: './the_life/index.js',       fn: 'careCases' },
  { key: 'shepherd:feed',          mod: './the_comms.js',            fn: 'summary' },
  // New cards (added when the home dashboard was upgraded)
  { key: 'shepherd:members',       upperRoom: 'countMembers' },
  { key: 'shepherd:prayers',       upperRoom: 'countOpenPrayers' },
  { key: 'shepherd:today-events',  upperRoom: 'listEvents',  args: [{ limit: 80 }] },
  { key: 'shepherd:birthdays',     upperRoom: 'listMembers', args: [{ limit: 1000 }] },
  { key: 'shepherd:mytodos',       upperRoom: 'myTodos' },
];

/**
 * Synchronously hydrate Manna with EVERY persisted manna:* key from Cistern.
 * Runs BEFORE dress() so the first paint of any view (not just home) shows
 * cached data instantly while wrapped UpperRoom/TheVine calls refresh in
 * the background.
 */
async function _hydrateAllFromCistern() {
  try {
    const { hydrateAll } = await import('./the_manna.js');
    await hydrateAll();
  } catch (_) { /* non-fatal */ }
}

/**
 * Install auto-caching on every read method of window.UpperRoom and
 * window.TheVine.flock/missions/extra/app. Idempotent. After this call
 * EVERY view's UpperRoom.listMembers() / TheVine.flock.todo.list() etc.
 * automatically caches + persists with no view-side changes.
 */
async function _wrapDataSources() {
  try {
    const { wrap } = await import('./the_manna.js');
    // UpperRoom (Firestore SDK) — wrap once it's ready.
    const wrapUR = () => {
      const UR = window.UpperRoom;
      if (UR && !UR.__mannaWrapped) {
        wrap('UR', UR, {
          ttl: 5 * 60_000,
          ttlByMethod: {
            // Member directory rarely changes mid-session.
            listMembers: 30 * 60_000, countMembers: 30 * 60_000,
            listMemberCards: 30 * 60_000, searchMemberCards: 5 * 60_000,
            // Settings / permissions — near-static.
            getCommsMode: 30 * 60_000, getPermissions: 30 * 60_000,
            listPermissionModules: 60 * 60_000,
            // Notification prefs / counts — short.
            getNotifPrefs: 60_000, getUnreadCount: 90_000,
            // Care queues — moderate.
            careDashboard: 60_000, careFollowUpsDue: 60_000,
            // Calendar / content — medium.
            listEvents: 5 * 60_000, listBroadcasts: 2 * 60_000,
            listTemplates: 10 * 60_000,
          },
        });
      }
    };
    wrapUR();
    // If UpperRoom isn't ready yet (race), retry on a short interval until it appears.
    if (!window.UpperRoom || !window.UpperRoom.__mannaWrapped) {
      let tries = 0;
      const t = setInterval(() => {
        wrapUR();
        if ((window.UpperRoom && window.UpperRoom.__mannaWrapped) || ++tries > 40) clearInterval(t);
      }, 250);
    }

    // TheVine (GAS REST) — wrap each gospel/branch namespace's leaf method
    // groups (members, events, prayer, todo, etc.). Each leaf has list/get
    // methods that benefit from caching since GAS round-trips are slow.
    const V = window.TheVine;
    if (V) {
      for (const branch of ['flock', 'missions', 'extra', 'app',
                            'john',  'mark',     'luke',  'matthew']) {
        const b = V[branch];
        if (!b || typeof b !== 'object') continue;
        for (const groupName of Object.keys(b)) {
          const g = b[groupName];
          if (g && typeof g === 'object' && !g.__mannaWrapped) {
            wrap('V.' + branch + '.' + groupName, g, { ttl: 5 * 60_000 });
          }
        }
      }
    }
  } catch (_) { /* non-fatal */ }
}

/**
 * Pre-fetch the most commonly viewed data immediately after auth so
 * navigating to ANY of the top views feels instant. Each fetch flows
 * through the wrapped UpperRoom which auto-caches + auto-persists.
 */
async function _warmCommonData() {
  // Slight delay so wrap() has run and UpperRoom is ready.
  setTimeout(() => {
    const UR = window.UpperRoom;
    if (!UR || !UR.isReady || !UR.isReady()) return;
    const safe = (fn) => { try { const p = fn(); if (p && p.catch) p.catch(() => {}); } catch (_) {} };
    // Members, events, todos, care — drives Fold, Seasons, Life, home cards.
    safe(() => UR.listMembers && UR.listMembers({ limit: 1000 }));
    safe(() => UR.listEvents && UR.listEvents({ limit: 80 }));
    safe(() => UR.myTodos && UR.myTodos());
    safe(() => UR.listCareCases && UR.listCareCases());
    safe(() => UR.careDashboard && UR.careDashboard());
    safe(() => UR.listPrayers && UR.listPrayers({ status: 'open' }));
    safe(() => UR.countOpenPrayers && UR.countOpenPrayers());
    safe(() => UR.listConversations && UR.listConversations());
    safe(() => UR.listBroadcasts && UR.listBroadcasts());
  }, 250);
}

/**
 * Synchronously hydrate Manna with the last-known values for every home
 * data source from Cistern. Runs BEFORE dress() so the first paint of the
 * home view shows real data instantly (then SWR refreshes in background).
 */
async function _hydrateHomeFromCistern() {
  try {
    const [{ hydrate }, { read }] = await Promise.all([
      import('./the_manna.js'),
      import('./the_cistern.js'),
    ]);
    const entries = await Promise.all(
      HOME_DATA_KEYS.map(async ({ key }) => {
        try { return [key, await read('manna:' + key)]; }
        catch (_) { return [key, undefined]; }
      })
    );
    const map = {};
    for (const [k, v] of entries) if (v !== undefined) map[k] = v;
    hydrate(map);
  } catch (_) { /* non-fatal */ }
}

async function _warmHomeData() {
  try {
    const [{ draw }, { write: cisternPut }] = await Promise.all([
      import('./the_manna.js'),
      import('./the_cistern.js'),
    ]);
    const TTL = 5 * 60_000; // 5 minutes — survive tab switches

    await Promise.all(HOME_DATA_KEYS.map(async (entry) => {
      try {
        let fetcher;
        if (entry.upperRoom) {
          fetcher = async () => {
            const UR = window.UpperRoom;
            if (!UR || !UR.isReady || !UR.isReady() || !UR[entry.upperRoom]) return null;
            return UR[entry.upperRoom](...(entry.args || []));
          };
        } else {
          const m = await import(entry.mod);
          fetcher = () => m[entry.fn]();
        }
        const value = await draw(entry.key, fetcher, { ttl: TTL });
        if (value !== undefined && value !== null) {
          cisternPut('manna:' + entry.key, value).catch(() => {});
        }
      } catch (_) { /* per-card failures are non-fatal */ }
    }));
  } catch (_) {}
}

/* ── Wellspring guard ─────────────────────────────────────────────────────── */
async function _guardWellspring() {
  const W = window.TheWellspring;
  if (!W || typeof W.status !== 'function') return;
  try {
    const s = await W.status();
    if (s.active && (!s.loaded || !s.totalRows)) {
      // Active but no imported data — kill it so GAS calls pass through.
      if (typeof W.disable === 'function') W.disable();
      console.info('[NewCovenant] TheWellspring disabled — no local data. API calls will reach GAS.');
    } else if (s.active && s.loaded && s.totalRows) {
      // Active with data — call enable() again to guarantee TheVine.configure()
      // was called after all defer scripts finished (guards against the timing
      // window where _autoInit fired before TheVine was on the window).
      if (typeof W.enable === 'function') await W.enable();
    }
  } catch (_) { /* non-fatal */ }
}

/* ── Error boundary (light-touch — the_watchmen does the work) ───────────── */
function _installErrorBoundary() {
  window.addEventListener('error', (e) => report(e.error || e.message, 'window.error'));
  window.addEventListener('unhandledrejection', (e) =>
    report(e.reason, 'unhandledrejection')
  );
}

/* ── Globals ──────────────────────────────────────────────────────────────── */
globalThis.flock = flock;

/* ── Auto-start when ?covenant=new is present, else stay silent ───────────── */
const _qs = new URLSearchParams(location.search);
if (_qs.get('covenant') === 'new') {
  // Wait for DOMContentLoaded — guarantees all `defer` backend scripts
  // (firm_foundation.js, the_true_vine.js, the_window_bridge.js, etc.)
  // have fully executed before we touch window.Nehemiah or window.TheVine.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => flock.start());
  } else {
    // Already past DOMContentLoaded (e.g. dynamic load) — start immediately.
    flock.start();
  }
}

export { flock };

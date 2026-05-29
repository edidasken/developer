/* ══════════════════════════════════════════════════════════════════════════════
   THE LIFE — Pastoral command-hub: care, prayer, compassion, outreach, etc.
   "In him was life; and the life was the light of men." — John 1:4
   ══════════════════════════════════════════════════════════════════════════════ */



/* ── TheVine-backed data accessors ────────────────────────────────────────── */

function _isFB() {
  return typeof Modules !== 'undefined' && Modules._isFirebaseComms && Modules._isFirebaseComms();
}

function _rows(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.rows)) return res.rows;
  if (res && Array.isArray(res.data)) return res.data;
  return [];
}

const W = /** @type {{[key: string]: any}} */ (typeof window !== 'undefined' ? window : globalThis);

function _hasSession() {
  const nehemiahSession = (typeof Nehemiah !== 'undefined' && Nehemiah.getSession) ? Nehemiah.getSession() : null;
  const vineSession = (W.TheVine && typeof W.TheVine.session === 'function') ? W.TheVine.session() : null;
  const s = nehemiahSession || vineSession || null;
  return !!(s && (s.email || s.token));
}

const _TERMINAL = new Set(['resolved','closed','archived','cancelled','denied','completed','answered','inactive','deleted']);

export async function careCases() {
  const V = W.TheVine;
  if (!V) return [];
  // Fetch all cases — don't filter by status on the API side because field
  // values vary ('Open', 'In Progress', 'Follow-Up', not 'Active').
  const res = await V.flock.care.list({});
  return _rows(res).filter(r => !_TERMINAL.has((r.status || '').toLowerCase()));
}

export async function prayerRequests() {
  // UpperRoom (Firestore) is the authoritative backend for prayer requests.
  // allUsers:true so pastors see everyone's requests, not just their own.
  const UR = W.UpperRoom;
  if (UR && typeof UR.listPrayers === 'function') {
    try {
      const rows = await UR.listPrayers({ allUsers: true, limit: 100 });
      return Array.isArray(rows) ? rows : _rows(rows);
    } catch (_) {}
  }
  // TheVine fallback (GAS-backed churches)
  const V = W.TheVine;
  if (!V) return [];
  const res = await V.flock.prayer?.list({ limit: 100 }) ?? [];
  return _rows(res);
}

export async function compassionList() {
  const V = W.TheVine;
  if (!V) return [];
  // Try the dedicated follow-ups endpoint first; fall back to the active care queue.
  try {
    const res = await V.flock.care.followUps?.due();
    const rows = _rows(res);
    if (rows.length) return rows;
  } catch (_) {}
  return careCases();
}

export async function pendingCount() {
  // If the eager warm-up has already received a count, return it instantly
  // — no awaiting backend, no round-trip. This is what makes the badge
  // appear the moment the sidebar paints after login.
  if (_warmCount !== null) return _warmCount;
  // Wait for Firestore (no timeout on Firestore churches \u2014 see _awaitBackend).
  await _awaitBackend();
  const UR = W.UpperRoom;
  // Use the SAME call as the on-screen tiles (UR.listCareCases) so the
  // count agrees with the queue. NEVER fall back to GAS \u2014 GAS returned
  // 21 here while Firestore (and the view) returned 19 (the user had
  // resolved 2 cases that GAS still considered open).
  if (UR && typeof UR.isReady === 'function' && UR.isReady() && typeof UR.listCareCases === 'function') {
    try {
      const rows = await UR.listCareCases({ limit: 500 });
      const list = Array.isArray(rows) ? rows : (rows && rows.results) || [];
      let open = 0;
      list.forEach((d) => {
        const s = String((d && (d.status || d.Status)) || '').trim().toLowerCase();
        if (!_TERMINAL.has(s)) open++;
      });
      console.log('[CARE-BADGE] pendingCount via listCareCases: ' + list.length + ' total, ' + open + ' open');
      return open;
    } catch (e) {
      console.error('[CARE-BADGE] pendingCount listCareCases threw:', e && e.message);
    }
  }
  // Last-resort GAS path \u2014 may be stale; only used if UR isn't ready at all.
  console.warn('[CARE-BADGE] pendingCount falling back to GAS careCases() \u2014 may be stale');
  const rows = await careCases();
  return rows.length;
}

/* Real-time open-case count via Firestore onSnapshot.
   Returns an unsubscribe function. Falls back to a one-shot count + 60s
   polling if Firestore isn't available. The_pillars subscribes once at
   mount so the Pastoral Care badge stays accurate without polling.       */
export function subscribeOpenCareCount(cb) {
  if (typeof cb !== 'function') return () => {};
  let unsub = () => {};
  let cancelled = false;
  const _t0 = Date.now();
  console.log('[CARE-BADGE] subscribeOpenCareCount() entry');

  (async () => {
    await _awaitBackend();
    if (cancelled) return;
    const UR = W.UpperRoom;
    const fsReady = !!(UR && typeof UR.isReady === 'function' && UR.isReady());
    console.log('[CARE-BADGE] _awaitBackend resolved in ' + (Date.now() - _t0) + 'ms — fsReady=' + fsReady + ', hasUR=' + !!UR + ', hasListCareCases=' + !!(UR && typeof UR.listCareCases === 'function'));

    // Use UR.listCareCases — the SAME call the Pastoral Care view uses to
    // produce its on-screen tile count. By definition this guarantees the
    // badge agrees with the view. Pull a generous limit so we don't drop
    // older open cases (the view uses { limit: 500 }).
    if (fsReady && UR && typeof UR.listCareCases === 'function') {
      const _refresh = async () => {
        if (cancelled) return;
        try {
          const rows = await UR.listCareCases({ limit: 500 });
          const list = Array.isArray(rows) ? rows : (rows && rows.results) || [];
          let open = 0;
          const openRows = [];
          const openSummary = [];
          list.forEach((d) => {
            const s = String((d && (d.status || d.Status)) || '').trim().toLowerCase();
            if (!_TERMINAL.has(s)) {
              open++;
              openRows.push(d);
              openSummary.push({
                id: d.id,
                status: d.status || d.Status || '(none)',
                memberId: d.memberId || d.member || '(none)',
                title: d.title || d.subject || d.summary || '(none)',
                createdAt: d.createdAt || '(missing)'
              });
            }
          });
          console.log('[CARE-BADGE] listCareCases returned: ' + list.length + ' total, ' + open + ' open (' + (Date.now() - _t0) + 'ms)');
          if (!_dumpedOnce) {
            _dumpedOnce = true;
            console.log('[CARE-BADGE] open docs:');
            try { console.table(openSummary); } catch (_) {}
          }
          _warmRows = openRows;
          _warmRowSubscribers.forEach((rcb) => { try { rcb(openRows); } catch (_) {} });
          try { cb(open); } catch (_) {}
        } catch (e) {
          console.error('[CARE-BADGE] listCareCases threw:', e && (e.code || e.name), e && e.message);
        }
      };
      // Fire immediately, then refresh every 60s while subscribed. Also
      // refresh on demand when the view dispatches flockos:badges:refresh.
      _refresh();
      const tick = setInterval(_refresh, 60_000);
      const onEvt = () => _refresh();
      try { window.addEventListener('flockos:badges:refresh', onEvt); } catch (_) {}
      unsub = () => {
        clearInterval(tick);
        try { window.removeEventListener('flockos:badges:refresh', onEvt); } catch (_) {}
      };
      return;
    }

    // Last-resort polling fallback (GAS-only deploys without UpperRoom)
    console.warn('[CARE-BADGE] FALLING THROUGH TO LEGACY POLLING. fsReady was ' + fsReady);
    try { const _pc = await pendingCount(); console.warn('[CARE-BADGE] polling pendingCount returned ' + _pc); cb(_pc); } catch (e) { console.error('[CARE-BADGE] polling pendingCount threw:', e); }
    const tick = setInterval(async () => {
      if (cancelled) return clearInterval(tick);
      try { cb(await pendingCount()); } catch (_) {}
    }, 60_000);
    unsub = () => clearInterval(tick);
  })();

  return () => { cancelled = true; try { unsub(); } catch (_) {} };
}

// Memoized auth-prod. Retries on rejection (up to 5 attempts with backoff)
// because the first call commonly happens before the session exists (e.g.
// the warm-up runs on the login wall page where authenticate() rejects with
// 'NO SESSION'). On retry success the next caller benefits without firing
// duplicate token mints.
let _ensureAuthAttempts = 0;
let _ensureAuthPromise = null;
function _ensureUpperRoomAuth() {
  if (_ensureAuthPromise) return _ensureAuthPromise;
  _ensureAuthPromise = (async () => {
    const UR = W.UpperRoom;
    if (!UR || typeof UR.init !== 'function' || typeof UR.authenticate !== 'function') return;
    if (typeof UR.isReady === 'function' && UR.isReady()) return;
    if (!_hasSession()) return;
    try { await UR.init(); } catch (_) {}
    if (!_hasSession()) return;
    try {
      await UR.authenticate();
    } catch (e) {
      // Don't permanently memoize the failure — reset so a later caller
      // (e.g. once the user has actually logged in) can try again.
      _ensureAuthAttempts++;
      _ensureAuthPromise = null;
      throw e;
    }
  })();
  // Swallow rejection at the outer level so this can be safely awaited.
  _ensureAuthPromise.catch(() => {});
  return _ensureAuthPromise;
}

// Wait until Firestore (UpperRoom) is genuinely ready. NO timeout on
// Firestore churches — we wait forever because some other module will
// eventually authenticate (Tabernacle, Prayer Chain, Pastoral Care view).
// Giving up and switching to GAS polling was the original 60s+wrong-count
// bug: pendingCount would then go through V.flock.care.list, which returns
// docs that the Firestore-ordered query excludes.
function _awaitBackend(_legacyMs) {
  return new Promise((resolve) => {
    const isFirestoreChurch = !!(
      typeof window !== 'undefined' &&
      (W.FLOCK_FIREBASE_CONFIG || W.UpperRoom)
    );
    let prodTries = 0;
    let lastProd = 0;
    const check = () => {
      const UR = W.UpperRoom;
      const V  = W.TheVine;
      const fsReady = !!(UR && typeof UR.isReady === 'function' && UR.isReady());
      if (fsReady) return resolve();
      // Only accept TheVine on GAS-only churches with no Firebase config.
      if (!isFirestoreChurch && V) return resolve();
      // Periodically prod auth (every ~5s, max 5 tries) in case nothing
      // else is going to trigger it.
      if (_hasSession() && UR && typeof UR.init === 'function' && prodTries < 5 && (Date.now() - lastProd) > 5_000) {
        prodTries++;
        lastProd = Date.now();
        _ensureUpperRoomAuth().catch(() => {});
      }
      setTimeout(check, 250);
    };
    check();
  });
}

/* ── Eager warm-up ───────────────────────────────────────────────────────────
   Start watching the open-case count the moment this module loads — well
   before the sidebar mounts. The instant auth completes (whether persisted
   session or post-login mint), the Firestore listener fires and the count
   is cached. By the time the_pillars subscribes, it gets an immediate hit
   from the warmed cache instead of waiting on a fresh round-trip.            */
let _warmCount = null;
let _warmRows = null;             // last-seen array of open care rows
let _dumpedOnce = false;          // one-shot console.table of open docs
const _warmSubscribers = new Set();
const _warmRowSubscribers = new Set();
let _warmStarted = false;

function _emitWarm(n) {
  _warmCount = n;
  _warmSubscribers.forEach((cb) => { try { cb(n); } catch (_) {} });
}

/* Public: authoritative override — when the Pastoral Care view tallies the
   exact rows it's about to render, it calls this so the sidebar badge is
   guaranteed to match the on-screen tiles. Single source of truth. */
export function setOpenCareCount(n, rows) {
  if (typeof n !== 'number' || n < 0) return;
  _warmCount = n;
  if (Array.isArray(rows)) _warmRows = rows;
  _warmSubscribers.forEach((cb) => { try { cb(n); } catch (_) {} });
  if (Array.isArray(rows)) {
    _warmRowSubscribers.forEach((rcb) => { try { rcb(rows); } catch (_) {} });
  }
}

/* Public: read the cached open-care rows (may be null until first snapshot). */
export function getWarmCareRows() {
  return _warmRows;
}

/* Public: subscribe to live open-care rows. Emits the current cache on
   subscribe (if available) and again every snapshot. Returns unsubscribe. */
export function subscribeOpenCareRows(cb) {
  if (typeof cb !== 'function') return () => {};
  _warmRowSubscribers.add(cb);
  if (_warmRows) { try { cb(_warmRows); } catch (_) {} }
  return () => { _warmRowSubscribers.delete(cb); };
}

function _startWarmUp() {
  if (_warmStarted) return;
  _warmStarted = true;
  console.log('[CARE-BADGE] warm-up starting at module load');
  // Deliberately fire-and-forget; subscribeOpenCareCount handles the
  // backend-readiness wait and Firestore subscription.
  subscribeOpenCareCount((n) => {
    console.log('[CARE-BADGE] warm-up emit: ' + n);
    _emitWarm(n);
  });
}

// Kick it off as soon as the module loads. If UpperRoom isn't ready yet,
// _awaitBackend polls until it is — so this cost nothing when run early
// and is ready the instant the user finishes login.
if (typeof window !== 'undefined') {
  console.log('[CARE-BADGE] Scripts/the_life/index.js module loaded — invoking _startWarmUp()');
  _startWarmUp();
}


/* ── Convenience delegates (formerly bridge stubs) ─────────────────────────── */
export async function outreachList(params = {}) {
  const r = _isFB()
    ? W.UpperRoom?.listOutreachContacts?.(params)
    : W.TheVine?.flock?.outreach?.contacts?.list?.(params);
  return _rows(await r);
}
export async function discipleshipFor(memberId) {
  const r = _isFB()
    ? W.UpperRoom?.listDiscEnrollments?.({ memberId })
    : W.TheVine?.flock?.discipleship?.enrollments?.list?.({ memberId });
  return _rows(await r);
}
export async function commsLog(params = {}) {
  const r = _isFB()
    ? W.UpperRoom?.listConversations?.(params)
    : W.TheVine?.flock?.comms?.messages?.list?.(params);
  return _rows(await r);
}
export async function notesFor(memberId) {
  const r = _isFB()
    ? W.UpperRoom?.listPastoralNotes?.({ memberId })
    : W.TheVine?.flock?.notes?.list?.({ memberId });
  return _rows(await r);
}

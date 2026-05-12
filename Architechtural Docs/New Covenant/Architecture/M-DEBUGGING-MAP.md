# FlockOS New Covenant — Debugging Map

> Reference for diagnosing issues, tracing failures, and knowing exactly what to check and log at each layer of the stack.

---

## Boot Sequence Checklist (`the_ark.js`)

Boot order matters. When something breaks on load, walk down this chain:

| Step | What Runs | What to Check |
|------|-----------|---------------|
| 1 | `adornment.init()` | Theme tokens applied? CSS vars visible in DevTools? |
| 2 | `_installErrorBoundary()` | Global `onerror` / `unhandledrejection` registered? |
| 3 | `kindle()` | Splash screen visible? `the_lampstand` loaded? |
| 4 | `whoAmI()` (parallel) | Auth session read from `localStorage`? (key: `flock_auth_session`) |
| 5 | `_hydrateAllFromCistern()` (parallel) | Manna populated at start? Check `manna:*` keys in `localStorage` |
| 6 | `dress()` (parallel) | `the_veil` chrome (topbar/sidebar) mounted to DOM? |
| 7 | Auth gate | If no user → `enter()` login modal shown? If user → splash stays |
| 8 | `_wrapDataSources()` | `UpperRoom` + `TheVine` methods auto-cached via Manna? |
| 9 | `_warmHomeData()` / `_warmCommonData()` | Background pre-fetches fired (not blocking) |
| 10 | `_registerViews()` | All view routes registered with `the_scribes`? |
| 11 | `go(initialRoute)` | Router navigated to correct first view? |
| 12 | `installScriptureLinks()` | Bible links applied to body? |
| 13 | `darken()` | Splash faded out? |
| 14 | `livingWater.register()` | Service Worker registered after first paint? |

**Console breakpoints to check:**
```js
// Boot entry
console.log('[ark] boot start');

// Auth result
console.log('[ark] whoAmI result:', user);

// Initial route
console.log('[ark] routing to:', _initialRoute());
```

---

## Auth Layer (`firm_foundation.js` / `the_priesthood/`)

### What to Check

- `sessionStorage.getItem('flock_auth_session')` — is the session token present and not expired?
- `sessionStorage.getItem('flock_auth_profile')` — is user profile cached?
- `Nehemiah.isAuthenticated()` — returns `true`/`false`
- `Nehemiah.getSession()` — inspect `{ token, email, role, expiresAt }`
- Session TTL = **6 hours** (inline; reduced to **4 hours** after re-auth) — if expired, user gets logged out silently

### What to Log

```js
// On login attempt
console.log('[auth] login attempt:', email);
console.log('[auth] session result:', Nehemiah.getSession());

// On guard check
console.log('[auth] isAuthenticated:', Nehemiah.isAuthenticated());
console.log('[auth] role:', Nehemiah.getSession()?.role);
```

### Common Failures

| Symptom | Likely Cause |
|---------|-------------|
| Blank page after login | `enter()` resolved but `whoAmI()` not re-called |
| Redirect loop to login | Session TTL expired or `sessionStorage` blocked/cleared |
| Wrong role access | `requireRole()` not called or role mismatch |
| Path resolution broken | `_paths.root` resolved incorrectly (check `<script src>` attribute) |

---

## API Layer (`the_true_vine.js`)

### Endpoints to Verify

All 4 gospels currently point to the **same GAS endpoint** (unified). Check in `_config`:

```
APP_ENDPOINTS[0]      — Matthew (app/content)
FLOCK_ENDPOINTS[0]    — John (church management)
MISSIONS_ENDPOINTS[0] — Mark (missions)
EXTRA_ENDPOINTS[0]    — Luke (analytics)
```

### What to Check

- Is `TIER_PRIMARY: true`? Secondary/Tertiary are `false` by default.
- Is `LOCAL_RESOLVER` set? (Would bypass GAS entirely for local dev)
- `TIMEOUT_MS` = **30,000ms** — check for silent timeouts in Network tab
- `FAILOVER_PROBE_MS` = **35,000ms** — secondary endpoint probe delay

### What to Log

```js
// Outgoing request
console.log('[vine] request:', action, params);

// Response
console.log('[vine] response:', result);

// Failover
console.warn('[vine] primary failed, trying secondary:', err);
```

### Network Checks (DevTools → Network tab)

- Filter: `script.google.com` — watch for 429 (rate limit), 403 (auth), 302 (redirect)
- GAS returns HTTP 200 even for errors — check the **JSON body** for `{ ok: false, error: '...' }`
- Watch for CORS errors — GAS must have `doGet`/`doPost` returning `ContentService` with proper headers

---

## Cache Layer (`the_manna.js`)

### What to Check

- `Manna.peek(key)` — synchronous read; returns `undefined` if not in memory
- Check `localStorage` for `manna:*` keys (persisted entries)
- Default TTL = **60 seconds** — stale data may appear for up to 1 min
- `_inflight` Map — check if a fetch is already in-flight (dedup active)

### What to Log

```js
// Cache hit vs miss
console.log('[manna] peek:', key, Manna.peek(key));

// Hydration at boot
console.log('[manna] hydrateAll complete — keys loaded:', Object.keys(localStorage).filter(k => k.startsWith('manna:')));

// SWR refresh
console.log('[manna] swr: cached value returned, background refresh fired for:', key);
```

### Cache Debugging Commands (Console)

```js
// See everything in memory cache
// (Manna._store is private — use peek per key or add a debug export)

// See persisted manna in localStorage
Object.keys(localStorage).filter(k => k.startsWith('manna:'))

// Clear all manna (forces fresh fetch)
Object.keys(localStorage).filter(k => k.startsWith('manna:')).forEach(k => localStorage.removeItem(k))
```

---

## Router (`the_scribes/`)

### What to Check

- `the_scribes.current()` — what route is active right now?
- Are all views registered via `register()` before `go()` is called?
- Deep-link: does the URL path match a registered route?
- GitHub Pages 404: views must be in `Views/` (capital V) — lowercase `views/` will 404

### What to Log

```js
// Route change
console.log('[scribes] navigating to:', path, params);

// Route not found
console.warn('[scribes] no route matched:', path);
```

---

## Chrome / UI Shell (`the_veil/`, `the_adornment.js`)

### What to Check

- `dress()` — did the topbar/sidebar mount? Inspect `#app-chrome` or equivalent in DOM
- `the_adornment.init()` — CSS theme vars set on `:root`? (`--color-*`, `--font-*`)
- Splash stuck on? `darken()` not called — means a step in boot threw before reaching it

### What to Log

```js
// Chrome mount
console.log('[veil] chrome dressed');

// Theme
console.log('[adornment] tokens applied:', document.documentElement.style.cssText);
```

---

## Error Reporting (`the_watchmen.js`)

### Behavior

- `report(err, ctx)` — logs to console (`[the_watchmen]`), shows a toast (max **3 toasts/session**), and forwards to `TheVine.john.telemetry` if available
- Errors 4–∞ are **silently swallowed** (no toast, still console.warn)

### What to Check

- `the_watchmen.count()` — how many errors have occurred this session?
- Console filter: `[the_watchmen]` — see all caught errors
- If `count() >= 3`, toast won't show — check console directly

### What to Log

```js
// Error boundary
window.addEventListener('unhandledrejection', e => {
  console.error('[unhandledrejection]', e.reason);
});
window.onerror = (msg, src, line, col, err) => {
  console.error('[onerror]', msg, src, line, err);
};
```

---

## Service Worker / Offline (`the_living_water_register.js` / PWA)

### What to Check

- DevTools → Application → Service Workers — is SW registered? Active? Status = `activated`?
- Is SW stuck on `waiting`? Hard-reload (Cmd+Shift+R) or click "skipWaiting"
- Cache Storage — what's cached? Is the cached version stale?
- `firebase-messaging-sw.js` — FCM push SW; check registration separately

### What to Log

```js
// SW registration
navigator.serviceWorker.getRegistrations().then(console.log);

// Cache contents
caches.keys().then(names => names.forEach(n => caches.open(n).then(c => c.keys().then(console.log))));
```

---

## localStorage Keys Reference

| Key | Storage | Module | Contents |
|-----|---------|--------|----------|
| `flock_auth_session` | `sessionStorage` | `firm_foundation.js` | Auth token + expiry |
| `flock_auth_profile` | `sessionStorage` | `firm_foundation.js` | User profile object |
| `flock_secure_vault` | `sessionStorage` | `the_true_vine.js` | Encrypted sensitive data |
| `manna:*` | `localStorage` (via Cistern) | `the_manna.js` | Persisted cache entries |

---

## CSS / Styles Debugging

- Source of truth: `New_Covenant/Styles/american_garments.css` (local copy, synced from SharedVessels by BCP)
- Additional overrides: `New_Covenant/Styles/new_covenant.css`
- If styles look wrong after a BCP, check whether BCP overwrote a local change

---

## Quick Diagnostic Checklist (Run This First)

```
[ ] Open DevTools Console — any red errors?
[ ] Open Network tab — any failed requests (4xx / 5xx)?
[ ] sessionStorage.getItem('flock_auth_session') — present and not expired?
[ ] Application > Service Workers — SW active, not stuck?
[ ] Application > Cache Storage — not serving stale HTML/JS?
[ ] DevTools > Console filter: [the_watchmen] — any caught errors?
[ ] DevTools > Console filter: [vine] — API requests firing correctly?
[ ] the_watchmen.count() in console — how many errors this session?
[ ] Manna: Object.keys(localStorage).filter(k => k.startsWith('manna:')) — cache present?
[ ] Current route: type `the_scribes.current()` (if exported to window)
```

---

## Logging Conventions

When adding temporary debug logs, use this prefix format so they're easy to find and remove:

```js
console.log('[module_name] message:', value);   // informational
console.warn('[module_name] warning:', value);   // unexpected but non-fatal
console.error('[module_name] error:', err);      // fatal / needs attention
```

---

*Last updated: May 1, 2026*

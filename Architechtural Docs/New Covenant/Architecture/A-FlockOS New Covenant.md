# FlockOS — Complete Redesign Plan

> **Goal:** Rebuild FlockOS from the ground up as a single-page application: ONE HTML shell that loads a small set of well-named JavaScript modules. Every file, module, route, and concept gets a biblical name. The legacy `Pages/*.html` per-view files go away — pages become rendered views inside the shell.

---

## 1. Guiding Principles

1. **One Tabernacle (one HTML).** `FlockOS.html` is the only HTML file shipped. All views are rendered into it.
2. **Biblical Naming, Top to Bottom.** Files, modules, classes, events, CSS sections, routes — all named from Scripture. No generic names like `utils.js`, `app.js`, `router.js`.
3. **Small Stones, Not Goliaths.** **Hard rule: no JS file exceeds ~300 lines.** Soft target ~150. Every app, view, and module is broken into tiny single-purpose files. If a file grows, it splits — never bloats.
4. **One File, One Responsibility.** A module does one thing and exports one small surface. Cross-module work happens through `the_shofar` (events) or `the_well` (data), never by reaching into another module's internals.
5. **No Frameworks.** Vanilla JS, ES modules, native Web Components for reusable UI. Dependency tree near zero.
6. **Backend Untouched.** Reuse the existing Firebase project, Firestore collections, Cloud Functions, FlockChat — all of it. The redesign is **UX-only** on top of `the_living_water.js`.
7. **Single Source of Truth for Style.** Continue using `SharedVessels/styles/american_garments.css`. The shell carries only flash-prevention vars inline.
8. **Build, Don't Duplicate.** The shell is authored once under `/FlockOS/` (master) and propagated to Nations via `A-Build_Churches.sh`. Never edit Church copies.
9. **Progressive, Not Big-Bang.** Redesign ships behind a flag (`?covenant=new`) until parity is reached, then becomes default.

---

## 2. Inventory of What Exists Today (the truth on the ground)

The following modules **already live** in `Covenant/Nations/FlockOS/FlockOS/Scripts/` with established biblical identities. The redesign **preserves every name and meaning** — it only splits oversized files and wraps them in a new shell.

### 2.1 Existing JS Modules (keep all names, split where bloated)

| File | Identity / Global | Responsibility | Action |
|---|---|---|---|
| `the_living_water.js` | Service Worker | App-shell + API caching, offline fallback | **Keep as-is** |
| `the_true_vine.js` | `TheVine` | Centralized API client (Matthew/Mark/Luke/John branches) | Split into `the_true_vine/` folder: `index.js`, `matthew.js`, `mark.js`, `luke.js`, `john.js`, `the_branch.js` (shared fetch/auth) |
| `the_cornerstone.js` | `Temple` | Architecture registry: RBAC, routes, actions, tabs | Split into `the_cornerstone/` folder: `index.js`, `the_rbac.js`, `the_routes.js`, `the_actions.js`, `the_tabs.js` |
| `firm_foundation.js` | `Nehemiah` | Auth: login, register, guard, role checks, sessions | Split into `firm_foundation/` folder: `index.js`, `the_gate.js`, `the_register.js`, `the_session.js`, `the_reset.js` |
| `the_tabernacle.js` | `Modules` | Live-data UI for every sidebar module + nav/routing host | Split into `the_tabernacle/` folder: `index.js`, `the_nav.js`, `the_skeleton.js`, plus per-module render fragments |
| `fine_linen.js` | `Adornment` | Theme engine (14 themes, dark/light auto) | Split into `fine_linen/` folder: `index.js`, `the_palette.js`, `the_dark.js`, `the_storage.js` |
| `the_shepherd.js` | `TheShepherd` | People engine: search, profiles, multi-table save, member/card creation | Split into `the_shepherd/` folder: `index.js`, `the_search.js`, `the_profile.js`, `the_save.js`, `the_permissions.js` |
| `the_fold.js` | `TheFold` | Groups, small groups, Bible studies, attendance | Split into `the_fold/` folder: `index.js`, `the_groups.js`, `the_attendance.js` |
| `the_harvest.js` | `TheHarvest` | Ministry hub: events, sermons, service plans, songs, teams, volunteers | Split into `the_harvest/` folder: `index.js`, `the_events.js`, `the_sermons.js`, `the_service_plans.js`, `the_teams.js`, `the_volunteers.js` |
| `the_way.js` | `TheWay` | Learning hub: courses, quizzes, reading plans, theology, lexicon, apologetics, counseling, devotionals, certificates, analytics | Split into `the_way/` folder: `index.js`, `the_courses.js`, `the_quizzes.js`, `the_reading.js`, `the_theology.js`, `the_lexicon.js`, `the_apologetics.js`, `the_counseling.js`, `the_devotionals.js`, `the_certificates.js`, `the_analytics.js` |
| `the_life.js` | `TheLife` | Pastoral command-hub: care, prayer, compassion, outreach, discipleship, comms, notes | Split into `the_life/` folder: `index.js`, `the_care.js`, `the_prayer.js`, `the_compassion.js`, `the_outreach.js`, `the_discipleship.js`, `the_comms.js`, `the_notes.js` |
| `love_in_action.js` | `LoveInAction` | Pastoral care hub (delegates editing to `TheLife`) | Keep small; co-locate under `the_life/` as `love_in_action.js` |
| `the_seasons.js` | `TheSeason` | Calendar, tasks, check-in, iCal feeds | Split into `the_seasons/` folder: `index.js`, `the_calendar.js`, `the_tasks.js`, `the_checkin.js`, `the_ical.js` |
| `the_truth.js` | `TheTruth` | Firestore-backed content editor (Books, Genealogy, Counseling, Devotionals, Reading Plan, Lexicon, Heart Check, Mirror, Quiz, Apologetics) | Split into `the_truth/` folder: `index.js` + one file per content tab |
| `the_upper_room.js` | (IIFE) | Firebase Firestore comms: DMs, chat rooms, channels, notifications | Split into `the_upper_room/` folder: `index.js`, `the_dms.js`, `the_rooms.js`, `the_channels.js`, `the_notifications.js`, `the_firebase_config.js` |
| `the_well.js` | `TheWell` | Backup, restore, .xlsx templates (SheetJS) | Split into `the_well/` folder: `index.js`, `the_template.js`, `the_backup.js`, `the_restore.js`, `the_schema.js` |
| `the_wellspring.js` | `TheWellspring` | Local-data mode: single .xlsx in IndexedDB, TheVine resolver hook | Split into `the_wellspring/` folder: `index.js`, `the_loader.js`, `the_resolver.js`, `the_export.js`, `the_status.js` |
| `the_trumpet.js` | `Trumpet` | Device APIs: share, clipboard, call, sms, notify, badge, fullscreen, camera, image resize, QR, geolocation | Split into `the_trumpet/` folder: `index.js`, `the_share.js`, `the_clipboard.js`, `the_telephony.js`, `the_notify.js`, `the_badge.js`, `the_fullscreen.js`, `the_camera.js`, `the_image.js`, `the_qr.js`, `the_geo.js` |
| `the_shofar.js` | (Music Stand) | Song manager + live chord view: songs/arrangements/setlists CRUD, ChordPro renderer, transpose, capo, PDF export | **Split aggressively** (~2000+ lines today) into `the_shofar/` folder: `index.js`, `the_state.js`, `the_auth.js`, `the_styles.js`, `the_shell.js`, `the_songs_tab.js`, `the_song_detail.js`, `the_arrangement_view.js`, `the_song_editor.js`, `the_arr_editor.js`, `the_stand_tab.js`, `the_stand_view.js`, `the_transpose.js`, `the_chordpro.js`, `the_pdf.js`, `the_song_select_import.js`, `the_helpers.js` |
| `the_scrolls.js` | `TheScrolls` | Unified interaction ledger (touches, calls, texts, emails, visits, notes, prayers, pastoral actions) | Split into `the_scrolls/` folder: `index.js`, `the_storage.js`, `the_types.js`, `the_timeline.js`, `the_filters.js` |
| `the_commission.js` | `Blueprint` | Deployment guide / runbook data | **Keep as-is** (data-only) |
| `the_pagans.js` | (parked) | Dormant code (Drive sync) | **Keep as-is** (not loaded at runtime) |
| `builds_codex.js` | `window.FLOCK_BUILDS_DATA` | Auto-generated build registry | **Keep as-is** (build-script output) |

### 2.2 Existing Pages (`Covenant/Nations/FlockOS/FlockOS/Pages/`)

Every one of these `.html` files becomes a **view module** under `views/<name>/index.js`. The HTML page is deleted only after its view ports clean. Full list:

- `index.html` — landing redirect
- `the_good_shepherd.html` — home dashboard
- `the_great_commission.html` — missions
- `the_invitation.html` — sign-in / public landing
- `the_pentecost.html` — events / outpouring
- `the_wall.html` — admin / boundaries
- `the_generations.html` — history / timeline
- `the_anatomy_of_worship.html` — worship structure
- `the_call_to_forgive.html` — reconciliation
- `the_gift_drift.html` — giving / stewardship
- `the_weavers_plan.html` — strategy
- `prayerful_action.html` — prayer journal
- `quarterly_worship.html` — worship plan
- `software_deployment_referral.html` — deployment / referral
- `fishing-for-men.html` — outreach
- `fishing-for-data.html` — analytics
- `bezalel.html` — build/codex tooling UI
- `bezalel_matrix.html` — matrix view
- `About_FlockOS.html` — about
- `Learn More.html` — marketing

Plus the Bezalel codex JS that backs the matrix UI:
- `bezalel_codex.js`, `bezalel_camelcase_codex.js`, `bezalel_firestoresync_codex.js`, `bezalel_synchandler_codex.js` → split into `views/bezalel/` folder: `index.js`, `the_codex.js`, `the_camelcase.js`, `the_firestoresync.js`, `the_synchandler.js`, `the_matrix.js`

### 2.3 Workflows Already Wired (must keep working)

The redesign must not break any of these — they keep their current backend wiring:

1. **Service-worker caching** (`the_living_water.js`) — install / activate / fetch / offline.
2. **Auth flow** (`Nehemiah`) — login, register, forgot, reset, role guard, session storage.
3. **API routing** (`TheVine` 4 branches) — Matthew/app, Mark/missions, Luke/extra, John/flock — all GAS endpoints.
4. **Live comms** (`the_upper_room.js`) — Firebase Firestore DMs/rooms/channels/notifications, FCM tokens.
5. **Content editing** (`TheTruth`) — Firestore CRUD across 10 public-content tabs (root vs church projects).
6. **Local-only mode** (`TheWellspring`) — IndexedDB-backed offline-first .xlsx mode with TheVine resolver hook.
7. **Backup / Restore / Templates** (`TheWell`) — SheetJS workbook import/export across all namespaces.
8. **Theme / dark mode** (`Adornment`) — 14 themes, server-synced via `TheVine.flock.preferences`, localStorage fallback.
9. **Interaction ledger** (`TheScrolls`) — global timeline, per-person filters, max 2000 entries.
10. **Music Stand** (`the_shofar`) — songs/arrangements/setlists, ChordPro render, transpose+capo math, PDF export.
11. **Device integration** (`Trumpet`) — share, call, sms, notifications, badge, camera, QR, geo.
12. **Build pipeline** (`A-Build_Churches.sh`) — rsync master → Nations, regenerate `builds_codex.js`, sync SharedVessels CSS, optional `--deploy-comms` for FlockChat hosting.
13. **Church/Nation deployments** — per-church Firebase config injection (`window.FLOCK_FIREBASE_CONFIG`, `window.FLOCK_CHURCH_ID`, `window.FLOCK_TRUTH_USE_LOCAL`).
14. **Bezalel codex tooling** — schema sync, camelCase mapping, Firestore sync handlers, matrix UI.
15. **FlockChat** (separate at `Covenant/Courts/TheFellowship/FlockChat/`) — `the_word.js` is the source; `firebase deploy --only hosting --project flockos-comms`. **Out of scope** for this redesign except as a linked surface.

---

## 3. New Shell-Layer Modules (only fresh biblical names, no collisions)

These are **new** modules introduced by the redesign. Names are reserved from those NOT already used above:

```
Scripts/
├── the_ark.js                ← Boot only — load order, error boundary (~80 lines)
├── the_scribes/              ← Router (NEW — replaces the routing inside Modules)
│   ├── index.js              ←   public API: register, go, current
│   ├── the_path.js           ←   URL ↔ view name parsing
│   ├── the_chronicle.js      ←   history stack
│   └── the_herald.js         ←   ⌘K command palette + keyboard shortcuts
├── the_veil/                 ← Shell chrome (NEW)
│   ├── index.js
│   ├── the_crown.js          ←   top bar
│   ├── the_pillars.js        ←   side nav (replaces sidebar markup in index.html)
│   ├── the_courtyard.js      ←   main slot / view mount point
│   └── the_hem.js            ←   footer
├── the_priesthood/           ← Auth UI shell (thin layer over Nehemiah)
│   ├── index.js
│   ├── the_garments.js       ←   sign-in form UI
│   ├── the_anointing.js      ←   token surfacing
│   └── the_breastplate.js    ←   role badges / claims display
├── the_lampstand.js          ← Splash + flash-prevention (~120 lines, complements Adornment)
├── the_oil.js                ← Animation primitives (~100 lines)
├── the_stones.js             ← Validators (~150 lines)
├── the_watchmen.js           ← Telemetry / error reporting (~120 lines)
├── the_witness.js            ← Runtime self-checks (dev only)
├── the_manna.js              ← In-memory cache layer for view data (~120 lines)
├── the_cistern.js            ← IndexedDB persistence helper (~150 lines)
└── vessels/                  ← Reusable Web Components (one per file)
    ├── the_chalice.js        ←   <flock-card>
    ├── the_basin.js          ←   <flock-input>
    ├── the_menorah.js        ←   <flock-tabs>
    ├── the_censer.js         ←   <flock-modal>
    ├── the_seal.js           ←   <flock-button>
    ├── the_signet.js         ←   <flock-toggle>
    ├── the_cup.js            ←   <flock-select>
    ├── the_mantle.js         ←   <flock-skeleton>
    ├── the_rod.js            ←   <flock-progress>
    └── the_staff.js          ←   <flock-toast> (renders for Trumpet.notify)
```

**Splitting rule:** when any file approaches 250 lines, split it before adding more. The folder pattern (`index.js` + siblings) is the standard split.

**Naming-collision rule:** Before adding a new file, grep the existing tree. If the name is taken, pick another biblical name. Never re-purpose `the_well`, `the_shofar`, `the_scrolls`, `the_trumpet`, `the_well`, `the_wellspring`, `the_truth`, `the_way`, `the_life`, `the_seasons`, `the_harvest`, `the_fold`, `the_shepherd`, `the_upper_room`, `the_tabernacle`, `the_cornerstone`, `the_living_water`, `the_true_vine`, `the_commission`, `the_pagans`, `firm_foundation`, `fine_linen`, `love_in_action`.

---

## 4. The Shell Contract (`FlockOS.html`)

The HTML file contains **only**:
- `<head>` with manifest, icons, fonts, inline flash-prevention vars, link to `american_garments.css`.
- A skeleton: `<header id="the-veil-top">`, `<nav id="the-veil-side">`, `<main id="the-holy-place">`, `<footer id="the-veil-foot">`, `<div id="the-staff-host">` for toasts.
- One `<script type="module" src="the_ark.js">`.

That's it. No view markup, no inline JS beyond the flash-prevention block.

---

## 5. Shell-Layer Module Responsibilities (NEW modules only)

| Module | Owns | Public API (informal) |
|---|---|---|
| `the_ark.js` | Boot order, error boundary, exposes `globalThis.flock` | `flock.start()` |
| `the_scribes/` | URL ↔ view, history, params, ⌘K palette | `scribes.go(name, params)`, `scribes.register(name, loader)` |
| `the_veil/` | Renders chrome, slots in active view, mobile breakpoints | `veil.dress(view)` |
| `the_priesthood/` | Sign-in UI shell over `Nehemiah` | `priesthood.whoAmI()`, `priesthood.enter()`, `priesthood.depart()` |
| `the_lampstand.js` | Splash + flash-prevention (Adornment owns themes) | `lampstand.kindle()`, `lampstand.darken()` |
| `the_manna.js` | In-memory cache for view data (sits over TheVine) | `manna.draw(key, fetcher)`, `manna.invalidate(key)` |
| `the_cistern.js` | IndexedDB persistence helper | `cistern.read(k)`, `cistern.write(k, v)` |
| `the_oil.js` | Animation primitives (respects prefers-reduced-motion) | `oil.fade(el)`, `oil.slide(el)` |
| `the_stones.js` | Validators returning `{ok, message}` | `stones.weigh(value, rule)` |
| `the_watchmen.js` | Telemetry / error reporting | `watchmen.report(err, ctx)` |
| `the_witness.js` | Runtime self-checks (dev only) | `witness.check()` |

Existing modules (`TheVine`, `Nehemiah`, `Modules`, `Adornment`, `TheShepherd`, `TheFold`, `TheHarvest`, `TheWay`, `TheLife`, `TheSeason`, `TheTruth`, `TheUpperRoom`, `TheWell`, `TheWellspring`, `Trumpet`, `the_shofar`, `TheScrolls`, `Blueprint`) keep their current public APIs unchanged — only their internal files are split.

All modules are ES modules with **named exports only** (no default exports).

---

## 6. FlockChat Integration — One Immersive Experience

**Goal:** End the separate-app feel. FlockChat becomes a first-class view inside FlockOS, running on **each church's own Firebase project** — no second login, no second domain, no context switch. The standalone FlockChat at `Covenant/Courts/TheFellowship/FlockChat/` stays alive as a fallback during transition; we don't delete it.

### 6.1 What we already have working for us

- `the_word.js` (FlockChat engine) is **already multi-tenant**: `?church=<id>` selects the tenant; all Firestore paths are `churches/{churchId}/{collection}`; all RTDB paths are `/{churchId}/{collection}/...`.
- `the_upper_room.js` (FlockOS comms module) **already** runs against Firebase Firestore for DMs / rooms / channels / notifications, with `window.FLOCK_FIREBASE_CONFIG` + `window.FLOCK_CHURCH_ID` injected per church by the build.
- `Trumpet.notify` + FCM are already wired per church.
- `Adornment` themes, `Nehemiah` auth (GAS), and the FlockOS user identity are already stable across the app.

So integration is **convergence, not migration**: collapse `the_word.js` and `the_upper_room.js` into one shared comms surface that runs on the church's own Firebase.

### 6.2 New architecture for comms

```
Scripts/
└── the_upper_room/                   ← THE single comms module (split, expanded)
    ├── index.js                      ← public API + tenant resolution
    ├── the_firebase_config.js        ← reads window.FLOCK_FIREBASE_CONFIG (per-church)
    ├── the_tenant.js                 ← churchId scoping for Firestore + RTDB
    ├── the_identity.js               ← bridges Nehemiah session → Firebase Auth
    ├── the_channels.js               ← channel CRUD + real-time list
    ├── the_messages.js               ← message stream, send/edit/delete/react
    ├── the_dms.js                    ← DM thread management
    ├── the_presence.js               ← RTDB onDisconnect presence
    ├── the_typing.js                 ← typing indicators
    ├── the_unread.js                 ← unread badge math
    ├── the_mentions.js               ← @mention parsing + highlight
    ├── the_emoji.js                  ← emoji picker
    ├── the_seeding.js                ← #general / #announcements / #prayer-chain
    ├── the_attachments.js            ← image / file uploads to Storage
    └── the_push.js                   ← FCM token registration + delivery
```

`the_word.js` (in the standalone FlockChat) is **not edited**. It continues to serve the standalone app. The new `the_upper_room/` adopts its proven patterns (scoping, presence, ChordPro-free message rendering, etc.) and supersedes both modules going forward.

### 6.3 Per-church Firebase

Every church already has, or will have, its own Firebase project. The build script injects three globals before `the_upper_room/index.js` loads:

```html
<script>
  window.FLOCK_FIREBASE_CONFIG = { /* church's Firebase web config */ };
  window.FLOCK_CHURCH_ID        = "the-forest";   // tenant key
  window.FLOCK_VAPID_KEY        = "...";           // FCM web push key
</script>
```

`A-Build_Churches.sh` already does the equivalent for FlockChat hosting. Extension: read the church's Firebase config from `Covenant/Scrolls/ChurchRegistry/<Church>.json` and emit the inline `<script>` block during build. Schema additions to the church JSON:

```json
{
  "firebase": {
    "apiKey": "...",
    "authDomain": "...",
    "projectId": "...",
    "storageBucket": "...",
    "messagingSenderId": "...",
    "appId": "...",
    "vapidKey": "..."
  },
  "churchId": "the-forest"
}
```

Churches without their own Firebase fall back to the shared `flockos-notify` project (current behavior) — no regression.

### 6.4 Identity bridge (no second login)

Today: FlockOS auth = `Nehemiah` (GAS-backed sessions). FlockChat auth = Firebase email/password. Two systems.

Plan: `the_upper_room/the_identity.js` mints a **Firebase custom token** for the signed-in FlockOS user via a tiny Cloud Function that validates the Nehemiah session token. Flow:

1. User signs into FlockOS (Nehemiah). Session token in `flock_auth_session`.
2. On first comms touch, `the_identity.js` POSTs the session token to `mintFlockchatToken` Cloud Function (per-church Firebase project).
3. Function validates with FLOCK API (TheVine.john.auth.verify), returns a Firebase custom token with claims `{ churchId, role, uid }`.
4. `signInWithCustomToken` — done. Same user, same identity, no UI prompt.
5. Token cached in `the_cistern` until expiry, refreshed on demand.

This means **FlockChat's standalone email/password mode stays for the legacy app**, but the integrated experience uses Single Sign-On.

### 6.5 Comms as native views

New views under `views/` (each its own folder, ~150 lines per file):

```
views/
├── the_fellowship/              ← the chat surface inside FlockOS
│   ├── index.js                 ← layout: channel list + thread + composer
│   ├── the_channel_list.js
│   ├── the_thread.js
│   ├── the_composer.js
│   ├── the_message.js           ← single message render (one file)
│   ├── the_dm_drawer.js
│   └── the_member_pane.js
├── the_announcements/           ← read-only firehose pinned at top
│   └── index.js
└── the_prayer_chain/            ← prayer-chain channel with reaction = "praying"
    └── index.js
```

These views are pure UI — they call `the_upper_room/*` for everything. The chat surface is reachable from:
- Sidebar entry "Fellowship" (`the_pillars.js`).
- Any sermon, event, group, or person profile (deep-link to a thread).
- `the_herald` ⌘K command palette: "Open #general", "DM Pastor Greg", etc.
- Toast clicks (`the_staff` toast → routes to the message in-app, never opens a new tab).

### 6.6 Notifications converge

- `Trumpet.notify` is the only notify entry point.
- `the_upper_room/the_push.js` registers the FCM token with the church's Firebase Messaging.
- A single service worker (`the_living_water.js`) handles both app caching and FCM background message events. The existing `firebase-messaging-sw.js` in the FlockChat folder stays for the standalone app and is **not** copied into the integrated build.

### 6.7 Storage & rules

All chat data lives under `churches/{churchId}/...` in the **church's own Firestore**, not in `flockos-notify`. Firestore security rules per church repo:
- `churches/{cid}/channels/{chid}/messages/{mid}` — read if member of church, write if signed-in member, delete if author or admin.
- `churches/{cid}/dms/{tid}/messages/{mid}` — read/write only if `tid` participants include `request.auth.uid`.
- `churches/{cid}/presence/{uid}` — write only own uid.

A starter `flockchat-tenant.rules` file is added to `Covenant/Foundations/` and stitched into each church's `firestore.rules` by the build.

### 6.8 Coexistence with the legacy app

- Legacy FlockChat at `Covenant/Courts/TheFellowship/FlockChat/` continues to deploy via `firebase deploy --only hosting --project flockos-comms`.
- Build script gains `--skip-comms-legacy` flag (default: still deploys) so we can stop deploying it later without code changes.
- Once the integrated experience reaches parity for one church, we mark the legacy app deprecated; we keep it running for at least one full release cycle. We do not delete it until you explicitly say so.

### 6.9 Migration rollout (lives inside Phase II–III)

1. **Phase II.a:** Stand up `the_upper_room/` folder by splitting today's `the_upper_room.js` (no behavior change yet).
2. **Phase II.b:** Add `the_identity.js` SSO mint, deployed to one pilot church's Firebase as `mintFlockchatToken` Cloud Function.
3. **Phase II.c:** Build `views/the_fellowship/` against `the_upper_room/`. Hide behind `?covenant=new`.
4. **Phase III.a:** Backfill features from `the_word.js` we don't have yet (attachments, reactions, presence polish).
5. **Phase III.b:** Roll to second church. Validate isolation (no cross-church bleed).
6. **Phase IV:** Default for all churches. Legacy FlockChat marked deprecated, still online.

---

## 7. View Module Pattern

```js
// views/the_good_shepherd.js
export const name = 'the_good_shepherd';
export const route = '/';
export const title = 'The Good Shepherd';

export function render(params) {
  return /* html */ `
    <section class="pasture">
      <h1>Welcome to the fold</h1>
      <div data-bind="flock-count"></div>
    </section>
  `;
}

export function mount(root, ctx) {
  // attach listeners, subscribe to the_well, etc.
  return () => { /* unmount */ };
}
```

`the_scribes/index.js` lazy-imports the view, calls `render` → swaps into `#the-holy-place` → calls `mount` → stores the returned `unmount` for next navigation.

---

## 8. Backend Reality (as-built v1.0 — the ground truth)

The master architectural docs in this folder describe the **actual** backend. The redesign is built on top of it without changing any of it.

### 8.1 The four-file GAS stack (per church)

Every church's deployment is one container-bound Google Apps Script project with these files (sourced from the master docs):

| File | Master Doc | Role |
|---|---|---|
| `Code.gs` | [B-Master Code.md](B-Master%20Code.md) | All API endpoints (TheVine routes here), auth, RBAC, AppConfig, triggers, the full 90-tab schema (`_TAB_HEADERS_`), `FirestoreSync.gs`, `SyncHandler.gs`, and `CamelCase.gs` sections. |
| `Setup.gs` | [C-Setup.md](C-Setup.md) | Script Property installer — paste once, run `setAllScriptProperties`, then delete. |

### 8.2 Per-church Firebase is already real

From `B-Master Code.md`:
- `FIRESTORE_PROJECT_ID` (Script Property) — defaults to `flockos-notify` (shared) but each church can be its own project (e.g. `flockos-trinity`, `flockos-theforest`).
- `FIRESTORE_CHURCH_ID` is auto-resolved from Script Properties → ChurchRegistry tab (col G ShortName) → DEPLOY_CONFIG.churchName → `'FlockOS'`.
- Truth content has its own project (`flockos-truth`) with its own service account.
- `setupFlockOSGAS()` vs `setupFlockOSFirestore()` are the two deployment modes — GAS-only (all ~90 tabs built upfront via the `_TAB_HEADERS_` loop) or Firestore-backed (8 auth/system tabs + lazy creation on first data write).

**Implication for this redesign:** integrating FlockChat into each church's own Firebase (§6) is the **natural extension** of an already-multi-Firebase system, not a new architecture.

### 8.3 The four collection domains (TheVine's four gospels)

`SYNC_TAB_MAP` (in the `SyncHandler.gs` section of `B-Master Code.md`) enumerates the canonical collections, grouped by gospel:

- **Matthew (App content):** `books`, `genealogy`, `counseling`, `devotionals`, `reading`, `words`, `heart`, `mirror`, `theology`, `quiz`, `apologetics`, `config`.
- **Mark (Missions):** `missionsRegistry`, `missionsRegions`, `missionsCities`, `missionsPartners`, `missionsPrayerFocus`, `missionsUpdates`, `missionsTeams`, `missionsMetrics`.
- **Luke (Statistics):** `statisticsConfig`, `statisticsSnapshots`, `statisticsViews`.
- **John (Pastoral / Flock):** `members`, `prayers`, `journal`, `contactLog`, `pastoralNotes`, `milestones`, `households`, `todos`, `attendance`, `events`, `rsvps`, plus comms (`channels`, `messages`, `dms`, `presence` once FlockChat folds in).

The redesign maps **directly** to this layout — `views/` are organized along these same gospel groupings, and `the_true_vine` continues to be the only path between the UI and the backend.

### 8.4 Field-name discipline

`CamelCase.gs` is the **source of truth** for Firestore ↔ Sheet field mapping. The redesign:
- Never invents new field names without adding them to the master `CamelCase.gs` and regenerating via `A-Build_Churches.sh`.
- Uses the camelCase form everywhere in JS (matches Firestore docs).
- The Sheet column header is only seen by GAS / pastors editing the spreadsheet.

### 8.5 Implications added to the redesign plan

- **No view bypasses TheVine.** Even when reading directly from Firestore (chat, content), it still flows through `TheVine.john.*` style adapters so claims, RBAC (`Temple.can`), and tenant scoping stay consistent.
- **The Cloud Function for FlockChat SSO (§6.4) lives in the same Firebase project as the church's other comms collections** — one project, one ruleset, one VAPID key.
- **Build script extension (§6.3) reads ChurchRegistry**, which is already the authoritative list (referenced in the `FirestoreSync.gs` section of `B-Master Code.md`). We don't introduce a parallel registry.
- **Field additions for FlockChat tenancy** (`channels`, `messages`, `dms`, `presence`, `reactions`, `attachments`) get appended to `SYNC_TAB_MAP` and `FIELD_REVERSE_MAP` so the hourly Sheet backup picks them up automatically. Tabs auto-create lazily via `SyncHandler`.
- **Two-mode deployments stay supported:** the redesign works for both `setupFlockOSGAS()` (all data via GAS, no Firestore) and `setupFlockOSFirestore()` (Firestore-backed). For GAS-only churches, FlockChat falls back to the shared `flockos-notify` project — never breaks.

---

## 9. Data & State

- **Backend additions are additive, not breaking.** New endpoints (`serviceOrders.get`, `serviceOrders.save`) and schema entries are appended to `Code.gs` without touching existing routes, auth, or `the_living_water.js`. `FirestoreSync.gs` and `SyncHandler.gs` (both in `B-Master Code.md`) are unchanged.
- **No global mutable state object.** Server-cached state lives in `the_manna` (in-memory) + `the_cistern` (IndexedDB). Local prefs live in `Adornment` (theme) and `TheScrolls` (interaction ledger).
- **No Redux/MobX.** Just events + cache invalidation. Tiny surface.
- Views never touch Firebase or GAS directly — only `TheVine` (read/write) or `the_upper_room/` (live comms).

---

## 10. UX North Star (the "far better, far more profound" part)

The redesign is judged on **experience**, not features. The backend stays — the surface gets reborn.

**Principles**
- **Calm by default.** Generous whitespace, slow easing, no jitter. Motion serves meaning (`the_oil` is the only animator).
- **One clear next step on every screen.** A single primary action; everything else recedes.
- **Scripture in the seams.** Quiet biblical micro-copy at empty states, loading states, and completion moments — never preachy, never pop-up.
- **Instant feel.** First paint < 1s on 4G; route changes feel free because views are tiny and the shell never reloads.
- **Offline-tolerant.** `the_well` + `the_cistern` (IndexedDB) keep the last-known good state. The app never shows a blank screen.
- **Forgiving inputs.** `the_stones` validates inline, with kind language. Destructive actions always reversible (undo via `the_shofar` toasts).
- **Accessibility is non-negotiable.** Keyboard-complete, focus-visible, prefers-reduced-motion respected, contrast AA minimum, screen-reader landmarks on `the_veil`.
- **One quiet command palette** (`the_herald`, ⌘K) replaces buried menus. Every action in the app is reachable from it.
- **Personal, not generic.** Greeting reflects time of day + season + the user's role. Empty states reference the user by name where possible.
- **Prayer-aware pacing.** Long actions (deploy, sync, build) show a meaningful progress narrative, not a spinner — anchored in `the_harvest`.

**UX deliverables per view**
1. Empty state (with copy + illustration hook).
2. Loading skeleton (no spinners — shape-of-content placeholders).
3. Error state (kind, actionable, never a stack trace).
4. Success/completion micro-moment.
5. Keyboard shortcuts registered with `the_herald`.

---

## 11. Styling

- Continue using `Covenant/Foundations/SharedVessels/styles/american_garments.css` as the only stylesheet.
- Add new sections inside it with biblical headers (`/* ===== The Veil ===== */`, `/* ===== The Lampstand ===== */`, etc.).
- Per-view CSS lives as scoped class prefixes (`.pasture-*`, `.upper-*`) inside the same file — no per-view stylesheets.

---

## 12. Build & Deploy

No change to the pipeline:
- Author everything under `/FlockOS/` (master).
- `bash "Iris/Bezalel/Scripts/A-Build_Churches.sh"` rsyncs to every Nation, regenerates codex, syncs SharedVessels CSS.
- Deploy command unchanged: `--deploy-comms` flag for FlockChat.

The redesign adds **no new build step**. Modules are served as-is (HTTP/2, no bundler). If perf demands later, add a single esbuild step that emits one `the_ark.bundle.js`.

New build-script responsibilities (extensions only — no rewrites):
- Read each church's Firebase config from `Covenant/Scrolls/ChurchRegistry/<Church>.json` and inject `window.FLOCK_FIREBASE_CONFIG`, `window.FLOCK_CHURCH_ID`, `window.FLOCK_VAPID_KEY` into the new `FlockOS.html` shell.
- Stitch `flockchat-tenant.rules` into each church's `firestore.rules`.
- Regenerate `CamelCase.gs` whenever new comms field names are added.
- Optional `--skip-comms-legacy` flag (default off) to retire the standalone FlockChat hosting later.

---

## 13. Phased Rollout

**Phase I — Foundation (the shell stands up)**
- Create `the_ark.js`, `the_scribes/`, `the_veil/`, `the_lampstand.js`, `the_priesthood/`, `the_oil.js`, `the_stones.js`, `the_manna.js`, `the_cistern.js`, plus first vessels (`the_chalice`, `the_basin`, `the_seal`, `the_mantle`, `the_staff`).
- New `FlockOS.html` shell behind `?covenant=new` query flag; old shell remains default.
- One view ported: `views/the_good_shepherd/` (home).
- No backend touches. No new GAS files. No Firebase rule changes.

**Phase II — The Priesthood & The Well**
- `the_priesthood.js` wired to existing Firebase auth.
- `the_well.js` wraps `the_living_water.js`; first cached read paths defined.
- Port: `the_fold`, `the_invitation`.

**Phase III — The Congregation of Views**
- Port remaining `Pages/*.html` to `views/*.js` one at a time. Each port deletes the old HTML page.
- Pages list to migrate: `the_great_commission`, `the_upper_room`, `the_pentecost`, `the_wall`, `the_generations`, `the_seasons`, `the_anatomy_of_worship`, `the_call_to_forgive`, `the_gift_drift`, `the_weavers_plan`, `prayerful_action`, `quarterly_worship`, `fishing-for-men`, `fishing-for-data`, `software_deployment_referral`, `bezalel`, `bezalel_matrix`, `About_FlockOS`, `Learn More`.

**Phase IV — Crossing Over**
- Flip `?covenant=new` to default. Old shell renamed `FlockOS.legacy.html` for one release.
- After one stable release: delete legacy shell + `Pages/` entirely.

**Phase V — Refinement**
- `the_witness` runtime self-checks in dev builds.
- `the_watchmen` analytics consolidated.
- Optional bundler step if needed.

---

## 14. Definition of Done (per phase)

- [ ] No regression in any view that already worked.
- [ ] No file with a non-biblical name added to `/FlockOS/Scripts/`, `/FlockOS/views/`, or `/FlockOS/vessels/`.
- [ ] **No JS file exceeds 300 lines.** CI/lint check or pre-commit grep enforces this.
- [ ] Every view ships all 5 UX states: empty, loading skeleton, error, success moment, keyboard entry via `the_herald`.
- [ ] Backend untouched — no diffs in Firestore rules, Cloud Functions, or `the_living_water.js`.
- [ ] `american_garments.css` remains the only stylesheet.
- [ ] `A-Build_Churches.sh` deploys cleanly to all Nations.
- [ ] No duplicate ` 2.js` / ` 3.html` files left behind.
- [ ] Lighthouse: performance ≥ 90, accessibility ≥ 95, no blocking JS in `<head>`.

---

## 15. What This Plan Does NOT Do

- Does not restore any deleted file.
- Does not change Firebase project layout, Firestore rules, or the FlockChat repo.
- Does not introduce TypeScript, React, Vue, Svelte, Tailwind, or a bundler in Phase I–IV.
- Does not touch Church/Nation deployments directly — only the master under `/FlockOS/`.

---

## 16. First Concrete Step (when you say "go")

1. Create `New_Covenant/Scripts/the_ark.js` (boot).
2. Create `New_Covenant/Scripts/the_scribes.js` (router).
3. Create `New_Covenant/Scripts/the_veil.js` (shell chrome).
4. The shell entry point is `New_Covenant/index.html` (already live, gated by `?covenant=new`).
5. Port `the_good_shepherd` as the first view.
6. Build. Verify. Then proceed to Phase II.

# FlockOS

> *"I am the vine; you are the branches."* — John 15:5

A ministry operating system for the local church — multi-backend, offline-capable, and free to deploy. One codebase. Unlimited churches. No subscriptions, no server, no infrastructure.

---

## What It Is

FlockOS is a full-featured, multi-church ministry platform. A single codebase powers unlimited church deployments, each with independent branding and its own backend. Members, pastoral care, prayer, giving, attendance, events, songs, missions, discipleship, and more — all in a progressive web app served from GitHub Pages.

The platform has two generations:

| Generation | Folder | Status | Description |
|-----------|--------|--------|-------------|
| **Covenant** | `Covenant/` | Stable / legacy | Original GAS+Sheets architecture. Multi-page HTML, per-page JS modules. |
| **New Covenant** | `New_Covenant/` | Active / primary | Rebuilt from scratch as an ES module SPA. One HTML shell, modular JS, Firestore-native. Served directly via GitHub Pages. |

A companion real-time messaging app (**FlockChat**) is hosted separately on Firebase.

---

## Architecture

| Layer | Technology | Details |
|-------|-----------|---------|
| **Database (Covenant)** | Google Sheets | 200 tabs, one Sheet per church |
| **Database (New Covenant)** | Firebase Firestore | Real-time, cloud-native, multi-tenant |
| **API (Covenant)** | Google Apps Script | One unified Web App endpoint per church |
| **Front-end** | HTML + Vanilla ES Modules | GitHub Pages, no build step |
| **Messaging** | Firebase (Firestore + FCM) | FlockChat — real-time rooms, DMs, presence, push |
| **Auth (FlockOS)** | SHA-256 + salt + pepper | RBAC — 6 permission levels |
| **Auth (FlockChat)** | Firebase Auth | Email/password |
| **Offline** | Service Worker + IndexedDB | Full offline capability via TheWellspring |

### GAS API Domains (Covenant)

| Domain | Codename | Tabs | Purpose |
|--------|----------|-----:|---------|
| **FLOCK** | John | 79 | Members, auth, pastoral care, services, songs, communications |
| **EXTRA** | Luke | 53 | Analytics, metrics, expansion slots |
| **APP** | Matthew | 12 | Public content — devotionals, lexicon, quiz, theology |
| **MISSIONS** | Mark | 56 | Persecution data, country dossiers, mission teams |

**Total: 200 tabs · 1 Google Sheet · 1 GAS Web App endpoint per church**

---

## Repository Structure

```
Software/
│
├── index.html                    Root landing page (GitHub Pages root)
├── firebase.json                 Firebase hosting config (FlockChat)
├── README.md
│
├── New_Covenant/                 ★ PRIMARY SOURCE — ES module SPA
│   ├── index.html                App shell — single HTML entry point
│   ├── the_living_water.js       Service worker
│   ├── Scripts/                  All JS modules (see New Covenant Scripts below)
│   ├── Styles/                   new_covenant.css — all app styles
│   ├── Views/                    49 view modules (JS-rendered pages)
│   ├── Data/                     Bundled content — Strong's, OYB, devotionals, etc.
│   ├── app.flockos/              FlockOS authenticated app shell
│   ├── app.grow/                 GROW public outreach app shell
│   ├── app.invite/               The Invitation public shell
│   ├── app.stand/                Music Stand standalone shell
│   └── app.embeds/               Embeddable iframes (about, grow, flockos, stand)
│
├── Nations/                      ★ BUILD OUTPUT — B-Build rsync target
│   └── <Church>/                 One folder per church — copy of New_Covenant/
│       ├── Root/                 FlockOS default deployment
│       ├── FlockOS/              FlockOS branded
│       ├── TBC/                  Trinity Baptist Church
│       ├── TheForest/            The Forest
│       └── GAS/                  GAS (Google Apps Script backend)
│
├── Covenant/                     Legacy Covenant architecture (stable)
│   ├── Courts/
│   │   ├── TheTabernacle/        Canonical Covenant FlockOS source
│   │   ├── TheFellowship/        FlockChat source (legacy copy)
│   │   └── TheUpperRoom/         ATOG source
│   ├── Nations/                  Covenant church deployments (A-Build output)
│   ├── Scrolls/ChurchRegistry/   Church JSON config files
│   ├── Foundations/SharedVessels/ Shared CSS source (american_garments.css)
│   └── Shepherds/Build/          Symlinks → Iris/Shepherds/Build/
│
├── flockchat-public/             FlockChat deploy source (→ Firebase hosting)
│   ├── FlockChat.html            App shell
│   └── FlockChat/the_word.js    All client logic
│
└── Iris/                         Operational toolbox — build scripts & automation
    ├── Bezalel/Scripts/          A-Build_Churches.sh, B-Build_Nations.sh, B-Export_Standalone.sh
    ├── Shepherds/Build/          13 Firestore seed & data migration scripts
    ├── Runbooks/                 Snapshot.sh and operational runbooks
    └── Automation/               Scheduled automation utilities
```

> **Never edit** `Nations/<Church>/` directly — it is B-Build output.
> **Never edit** `Covenant/Nations/<Church>/` directly — it is A-Build output.
> All source changes go in `New_Covenant/` (New Covenant) or `Covenant/Courts/TheTabernacle/` (Covenant).

---

## New Covenant — Source Files

### Core Scripts (`New_Covenant/Scripts/`)

| File | Lines | Role |
|------|------:|------|
| `the_tabernacle.js` | 21,764 | Core renderer — all authenticated module UIs, nav, routing |
| `the_upper_room.js` + `the_upper_room/` | 5,335 | Firebase Firestore comms — DMs, channels, notifications, presence |
| `the_life.js` + `the_life/` | 4,993 | My Flock Portal — pastoral care, prayer, care cases, compassion |
| `the_way.js` + `the_way/` | 3,949 | Learning Hub — courses, quizzes, theology, lexicon, apologetics, devotionals |
| `the_seasons.js` + `the_seasons/` | 2,696 | Calendar, Tasks & Check-In Hub |
| `the_true_vine.js` | 1,411 | Centralized API client — GAS + Firestore branches |
| `the_shepherd.js` + `the_shepherd/` | 1,278 | People Engine — member search, profile, 3-step save |
| `grow_public.js` | 705 | GROW public app — routing, prayer, sign-up, public modules |
| `the_harvest.js` + `the_harvest/` | 951 | Ministry Hub — events, sermons, service plans |
| `the_truth.js` + `the_truth/` | 938 | Content Editor — CRUD for all Firestore content tabs |
| `the_wellspring.js` + `the_wellspring/` | 746 | Local data layer — IndexedDB offline mode |
| `firm_foundation.js` | 713 | Auth guard — login, register, RBAC, route guard |
| `the_well.js` + `the_well/` | 579 | Backup & restore — `.xlsx` templates, SheetJS |
| `the_ark.js` | 398 | Firestore sync engine |
| `the_living_water_adapter.js` | 334 | API adapter — GAS ↔ Firestore compatibility layer |
| `the_scrolls.js` + `the_scrolls/` | 316 | Interaction Ledger — 30+ pastoral touchpoint types |
| `the_fold.js` + `the_fold/` | 302 | Groups & Attendance |
| `fine_linen.js` | 275 | CSS theme system |
| `the_manna.js` | 202 | Daily content — devotionals, reading plans |
| `the_watchmen.js` | — | Notification & alert system |
| `the_witness.js` | — | Analytics & event tracking |
| `the_cistern.js` | — | Local cache layer |
| `the_comms.js` | — | Email/SMS communication engine |
| `the_lampstand.js` | — | UI lighting / theme bridge |
| `the_stones.js` | — | Audit logging |
| `the_window_bridge.js` | — | Cross-frame messaging bridge |
| `the_living_water_register.js` | 124 | Service worker registration |
| `bezalel_codex.js` | — | Auto-generated build registry (do not edit) |

**Total: ~53,000 lines of JavaScript across the New Covenant script tree**

### Public GROW Modules (`New_Covenant/Scripts/the_gospel/`)

| File | Lines | Module |
|------|------:|--------|
| `the_gospel_invitation.js` | 901 | The Invitation — full Gospel presentation |
| `the_gospel_missions.js` | 343 | World Missions — country dossiers, prayer focus |
| `the_gospel_reading.js` | 258 | Reading Plans — One Year Bible |
| `the_gospel_quizzes.js` | 253 | Bible Quizzes |
| `the_gospel_teaching_plans.js` | 250 | Teaching Plans |
| `the_gospel_counseling.js` | 243 | Pastoral Counseling resources |
| `the_gospel_shared.js` | 219 | Shared GROW utilities |
| `the_gospel_theology.js` | 187 | Theology reference |
| `the_gospel_devotionals.js` | 182 | Daily Devotionals |
| `the_gospel_lexicon.js` | 172 | Strong's Lexicon |
| `the_gospel_mirror.js` | 171 | Heart Mirror — scripture-based self-examination |
| `the_gospel_heart.js` | 169 | Heart Check |
| `the_gospel_courses.js` | 136 | Ministry Courses |
| `the_gospel_psalms.js` | 134 | Psalms reader |
| `the_gospel_library.js` | 130 | Resource Library |
| `the_gospel_genealogy.js` | 126 | Biblical Genealogy |
| `the_gospel_analytics.js` | 125 | GROW Analytics |
| `the_gospel_apologetics.js` | 119 | Apologetics reference |
| `the_gospel_why.js` | — | The Why — About FlockOS (embed-about.html iframe) |

### Bundled Data (`New_Covenant/Data/`)

| File | Contents |
|------|---------|
| `strongs-hebrew.js` | Strong's Hebrew concordance |
| `strongs-greek.js` | Strong's Greek concordance |
| `one_year_bible.js` | One Year Bible daily reading plan |
| `devotionals.js` | Daily devotional content |
| `theology.js` | Systematic theology reference |
| `apologetics.js` | Apologetics content |
| `counseling.js` | Pastoral counseling resources |
| `teaching_plans.js` | Teaching plan data |
| `quiz.js` | Bible quiz bank |
| `heart.js` | Heart check content |
| `mirror.js` | Heart mirror content |
| `library.js` | Resource library entries |
| `genealogy.js` | Biblical genealogy data |
| `psalms.js` | Psalms content |
| `missions.js` | Missions country data |
| `reading-plans.js` | Reading plan metadata |
| `books-of-the-bible.js` | Books reference |
| `seed_database.json` | Firestore seed data |

---

## Covenant — Source Files (Legacy)

### Pages (`Covenant/Courts/TheTabernacle/Pages/`)

| File | Lines | Description |
|------|------:|-------------|
| `the_good_shepherd.html` | 2,423 | **Main app shell** — primary authenticated UI |
| `the_great_commission.html` | 2,410 | Admin Hub — deployment, permissions, audit, config |
| `the_pentecost.html` | 2,057 | Comprehensive as-built & deployment guide |
| `bezalel.html` | 1,786 | Bezalel Matrix — interactive architecture map |
| `quarterly_worship.html` | 1,716 | Quarterly Worship planner |
| `fishing-for-men.html` | 824 | Value proposition / evangelism pitch |
| `the_wall.html` | 635 | Login page |
| `the_gift_drift.html` | 527 | Spiritual Gifts — 4-phase curriculum |
| `the_anatomy_of_worship.html` | 493 | Teaching — Anatomy of Worship |
| `the_call_to_forgive.html` | 480 | Teaching — The Call to Forgive |
| `the_generations.html` | 460 | Teaching — Generational Dynamics |
| `the_weavers_plan.html` | 408 | Teaching — The Weaver's Plan (Joseph) |
| `prayerful_action.html` | 387 | Teaching — Prayerful Action |
| `the_invitation.html` | 370 | Teaching — The Invitation |
| `About_FlockOS.html` | 327 | Vision / The Why page |
| `Learn More.html` | 175 | Feature overview marketing page |

### Scripts (`Covenant/Courts/TheTabernacle/Scripts/`)

| File | Lines | JS Object | Role |
|------|------:|-----------|------|
| `the_tabernacle.js` | 21,646 | `Modules` | Core renderer — 48+ module UIs, Themes, Interface Studio |
| `fine_linen.js` | 6,271 | `Adornment` | CSS theme system — 13 themes + Interface Studio styles |
| `the_upper_room.js` | 4,919 | `UpperRoom` | Firebase Firestore comms — DMs, channels, notifications |
| `the_life.js` | 4,499 | `TheLife` | My Flock Portal — pastoral care, prayer, care cases, compassion |
| `the_way.js` | 3,551 | `TheWay` | Learning Hub — 16-tab education dashboard |
| `the_seasons.js` | 2,519 | `TheSeason` | Calendar, Tasks & Check-In Hub |
| `the_shofar.js` | 2,102 | `musicStandAppState` | Song library, chord charts, Music Stand, PDF export |
| `the_true_vine.js` | 1,410 | `TheVine` | Centralized API client — 4 domains (John/Luke/Matthew/Mark) |
| `the_shepherd.js` | 1,377 | `TheShepherd` | People Engine — member search, profile, 3-step save |
| `the_commission.js` | 1,334 | `Blueprint` | Deployment automation blueprint |
| `the_harvest.js` | 951 | `TheHarvest` | Ministry Hub — events, sermons, service plans |
| `the_cornerstone.js` | 807 | `Temple` | Architecture registry (runtime-queryable) |
| `the_truth.js` | 756 | `TheTruth` | Content Editor — full CRUD for all public content tabs |
| `the_wellspring.js` | 752 | `TheWellspring` | Local data layer — IndexedDB offline mode |
| `firm_foundation.js` | 581 | `Nehemiah` | Auth guard — login, logout, RBAC, route guard |
| `the_well.js` | 579 | `TheWell` | Google Drive sync for offline churches |
| `the_trumpet.js` | 486 | `Trumpet` | Phone, share, notifications, QR, geolocation |
| `the_scrolls.js` | 316 | `TheScrolls` | Interaction Ledger — 30+ pastoral touchpoint types |
| `the_fold.js` | 302 | `TheFold` | Groups & Attendance |
| `the_living_water.js` | 232 | _(service worker)_ | Service worker source |

**Total: ~55,500 lines of JavaScript across 20 files**

---

## FlockChat

| File | Lines | Role |
|------|------:|------|
| `flockchat-public/FlockChat.html` | 454 | App shell — Firebase config, CSS, HTML structure |
| `flockchat-public/FlockChat/the_word.js` | 2,051 | All client logic — auth, channels, DMs, roles, admin dashboard |

**Deployed to:** `https://flockos-comms.web.app` (serves all churches via `?church=` URL param)

### FlockChat Role & Permission System

| Role | Level | Permissions |
|------|------:|-------------|
| `readonly` | 0 | Read-only access to visible channels |
| `volunteer` | 1 | Post messages, join public channels |
| `care` | 2 | Same as volunteer |
| `leader` | 3 | Create channels (public, private, role-gated) |
| `pastor` | 4 | Admin dashboard — manage users & rooms |
| `admin` | 5 | Full access |

| Channel Type | Behavior |
|------|---------|
| **Public** | Any member can join |
| **Private** | Invite-only; non-members see a "contact an admin" message |
| **Role-Gated** | Requires minimum role; hidden from users below threshold |

---

## Build System

### Two build scripts, two generations

| Script | Command | Purpose |
|--------|---------|---------|
| **A-Build** | `bash "Iris/Bezalel/Scripts/A-Build_Churches.sh"` | Builds Covenant deployments → `Covenant/Nations/<Church>/` |
| **B-Build** | `bash "Iris/Bezalel/Scripts/B-Build_Nations.sh"` | Syncs New Covenant → `Nations/<Church>/` with per-church patches |
| **BCP** | `bash "Iris/Bezalel/Scripts/A-Build_Churches.sh" --deploy-comms` | A-Build + Firebase deploy of FlockChat |

### A-Build — what it does

1. Reads each `.json` config in `Covenant/Scrolls/ChurchRegistry/`
2. Fetches live church configs from the master API and regenerates `bezalel_codex.js`
3. Publishes combined schema backup to Firestore (`flockos-truth`)
4. Rsyncs `Covenant/Courts/TheTabernacle/` → `Covenant/Nations/<Church>/`
5. Patches database URL, theme colors, brand text, manifest per church

### B-Build — what it does

1. Rsyncs `New_Covenant/` → `Nations/<Church>/` for each config in `Covenant/Scrolls/ChurchRegistry/`
2. Patches `the_true_vine.js` GAS endpoints per church
3. Patches `the_living_water.js` `CACHE_NAME` per church (e.g. `flockos-tbc-v1.01`)
4. Patches Firebase config, app title, and manifest per church
5. Strips Firebase config for GAS-only builds
6. Logs a Generations entry to Firestore on success

### When to run which build

| Changed | Run |
|---------|-----|
| `New_Covenant/` source | B-Build → commit + push |
| `Covenant/Courts/TheTabernacle/` source | A-Build → commit + push |
| `flockchat-public/` source | BCP (`--deploy-comms`) → commit + push |
| Docs / `Architechtural Docs/` only | commit + push only (no build needed) |

### Church config schema (`Covenant/Scrolls/ChurchRegistry/ChurchTemplate.json`)

```json
{
  "id": "",
  "name": "",
  "shortName": "",
  "brandName": "",
  "tagline": "Church Management & Ministry Platform",
  "favicon": "",
  "themeColor": "#e8a838",
  "backgroundColor": "#1a1a2e",
  "databaseUrl": "",
  "adminEmail": "",
  "analyticsId": "",
  "firebaseConfig": {}
}
```

### Active Deployments

| Short Name | Church | New Covenant URL |
|------------|--------|-----------------|
| `Root` | FlockOS (default) | `Nations/Root/` |
| `FlockOS` | FlockOS branded | `Nations/FlockOS/` |
| `TBC` | Trinity Baptist Church | `Nations/TBC/` |
| `TheForest` | The Forest | `Nations/TheForest/` |
| `GAS` | FlockOS-GAS (GAS backend) | `Nations/GAS/` |

---

## Iris — Operational Toolbox

`Iris/` contains all build scripts, data migration utilities, and operational runbooks. Never edit contents of `Nations/` or `Covenant/Nations/` directly — use Iris scripts.

```
Iris/
├── Bezalel/Scripts/
│   ├── A-Build_Churches.sh           Covenant multi-church build
│   ├── B-Build_Nations.sh            New Covenant multi-church sync
│   ├── B-Export_Standalone.sh        Export standalone church bundle
│   ├── publish_truth_schema_backup.cjs  Schema backup to Firestore
│   └── generate_schema_manifest_from_sql.cjs
├── Shepherds/Build/                  13 Firestore seed & migration scripts
├── Runbooks/
│   └── Snapshot.sh                   Incremental local snapshot (hardlink)
└── Automation/                       Scheduled automation utilities
```

`Covenant/Shepherds/Build/` contains symlinks → `Iris/Shepherds/Build/` for legacy path compatibility.

---

## Deploying a New Church Backend (Covenant / GAS)

Full step-by-step instructions: `Covenant/Courts/TheTabernacle/Pages/the_pentecost.html`

1. Create a Google Sheet named **FlockOS — [Church Name]**
2. Open Apps Script (Extensions → Apps Script), paste `Code.gs`, set `churchName` and `timezone`
3. Run **`setupFlockOS`** — builds all 200 tabs, seeds content, creates admin account, installs email triggers
4. Deploy → **New Deployment → Web App** (Execute as: Me, Who has access: Anyone)
5. Copy Web App URL into `DEPLOY_CONFIG.churchAppUrl`, run **`registerChurchUrl`**
6. Add URL as `databaseUrl` in church JSON config, run A-Build

---

## Authentication

| Property | Value |
|----------|-------|
| Method | Email + passcode |
| Hashing | SHA-256 · per-user salt · server-side pepper |
| Session TTL | 6 hours (configurable in AppConfig) |
| RBAC levels | `readonly` (0) · `volunteer` (1) · `care` (2) · `leader` (3) · `pastor` (4) · `admin` (5) |

---

## Key Features

- **Member Management** — Full CRUD with pastoral notes, tags, contact masking
- **Member Cards** — Sequential card numbers with configurable prefix
- **Pastoral Care** — 13 care types with per-type workflow guides, interaction logging, follow-up scheduling, and daily pastoral summary emails
- **Prayer** — Public submission, status tracking, assignment, pastoral reply, one-click conversion to spiritual care case
- **Compassion & Outreach** — Benevolence fund, needs tracking, campaigns
- **Discipleship** — Growth paths, milestones, courses, quizzes
- **Daily Devotional** — Scripture, reflection, reading plan, journal, prayer
- **Learning Hub** — Education portal: courses, quizzes, theology, lexicon, apologetics, counseling, devotionals, reading plans, certificates
- **World Missions** — Country dossiers, partner tracking, prayer focus, team management
- **Music Stand** — Song CRUD, ChordPro charts, arrangement management, live setlist, PDF export
- **Calendar** — Month/week/day/agenda, personal events, iCal feeds, recurrence, task management
- **Service Planning** — Order builder with item scheduling
- **Attendance & Check-In** — Small groups, Bible studies, event check-in
- **Communications** — Email/SMS templates, campaign tracking, delivery logs
- **Statistics** — Attendance, giving, growth analytics dashboards
- **Themes** — Built-in themes, dark/light auto, personal theme picker
- **Offline Mode (TheWellspring)** — Full offline capability via IndexedDB — AES-GCM 256-bit encrypted vault, PBKDF2 key derivation
- **Google Drive Sync (TheWell)** — Auto-sync church data backed by Drive `.xlsx` files
- **Automated Pastoral Emails** — Care follow-up reminders, escalation alerts, daily 6 AM pastoral summary
- **GROW Public App** — Public-facing outreach page: The Invitation, devotionals, lexicon, missions, teaching resources
- **FlockChat** — Real-time church messaging with role-gated channels, private rooms, DMs, presence, push notifications, full admin dashboard
- **Multi-Church** — Unlimited church deployments from one codebase, each with independent branding and backend
- **Content backed by Firestore Truth** — Strong's Hebrew/Greek (210 countries), OYB, devotionals, theology, apologetics, counseling — seeded via `Iris/Shepherds/Build/`

---

## License

**Proprietary — All Rights Reserved.**

All contents of this repository — including all source code, scripts, pages, assets, build tools, and documentation — are the exclusive intellectual property of Greg Granger.

No portion of this software may be used, copied, modified, distributed, or deployed in any form without **express prior written permission** from the copyright holder. This applies to all components without exception, including the CRM software, FlockChat, learning modules, and all build and deployment tooling.

Licensing for churches, organizations, and developers is available upon request.

See [LICENSE](LICENSE) for full terms.

---

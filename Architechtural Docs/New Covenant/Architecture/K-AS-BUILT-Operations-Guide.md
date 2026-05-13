# New Covenant — As-Built Operations Guide

> Last updated: 2026-05-13

---

## 1. Repo Layout

```
Software/
├── New_Covenant/               ★ PRIMARY SOURCE — all edits go here
│   ├── index.html              App shell entry point
│   ├── the_living_water.js     Service worker
│   ├── Scripts/                All JS modules + the_gospel/ submodules
│   ├── Styles/new_covenant.css All app CSS (New Covenant)
│   ├── Views/                  49 JS-rendered view modules
│   ├── Data/                   Bundled content (Strong's, OYB, devotionals, etc.)
│   ├── app.embeds/             Embeddable iframes (8 embeds incl. launcher, feed, flockchat, flockshow)
│   ├── app.feed/               The Feed — Sermon Prep & Manuscript Builder
│   ├── app.flockchat/          FlockChat — church team messaging standalone PWA
│   ├── app.flockos/            FlockOS authenticated app shell
│   ├── app.flockshow/          FlockShow — church presentation app
│   ├── app.grow/               GROW public outreach shell
│   ├── app.invite/             The Invitation public shell
│   └── app.stand/              Music Stand standalone shell
│
├── Nations/                    BUILD OUTPUT — B-Build rsync target
│   ├── Root/                   FlockOS default
│   ├── FlockOS/                FlockOS branded
│   ├── TBC/                    Trinity Baptist Church
│   ├── TheForest/              The Forest
│   └── GAS/                    GAS backend variant
│
├── Covenant/                   Legacy GAS/Sheets generation (stable)
│   ├── Courts/TheTabernacle/   Covenant source (Pages/ + Scripts/)
│   ├── Nations/                Covenant build output (A-Build)
│   ├── Scrolls/ChurchRegistry/ Church JSON configs (shared by A-Build + B-Build)
│   └── Foundations/SharedVessels/styles/american_garments.css  Covenant shared CSS
│
├── Iris/                       Operational toolbox
│   ├── Bezalel/Scripts/        Build scripts
│   ├── Shepherds/Build/        13 Firestore seed/migration scripts
│   └── Runbooks/Snapshot.sh    Incremental hardlink snapshot
│
└── flockchat-public/           FlockChat deploy source → Firebase hosting
    ├── FlockChat.html
    └── FlockChat/the_word.js
```

**CSS source of truth:**
- New Covenant: `New_Covenant/Styles/new_covenant.css`
- Covenant (legacy): `Covenant/Foundations/SharedVessels/styles/american_garments.css`

Do **not** edit `Nations/<Church>/` directly — it is B-Build output. Do **not** edit `Covenant/Nations/<Church>/` directly — it is A-Build output.

---

## 2. Build System

### B-Build (New Covenant → Nations)

```bash
bash "Iris/Bezalel/Scripts/B-Build_Nations.sh"
```

Per church, B-Build:
1. `rsync`s `New_Covenant/` → `Nations/<Church>/`
2. Patches `Scripts/the_true_vine.js` GAS endpoint URLs (all 4 gospels)
3. Patches `the_living_water.js` `CACHE_NAME` (e.g. `flockos-tbc-v1.01`)
4. Patches Firebase config into `app.flockos/app.flockos.html` (step 5)
5. Patches Firebase config into `app.grow/app.grow.html` (step 6)
6. Patches Firebase config into `app.embeds/embed-flockos.html` (step 8)
7. Patches Firebase config into `app.embeds/embed-grow.html` (step 9)
8. Patches Firebase config into `app.embeds/embed-stand.html` (step 9b)
9. Patches Firebase config into `app.embeds/embed-flockshow.html` (step 9c)
10. Patches church name + base URL into `app.embeds/embed-launcher.html` (step 9d)
11. Patches Firebase config into `app.embeds/embed-flockchat.html` (step 9e)
12. Patches Firebase config into `app.embeds/embed-feed.html` (step 9f)
13. Patches Firebase config into `app.feed/feed.html` (step 9g)
14. Patches Firebase config into `app.invite/app.invite.html` (step 10)
15. Strips Firebase config for GAS-only builds (all patched files)
16. Patches `app.flockos/manifest.json`, `app.invite/manifest.json`, `app.flockshow/manifest.json` with church name (steps 4, 11, 11b)
17. Patches `index.html` church selector (step 12)
18. Logs a Generations entry to Firestore on success

### A-Build (Covenant → Covenant/Nations)

```bash
bash "Iris/Bezalel/Scripts/A-Build_Churches.sh"
```

Per church, A-Build:
1. Fetches live church configs from the master API
2. Regenerates `bezalel_codex.js` (Covenant)
3. Publishes `Z-Combined_Schema_Manifest.deployable.json` to `flockos-truth` Firestore
4. `rsync`s `Covenant/Courts/TheTabernacle/` → `Covenant/Nations/<Church>/`
5. Patches database URL, theme colors, brand text, manifest per church

### BCP (A-Build + FlockChat deploy)

```bash
bash "Iris/Bezalel/Scripts/A-Build_Churches.sh" --deploy-comms
```

### When to run which

| What changed | Run |
|---|---|
| `New_Covenant/` source | B-Build → commit + push |
| `Covenant/Courts/TheTabernacle/` source | A-Build → commit + push |
| `flockchat-public/` | BCP (`--deploy-comms`) → commit + push |
| Docs / `Architechtural Docs/` only | commit + push (no build) |

---

## 3. Church Registry

Canonical location: `Covenant/Scrolls/ChurchRegistry/`

Both A-Build and B-Build read config files from this folder. Each file is `<ShortName>.json`.

```json
{
  "id": "",
  "name": "",
  "shortName": "",
  "brandName": "",
  "tagline": "Church Management & Ministry Platform",
  "themeColor": "#e8a838",
  "backgroundColor": "#1a1a2e",
  "databaseUrl": "",
  "adminEmail": "",
  "firebaseConfig": { ... }
}
```

**Active configs:** `FlockOS-Root.json`, `GAS.json`, `Trinity.json`, `TheForest.json`

To add a new church:
1. Copy `ChurchTemplate.json` → `<ShortName>.json` in `Covenant/Scrolls/ChurchRegistry/`
2. Fill all fields
3. Run B-Build (New Covenant) and/or A-Build (Covenant)
4. Commit + push

---

## 4. Schema Artifacts

| File | Location | Purpose |
|------|----------|---------|
| `Z-New Covenant Schema.sql` | `Architechtural Docs/New Covenant/Architecture/` | Authoritative Firestore schema definition |
| `Z-Combined_Schema_Manifest.deployable.json` | Same | Combined schema manifest — published to `flockos-truth` on every A-Build |

The manifest is published by `Iris/Bezalel/Scripts/publish_truth_schema_backup.cjs` as:
- `schemaBackups/combined_schema_manifest_deployable` (latest, overwritten each run)
- `schemaBackups/snapshot_<timestamp>` (immutable per-run snapshot)

Use `--skip-truth-schema-publish` only for offline/emergency builds.

**Total Firestore collections:** 100
- 90 canonical Covenant collections
- 3 New Covenant strategic-plan extensions (`strategicGoals`, `strategicInitiatives`, `strategicKeyDates`)
- 7 deployment/operations collections (`appConfig`, `masterConfig`, `churches`, `churchVault`, `deployConfigs`, `problems`, `quarterlyPlans`)

---

## 5. Firestore Rules & Indexes

| File | Location |
|------|----------|
| `FlockChat.Firestore.Rules` | Repo root |
| `firestore.indexes.json` | Repo root |
| `church-firestore.firebase.json` | Repo root |

Key rules:
- `churches/{cid}/channels/{chid}/messages/{mid}` — read: church member; write/delete: author or admin
- `churches/{cid}/dms/{tid}/messages/{mid}` — read/write: only if `tid` participants include requesting UID
- `churches/{cid}/presence/{uid}` — write: own UID only
- Strategic collections (`strategicGoals`, `strategicInitiatives`, `strategicKeyDates`) — role-gated write

---

## 6. Local Development

No build step required. New Covenant is vanilla ES modules served as static files.

1. Run a local HTTP server from `New_Covenant/` (Python `http.server` or Node `serve`)
2. Open `index.html` in browser
3. The service worker (`the_living_water.js`) registers automatically

The app shell is `New_Covenant/index.html`. All views render into it via `the_tabernacle.js`.

---

## 7. Service Worker & Cache Versioning

- File: `New_Covenant/the_living_water.js`
- Current `CACHE_NAME`: `flockos-new-covenant-v1.01`
- **Do not change `CACHE_NAME` without discussion** — mismatched versions across Nations deployments cause cache staleness in production.

Per-church CACHE_NAME values are patched by B-Build:

| Church | CACHE_NAME |
|--------|-----------|
| Root | `flockos-root-v1.01` |
| FlockOS | `flockos-v1.01` |
| TBC | `flockos-tbc-v1.01` |
| TheForest | `flockos-theforest-v1.01` |
| GAS | `flockos-gas-v1.01` |

---

## 8. Adding a New View

Views live in `New_Covenant/Views/<view_name>/`. Each view is a JS module.

1. Create `New_Covenant/Views/the_new_view/index.js`
2. Export `render()` — returns HTML template literal
3. Export `mount(root, ctx)` — attaches listeners, subscribes to data; returns `unmount` cleanup function
4. Add CSS to `New_Covenant/Styles/new_covenant.css` under a biblical section header
5. Register the view with the router in `the_tabernacle.js`

**5 required UX states per view:** empty, loading skeleton (no spinners), error, success micro-moment, and offline/no-data fallback.

**File size rule:** no JS file exceeds 300 lines (soft target ~150). Split into `index.js` + siblings if it grows.

---

## 9. Adding a New Script Module

1. Choose a unique biblical name — grep `New_Covenant/Scripts/` to confirm it's unused
2. Create `New_Covenant/Scripts/the_name.js` (single file) or `New_Covenant/Scripts/the_name/index.js` (if multi-file)
3. ES modules only — **named exports only**, no default exports
4. Single responsibility — cross-module communication via events or shared data layer, not direct internal access
5. If UI-related, add CSS to `New_Covenant/Styles/new_covenant.css`
6. 300-line hard limit per file

---

## 10. GROW Public Modules

GROW (`app.grow/`) is the public outreach face of FlockOS. It loads modules from `New_Covenant/Scripts/the_gospel/`.

Each module exports:
- `render()` → HTML string
- `mount(root, ctx)` → returns unmount function

New GROW modules go in `New_Covenant/Scripts/the_gospel/the_gospel_<name>.js` and must be registered in `grow_public.js` under `ALL_MODULES`.

The GROW router uses `import('./the_gospel/${name}.js')` — filenames must match the module `name` field exactly.

---

## 11. Known Variance / Tech Debt

See `Z-Variance.md` for the full audit. Active items as of 2026-05-11:

- **`the_tabernacle.js` size** — 21,764 lines in New Covenant. The design intent is to split this progressively into per-view modules. Do not add to it if a new view module can own the logic instead.
- **Strategic Plan domain** — `strategicGoals`, `strategicInitiatives`, `strategicKeyDates` exist in `the_upper_room.js` and `the_living_water_adapter.js`. Schema manifest and Firestore rules are aligned. GAS `SYNC_TAB_MAP` / `FIELD_REVERSE_MAP` are updated in `B-Master Code.md`.
- **`sendMessage` batch.set merge** — New Covenant uses `{ merge: true }` for channel documents. This is intentional and operationally safe (avoids first-post failures on missing channel docs).

# Covenant/

Created: 2026-05-11

---

## What Is This Folder?

`Covenant/` is the **Old Covenant architecture** — the original FlockOS platform before the New Covenant rewrite. It houses the legacy multi-page HTML app shell, FlockChat, shared foundations, legacy build scripts, and the registry files that both old and new systems share.

It is **not the active development target** — that is `New_Covenant/`. However, several parts of `Covenant/` remain actively used by the live build pipeline (see **Still Active** below).

---

## Folder Structure

```
Covenant/
  Courts/             ← App delivery zones (Tabernacle, Fellowship, UpperRoom)
  Foundations/        ← Shared infrastructure (CSS source, API layer)
  Nations/            ← Old Covenant build output (legacy per-church copies)
  Scrolls/            ← Registry files (ChurchRegistry, ProductRegistry)
  Bezalel/Scripts/    ← Legacy build scripts
  Shepherds/          ← Legacy entry-point wrappers for Python automation
  Gate/               ← Reserved
```

---

## Courts/

The primary delivery surfaces of the Old Covenant app.

### Courts/TheTabernacle/
The Old Covenant FlockOS app shell. Contains:
- `FlockOS.html` — the original multi-page app entry point
- `Pages/` — standalone HTML pages (About, Bezalel, The Good Shepherd, The Wall, etc.) + codex JS files
- `Scripts/` — Old Covenant JS modules (the_tabernacle, the_truth, the_fold, the_harvest, the_living_water, etc.)
- `Styles/american_garments.css` — **build-managed copy** (do not edit here; see Foundations below)
- `Images/` — all church branding color variants

### Courts/TheFellowship/
The FlockChat app zone. Contains:
- `FlockChat/` — FlockChat source (manifest, the_word.js, Images)
- `FlockChat-Functions/` — Cloud Functions for FlockChat (Node.js)
- `FlockChat-Public/` — FlockChat public hosting files
- `FlockChat.html` — FlockChat app entry point
- `functions/` — Firebase Functions entry point

### Courts/TheUpperRoom/
The ATOG (A Touch of the Gospel) app zone. Contains:
- `ATOG/` — ATOG app (Pages, Scripts, Images, manifest)
- `ATOG.html` — ATOG entry point
- `Styles/american_garments.css` — build-managed copy

### Courts/ root
- `index.html` — Courts portal index
- `manifest.json` — Courts PWA manifest

---

## Foundations/

Shared infrastructure used across the platform.

### Foundations/SharedVessels/styles/
- **`american_garments.css` — THE CSS source of truth.**
  All shared app-shell styles (topbar, sidebar, card-grid, splash, badges, toggles, responsive breakpoints) live here. The A-Build script syncs this file to `Courts/TheTabernacle/Styles/` and `Courts/TheUpperRoom/Styles/` before deploying. **Always edit this file — never the copies.**

### Foundations/LivingWaterAPI/
The API layer for data access. Contains:
- `adapters/` — data source adapters
- `client/` — API client
- `schemas/` — data schemas

---

## Nations/

Old Covenant per-church build output. Each subfolder (`FlockOS`, `GAS`, `Root`, `TBC`, `TheForest`) contains a branded copy of `FlockOS.html` plus `Pages/Scripts/Styles/Images`.

**This is the legacy equivalent of `/Nations/` at the repo root.** The root `/Nations/` folder (New Covenant build output) is the current active deployment target. `Covenant/Nations/` is retained for reference and rollback.

---

## Scrolls/

Registry files used by both old and new systems.

| Folder | Purpose |
|--------|---------|
| `ChurchRegistry/` | Master church deployment JSON configs. Symlinked from `Architechtural Docs/New Covenant/Deployment/ChurchRegistry/`. Canonical source of truth for church configs. |
| `ProductRegistry/` | Product registry files. |

---

## Bezalel/Scripts/

Legacy build utilities. These are **not** the primary build scripts (those live in `Iris/Bezalel/Scripts/`).

| Script | Purpose |
|--------|---------|
| `generate_seed_db.mjs` | Generates the seed database for the Old Covenant data layer. |
| `purge-churches-paths.mjs` | Purges stale church path references from configs. |

---

## Shepherds/

Legacy entry-point wrappers that delegate to the canonical Python scripts in `Iris/Shepherds/Build/`. **Do not add new scripts here.** New automation goes in `Iris/Shepherds/Build/`.

| Subfolder | Purpose |
|-----------|---------|
| `Build/` | Thin wrappers for missions and registry Python scripts |
| `Deploy/` | Reserved for deploy-phase automation |
| `Verify/` | Reserved for post-deploy verification |

---

## Still Active

These parts of `Covenant/` are still used by the live build pipeline:

| Path | Why It's Active |
|------|----------------|
| `Foundations/SharedVessels/styles/american_garments.css` | CSS source of truth — synced to all courts and church deployments by A-Build |
| `Scrolls/ChurchRegistry/` | Church deployment configs — referenced by scripts and symlinked from Architechtural Docs |
| `Courts/TheFellowship/FlockChat/` | FlockChat source files |
| `Shepherds/Build/` | Legacy entry-point wrappers still callable by old paths |

---

## Rules

- **Do not edit `Styles/american_garments.css` in Courts/ — always edit `Foundations/SharedVessels/styles/american_garments.css`.**
- Do not add new Python scripts to `Shepherds/Build/`. Add them to `Iris/Shepherds/Build/`.
- `Covenant/Nations/` is legacy — do not deploy from it. Use root `/Nations/` instead.

---

## Release Notes

- **2026-05-11:** `COVENANT.md` created to document this folder's purpose and structure.

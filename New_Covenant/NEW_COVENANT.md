# New_Covenant/

Created: 2026-05-11

---

## What Is This Folder?

`New_Covenant/` is the **master source of truth** for the FlockOS New Covenant application. It is a complete, standalone ES module single-page web app served directly via **GitHub Pages**.

Every church deployment under `Nations/` is built from this folder. **All code changes happen here** — never in `Nations/`.

---

## How It Works

- **Source:** This folder (`New_Covenant/`)
- **Deploy to GitHub Pages:** `git push origin main` — GitHub Pages serves `New_Covenant/` directly. No build step needed for the master copy.
- **Deploy to churches:** Run `A-Build_Churches.sh` (B-Build), which rsyncs this folder into each `Nations/<Church>/` subfolder with per-church branding applied.

---

## Entry Points

| File | Purpose |
|------|---------|
| `index.html` | Main app shell — bootstraps the entire FlockOS UI |
| `the_living_water.js` | Core ES module — registers all app modules and routes |

---

## Folder Structure

```
New_Covenant/
  index.html                 ← app shell
  the_living_water.js        ← core module registry
  Scripts/                   ← all app logic modules
  Styles/                    ← app CSS (new_covenant.css)
  Views/                     ← 49 page view folders + standalone pages
  Data/                      ← static data assets (Bible, lexicons, devotionals, etc.)
  Images/                    ← branding and UI images
  app.embeds/                ← embed shell (embed-flockos, embed-grow, embed-stand, embed-about)
  app.flockos/               ← FlockOS PWA sub-app shell
  app.grow/                  ← Grow PWA sub-app shell
  app.invite/                ← Invite PWA sub-app shell
  app.stand/                 ← Stand (Flock Stand) PWA sub-app shell
```

---

## Scripts/

All app logic lives here as ES modules. Key modules include:

- `the_living_water_register.js` — module registration
- `the_living_water_adapter.js` — routing adapter
- `fine_linen.js` — UI/style utilities
- `firm_foundation.js` — core foundation helpers
- `the_tabernacle.js`, `the_truth.js`, `the_fold.js`, `the_harvest.js` — major feature modules
- `the_gospel/`, `the_scribes/`, `the_veil/`, `the_priesthood/`, `the_scrolls/`, `the_life/`, etc. — sub-module folders
- `bezalel_codex.js` — build codex reference
- `grow_public.js` — public Grow entry

---

## Views/

49 view folders/files covering all pages of the app, including:

`about_flockos`, `bezalel`, `content-admin`, `fishing_for_data`, `fishing_for_men`, `learn_more`, `prayerful_action`, `quarterly_worship`, `software_deployment_referral`, `the_anatomy_of_worship`, `the_announcements`, `the_call_to_forgive`, `the_fellowship`, `the_fold`, `the_generations`, `the_gift_drift`, `the_good_shepherd`, `the_gospel_analytics`, and more.

---

## Data/

Static JavaScript data modules served client-side:

`apologetics`, `books-of-the-bible`, `counseling`, `devotionals`, `genealogy`, `heart`, `library`, `mirror`, `missions`, `one_year_bible`, `psalms`, `quiz`, `reading-plans`, `strongs-greek`, `strongs-hebrew`, `teaching_plans`, `theology`, and `seed_database.json`.

---

## app.*/ Sub-Apps

Each `app.*/` folder is a standalone PWA shell with its own `index.html` and `manifest.json`, allowing it to be installed independently:

| Folder | Purpose |
|--------|---------|
| `app.embeds/` | Embeddable iFrame shells (flockos, grow, stand, about) |
| `app.flockos/` | FlockOS PWA installable shell |
| `app.grow/` | Grow PWA installable shell |
| `app.invite/` | Invite PWA installable shell |
| `app.stand/` | Flock Stand PWA installable shell |

---

## Rules

- **This is the only place to edit FlockOS source.** Do not edit files in `Nations/` directly.
- **CSS source of truth:** `Covenant/Foundations/SharedVessels/styles/american_garments.css` — shared app-shell styles live there, not inline in `index.html`.
- **Service worker cache version:** Never change `CACHE_NAME` without discussion. Current: `flockos-new-covenant-v1.01`.
- After edits, commit and push — GitHub Pages deploys automatically. Run B-Build separately when church deployments need to be updated.

---

## Release Notes

- **2026-05-11:** `NEW_COVENANT.md` created to document this folder's purpose and structure.

# Shepherds Automation Scripts

Created: 2026-04-28  
Last audited: 2026-05-13

---

## Release Notes

- **2026-05-13:** Full script inventory added. All 36 scripts in `Automation/Shepherds/` catalogued; `Iris/Shepherds/Build/` operational copies noted; milestone-seed-only scripts documented.
- **2026-04-28:** Shepherds build/import Python automation scripts centralized here. Legacy entry points remain as wrappers.

---

## Folder Purpose

Canonical location for Shepherds build/import Python automation scripts. Scripts perform data ETL (export to JS bundles, import from external sources, seed to Firestore) and data maintenance (normalise, tidy, replicate). They are run manually or via Bezalel; they are **not** invoked by A-Build or B-Build.

## Naming Rule
- Scripts use explicit snake_case names that describe the action (e.g. `align_missions_ui_fields.py`).

## Compatibility
- Operational copies live in `Iris/Shepherds/Build/` (Bezalel) and `Covenant/Shepherds/Build/` (legacy wrappers).
- The canonical source is `Architechtural Docs/New Covenant/Automation/Shepherds/`.
- Existing commands can continue to call legacy paths while execution is delegated here.

---

## Script Inventory

### Export → JS Data Bundles
These scripts generate or update the static `New_Covenant/Data/*.js` files used by the app without a Firestore read at runtime.

| Script | Output | Notes |
|---|---|---|
| `convert_books_to_js.py` | `Data/library.js` | Converts Books of the Bible reference data to a JS export. |
| `convert_psalms_to_js.py` | `Data/psalms.js` | Converts Psalms reference data to a JS export. |
| `export_apologetics_to_js.py` | `Data/apologetics.js` | Exports apologetics Q&A to a JS export. |
| `export_counseling_to_js.py` | `Data/counseling.js` | Exports biblical counselling topics to a JS export. |
| `export_devotionals_to_js.py` | `Data/devotionals.js` | Exports daily devotionals to a JS export. |
| `export_genealogy_to_js.py` | `Data/genealogy.js` | Exports biblical genealogy/figures to a JS export. |
| `export_heart_to_js.py` | `Data/heart.js` | Exports Heart Check diagnostic content to a JS export. |
| `export_mirror_to_js.py` | `Data/mirror.js` | Exports Shepherd's Mirror soul-triage content to a JS export. |
| `export_missions_to_js.py` | `Data/missions.js` | Exports world-missions registry (nations, stats, prayer) to a JS export. |
| `export_quiz_to_js.py` | `Data/quiz.js` | Exports Bible quiz questions to a JS export. |
| `export_teaching_plans_to_js.py` | `Data/teaching_plans.js` | Exports teaching plan bundles to a JS export. |
| `export_theology_to_js.py` | `Data/theology.js` | Exports theology categories and sections to a JS export. |
| `generate_one_year_bible.py` | `Data/one_year_bible.js` | Generates a daily one-year Bible reading schedule. |
| `generate_reading_plans.py` | `Data/reading-plans.js` | Generates structured Bible reading plan data. |

### Import → Source Data
These scripts pull data from external APIs or markdown files into local source data files for further processing or seeding.

| Script | Source | Notes |
|---|---|---|
| `import_bible_access_list.py` | External Bible access API | Imports Bible translation availability per nation into missions data. |
| `import_genealogy_from_wikidata.py` | Wikidata API | Enriches genealogy data with biographical facts from Wikidata. |
| `import_teaching_plans_from_markdown.py` | Markdown files | Parses structured teaching plan `.md` files into seed-ready JSON. |
| `import_theology_from_markdown.py` | Markdown files | Parses theology section `.md` files into seed-ready JSON. |

### Seed → Firestore (flockos-notify)
These scripts push data to the `flockos-notify` Firebase project, which is the canonical shared content database.

| Script | Firestore Target | Notes |
|---|---|---|
| `seed_books_to_notify.py` | `books` collection | Seeds Books of the Bible reference data. |
| `seed_heart_to_notify.py` | `heart` collection | Seeds Heart Check diagnostic content. |
| `seed_lexicon_to_firestore.py` | `lexiconGreek`, `lexiconHebrew` | Seeds Greek/Hebrew Strongs lexicon entries. |
| `seed_mirror_to_notify.py` | `mirror` collection | Seeds Shepherd's Mirror content. |
| `seed_one_year_bible_to_notify.py` | `reading` / `oneYearBible` collection | Seeds the one-year Bible reading plan. |
| `seed_psalms_to_notify.py` | `psalms` collection | Seeds all 150 Psalms. |
| `seed_reading_plans_to_notify.py` | `readingPlans` collection | Seeds structured Bible reading plans. |
| `seed_theology_to_notify.py` | `theologyCategories`, `theologySections` | Seeds theology categories and sections. |

### Missions Registry Maintenance
These scripts maintain the missions registry dataset (`Data/missions.js` and Firestore `missionsRegistry`).

| Script | Notes |
|---|---|
| `align_missions_ui_fields.py` | Aligns field names in missions data to match UI expectations. |
| `enrich_missions_from_joshua_project.py` | Fetches per-nation gospel-access stats from the Joshua Project API and merges into missions data. |
| `enrich_missions_from_pdfs.py` | Extracts supplemental missions data from PDF source documents. |
| `move_missions_to_root.py` | Moves missions data from a nested structure to the root-level registry. |
| `normalize_persecution_level.py` | Standardises persecution level values to a consistent enum across all records. |
| `replicate_missions_registry.py` | Replicates/syncs the missions registry between environments or collections. |
| `tidy_missions_registry.py` | Removes duplicate or malformed records from the missions registry. |
| `update_flags.py` | Updates ISO country flag references in the missions registry. |

### Utilities
| Script | Notes |
|---|---|
| `distill_truth_to_all.py` | Distributes canonical `flockos-truth` content to all church Firebase projects. |
| `fix_shofar_encoding.py` | Corrects character encoding issues in Music Stand / Shofar song data. |

---

## Iris/Shepherds/Build/ — Operational Copies

The following scripts in `Iris/Shepherds/Build/` are the versions run by Bezalel. They correspond to (or delegate to) the canonical copies above, with the addition of milestone-seed scripts that are **not** in the canonical Automation/Shepherds/ directory:

| Iris Script | Notes |
|---|---|
| `align_missions_ui_fields.py` | Operational copy. |
| `enrich_missions_from_joshua_project.py` | Operational copy. |
| `enrich_missions_from_pdfs.py` | Operational copy. |
| `import_bible_access_list.py` | Operational copy. |
| `move_missions_to_root.py` | Operational copy. |
| `normalize_persecution_level.py` | Operational copy. |
| `replicate_missions_registry.py` | Operational copy. |
| `seed_build_event.py` | Seeds a build event to The Generations (Firestore `/milestones`). Called by B-Build on success. **Iris-only; not in canonical Automation/Shepherds/.** |
| `seed_early_history_milestones.py` | One-time seed of early FlockOS history milestones. **Iris-only.** |
| `seed_flockos_milestones.py` | Seeds FlockOS platform milestones. **Iris-only.** |
| `seed_may11_milestones.py` | One-time seed of 2026-05-11 milestone batch. **Iris-only.** |
| `seed_old_covenant_milestones.py` | Seeds Old Covenant system milestones. **Iris-only.** |
| `tidy_missions_registry.py` | Operational copy. |
| `update_flags.py` | Operational copy. |


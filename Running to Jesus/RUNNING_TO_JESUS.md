# Running to Jesus/

Created: 2026-05-11

---

## What Is This Folder?

`Running to Jesus/` is the **operational toolbox** for FlockOS — the home of all build scripts, deployment automation, Firestore seeders, runbooks, and maintenance utilities that keep the platform running.

It is not source code for the app itself. It is the machinery that builds, seeds, and maintains the app.

---

## Folder Structure

```
Running to Jesus/
  Bezalel/Scripts/    ← Core build scripts (A-Build, B-Build, schema tools)
  Shepherds/Build/    ← Python automation (Firestore seeding, data import, registry)
  Runbooks/           ← Operational runbooks and snapshot utilities
  Automation/         ← (Reserved for future scheduled/CI automation hooks)
```

---

## Bezalel/Scripts/

The build engine. Named after the craftsman appointed to build the Tabernacle (Exodus 31).

| Script | Purpose |
|--------|---------|
| `A-Build_Churches.sh` | **Primary build.** Rsyncs `New_Covenant/` → each `Nations/<Church>/` with branding. Runs BCP (Build–Commit–Push). |
| `B-Build_Nations.sh` | Deploys all Nations church builds to Firebase Hosting. |
| `B-Export_Standalone.sh` | Exports a standalone build artifact. |
| `generate_schema_manifest_from_sql.cjs` | Generates `combined_schema_manifest.deployable.json` from the SQL schema. |
| `publish_truth_schema_backup.cjs` | Publishes the schema backup to the Architechtural Docs store. |

**To run A-Build (BCP):**
```bash
bash "Running to Jesus/Bezalel/Scripts/A-Build_Churches.sh"
```

---

## Shepherds/Build/

Python scripts for seeding and maintaining Firestore data. Each script is a one-purpose tool named by its action.

| Script | Purpose |
|--------|---------|
| `align_missions_ui_fields.py` | Normalizes UI field names in the missions registry. |
| `enrich_missions_from_joshua_project.py` | Enriches mission records from Joshua Project data. |
| `enrich_missions_from_pdfs.py` | Extracts and seeds mission data from PDFs. |
| `import_bible_access_list.py` | Imports Bible access/translation availability data. |
| `move_missions_to_root.py` | Migrates missions records to the root collection. |
| `normalize_persecution_level.py` | Standardizes persecution level values. |
| `replicate_missions_registry.py` | Replicates the missions registry across environments. |
| `seed_build_event.py` | Seeds a build event record into Firestore. |
| `seed_early_history_milestones.py` | Seeds early church history milestone data. |
| `seed_flockos_milestones.py` | Seeds FlockOS platform milestone data. |
| `seed_may11_milestones.py` | Seeds May 11 milestone data. |
| `seed_old_covenant_milestones.py` | Seeds Old Covenant milestone data. |
| `tidy_missions_registry.py` | Cleans and deduplicates the missions registry. |
| `update_flags.py` | Updates country/mission flag data. |

**To run a Shepherd script:**
```bash
source .venv/bin/activate
python "Running to Jesus/Shepherds/Build/<script_name>.py" [--flags]
```

---

## Runbooks/

Operational procedures for maintenance and recovery.

| Script | Purpose |
|--------|---------|
| `Snapshot.sh` | Creates a timestamped incremental backup of the entire repo to `FlockOS/Storehouse/`. Uses `rsync --link-dest` so each snapshot is a complete, browsable copy with near-zero extra disk usage. |

**To snapshot the repo:**
```bash
bash "Running to Jesus/Runbooks/Snapshot.sh"
```

---

## Automation/

Reserved for future scheduled or CI automation hooks. Currently empty.

---

## Rules

- Scripts in `Bezalel/Scripts/` and `Shepherds/Build/` use hardcoded `REPO_ROOT` paths relative to their script location — **do not move them without updating those paths.**
- Legacy entry points in `Covenant/Shepherds/Build/` are thin wrappers that delegate to the canonical scripts here.
- Never commit secrets, API keys, or credentials anywhere in this folder.

---

## Release Notes

- **2026-05-11:** `RUNNING_TO_JESUS.md` created to document this folder's purpose and structure.

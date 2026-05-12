# Architechtural Docs/

Created: 2026-05-11

---

## What Is This Folder?

`Architechtural Docs/` is the **living documentation repository** for the entire FlockOS platform. It holds architecture references, AS-BUILT documents, automation scripts, data sources, deployment configs, secrets, and historical design records — organized by covenant era.

This folder is **gitignored by default**. All files must be added with `git add -f` to be tracked.

---

## Top-Level Structure

```
Architechtural Docs/
  New Covenant/    ← Active documentation for the current platform
  Old Covenant/    ← Historical documentation for the legacy platform
```

---

## New Covenant/

Documentation, automation, data, and operational assets for the active FlockOS New Covenant platform.

### New Covenant/Architecture/  *(Primary reference hub)*
All architectural documentation is consolidated here. Key files:

| File | Purpose |
|------|---------|
| `INDEX.md` | Master index — start here |
| `F-AS-BUILT-Architecture-Overview.md` | Full system architecture overview |
| `G-AS-BUILT-Script-Module-Inventory.md` | Every JS module inventoried |
| `H-AS-BUILT-View-Inventory.md` | Every view and route inventoried |
| `I-AS-BUILT-Data-Layer-Inventory.md` | All data files inventoried |
| `K-AS-BUILT-Operations-Guide.md` | Day-to-day operations reference |
| `J-AS-BUILT-Doc-Set-Index.md` | Index of all AS-BUILT documents |
| `FLOW-POLICY.md` | Branching, deployment, and commit policy |
| `DEBUGGING-MAP.md` | Debugging guide and issue map |
| `Structure-Parity-Map.md` | Old Covenant → New Covenant parity map |
| `A-FlockOS New Covenant.md` | Original New Covenant design document |
| `B-Master Code.md` | Master code reference |
| `C-Setup.md` | Environment setup guide |
| `New Covenant Schema.sql` | Canonical Firestore schema (SQL format) |
| `combined_schema_manifest.deployable.json` | Auto-generated deployable schema manifest |
| `README.md` | Subfolder README reference (all subfolders documented here) |
| `Automation-README.md` | Automation folder overview |
| `Automation-Shepherds-README.md` | Shepherds automation overview |

### New Covenant/Automation/
Scripts that automate architecture and data tasks. **Do not edit scripts here by hand** — they are the canonical Python/Node tools for the data pipeline.

- `Shepherds/` — ~35 Python scripts: data exports, Firestore seeders, missions registry, lexicon, Bible plan generation, etc.
- `AI_Doc_Runner/` — AI-assisted documentation generation runner
- `generate_schema_manifest_from_sql.cjs` — generates the schema manifest from SQL
- `publish_truth_schema_backup.cjs` — publishes schema backup to Architechtural Docs
- `audit_firestore_against_schema.cjs` — audits live Firestore against the schema

### New Covenant/Data/
Source content files used to seed the app's data layer:
- `Baptism Orientation - Teaching Plan.md`
- `Baptism Orientation Part 1.md` / `Part 2.md`
- `Books of the Bible.md`
- `The Gospel as I Know It.md`
- `The Psalms.md`

### New Covenant/Deployment/
Canonical deployment configuration files:
- `ChurchRegistry/` — Master church JSON configs (`ChurchTemplate.json`, `FlockOS-Root.json`, `Master-API.json`, `GAS.json`, `Trinity.json`, `TheForest.json`)
- `Firestore/` — `firestore.rules` and `firestore.indexes.json`

### New Covenant/Secrets/
**Local-only, never committed secret files.** Contains Firebase Admin SDK service account keys for all projects. This folder is gitignored and must never be pushed.

### New Covenant/Debugging/ · Migration/ · Runbooks/ · Tests/
Operational folders. Contents documented in `Architecture/P-README.md`.

---

## Old Covenant/

Historical documentation for the legacy FlockOS platform. Retained for reference and migration context.

### Old Covenant/Architecture/
~25 design documents covering the full lifecycle of the old platform:
- Project plans, release notes (v1.0, v1.1), deployment guides
- Firestore rules, permissions plans, FlockChat design
- Workflow docs, debugging history, action items, timeline
- `A-Plan for New Covenant.md` — the bridge document that kicked off the rewrite

### Old Covenant/Platforms/
Detailed platform-specific documentation:
- `ATOG/` — 11 documents covering the ATOG app (architecture, Firebase setup, deployment, Firestore rules, roles, file map)
- `FlockChat/` — FlockChat platform documentation

### Old Covenant/Automation/
Documentation (not scripts) for the old automation layer:
- `README.md`
- `generate_schema_manifest_from_sql.md`
- `mirror_architecture_to_old_covenant.md`
- `publish_truth_schema_backup.md`

### Old Covenant/ root
- `INDEX.md` — Old Covenant doc index
- `FLOW-POLICY.md` — Old Covenant flow policy

---

## Rules

- **All files here require `git add -f`** — this folder is gitignored.
- **`Secrets/` must never be committed.** It is gitignored within gitignored.
- Architecture docs are the source of truth for understanding the system. Keep them updated as the platform evolves.
- `New Covenant/Architecture/` is the single home for all `.md` docs — do not scatter docs across subfolders.

---

## Release Notes

- **2026-05-11:** `ARCHITECHTURAL_DOCS.md` created to document this folder's purpose and structure.

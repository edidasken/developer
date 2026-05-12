# Flow Policy

Created: 2026-04-28
Updated: 2026-04-30

---

## Release Notes

- **2026-04-30:** Updated to reflect current automation pipeline, build script location, deployment paths, secrets, and Firestore canonical locations.
- **2026-04-28:** Initial policy established. All architecture flows New Covenant → Old Covenant. No back-porting without review.

---

## Policy

All architecture documentation and deployment configuration flows from **New Covenant → Old Covenant**. New Covenant is the single canonical source. Old Covenant is a mirrored output only.

---

## Expectations

- Author and update all architecture content in `Architechtural Docs/New Covenant/` first.
- Mirror to Old Covenant only after validation, using the automation script:
  `Architechtural Docs/New Covenant/Automation/mirror_architecture_to_old_covenant.cjs`
- Do not back-port Old Covenant changes into New Covenant without explicit review.
- Do not edit Firestore rules, indexes, or Church Registry configs in any location other than `Architechtural Docs/New Covenant/Deployment/`.

---

## Canonical Source Paths

| Artifact | Canonical Location |
|---|---|
| Architecture docs | `Architechtural Docs/New Covenant/Architecture/` |
| Automation scripts | `Architechtural Docs/New Covenant/Automation/` |
| Deployment config | `Architechtural Docs/New Covenant/Deployment/` |
| Firestore rules + indexes | `Architechtural Docs/New Covenant/Deployment/Firestore/` |
| Church Registry JSONs | `Architechtural Docs/New Covenant/Deployment/ChurchRegistry/` |
| Secrets | `Architechtural Docs/New Covenant/Secrets/Flock/` |
| Shepherd scripts | `Architechtural Docs/New Covenant/Automation/Shepherds/` |
| AI doc-gen pipeline | `Architechtural Docs/New Covenant/Automation/AI_Doc_Runner/` |
| Runbooks | `Architechtural Docs/New Covenant/Runbooks/` |

---

## Build & Deploy

- **Build (BCP):** `bash "Iris/Bezalel/Scripts/A-Build_Churches.sh"` from workspace root
  - With comms deploy: append `--deploy-comms` (or run `npm run bcp`)
  - Syncs SharedVessels CSS → Tabernacle, rsync to Nations, regenerates codex, deploys FlockChat hosting
- **Firestore rules deploy:** firebase CLI using rules/indexes from `Architechtural Docs/New Covenant/Deployment/Firestore/`
- **New Covenant-only changes** (local Scripts/, Styles/, Views/, Architechtural Docs/): git commit + push only — no BCP needed. GitHub Pages serves New_Covenant directly.

---

## Automation Scripts (Architechtural Docs/New Covenant/Automation/)

| Script | Purpose |
|---|---|
| `mirror_architecture_to_old_covenant.cjs` | Mirrors New Covenant docs to Old Covenant |
| `audit_firestore_against_schema.cjs` | Audits live Firestore against schema |
| `generate_schema_manifest_from_sql.cjs` | Generates deployable JSON from SQL schema |
| `publish_truth_schema_backup.cjs` | Publishes truth schema backup to Firebase |
| `AI_Doc_Runner/run_doc_gen.sh` | Runs Gemini-powered as-built doc generation |

---

## Mirror Policy

Old Covenant (`Architechtural Docs/Old Covenant/`) is maintained as a read-only mirror:
- Do not treat it as canonical for new edits.
- Record sync date whenever pulling updates from New Covenant.
- Use for continuity, compatibility, and historical reference only.

# Automation Scripts

Created: 2026-04-28

---

## Release Notes

- **2026-04-28:** Initial automation scripts established for schema, backup, and mirroring.

---

## Folder Purpose

This folder contains scripts that automate architecture tasks for the New Covenant documentation and deployment pipeline.

## Naming Rule
- Use explicit snake_case names that describe the action (e.g. `publish_truth_schema_backup.cjs`).

## Script Inventory
- `audit_firestore_against_schema.cjs` — audits live Firestore collections against the canonical schema manifest; reports missing or extra fields.
- `generate_schema_manifest_from_sql.cjs` — generates `Z-Combined_Schema_Manifest.deployable.json` from `Z-New Covenant Schema.sql`.
- `mirror_architecture_to_old_covenant.cjs` — mirrors canonical architecture artifacts from New Covenant → Old Covenant for continuity.
- `publish_truth_schema_backup.cjs` — publishes the latest schema manifest to the `flockos-truth` Firestore project.

### Shepherds/
Python automation scripts for missions and registry management.

---

## Update Source
- Source of truth: Architechtural Docs/New Covenant/Automation/

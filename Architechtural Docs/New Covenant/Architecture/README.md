# New Covenant — Subfolder README Reference

Created: 2026-04-28 | Consolidated: 2026-05-11

This file consolidates all subfolder README files for `Architechtural Docs/New Covenant/`.
Each section describes the purpose, inventory, and update source for its corresponding folder.

---

## Deployment/

**Purpose:** Canonical storage for deployment master files, including church registry and Firestore configuration. Previously, these were under `Covenant/Scrolls`.

**Inventory:**
- `ChurchRegistry/` — Master church deployment JSON configs
- `Firestore/` — Firestore rules and indexes

**Compatibility:**
- `Covenant/Scrolls/ChurchRegistry` remains as a symlink to the canonical folder.
- Existing scripts can continue to reference `Covenant/Scrolls/ChurchRegistry`.

**Update Source:** `Architechtural Docs/New Covenant/Deployment/`

---

## Deployment/ChurchRegistry/

**Purpose:** Master church deployment JSON configs for all environments and churches.

**Expected Files:**
- `ChurchTemplate.json`
- `FlockOS-Root.json`
- `Master-API.json`
- Church-specific configs (e.g., `GAS.json`, `Trinity.json`, `TheForest.json`)

**Compatibility Path:** `Covenant/Scrolls/ChurchRegistry` (symlink)

**Update Source:** `Architechtural Docs/New Covenant/Deployment/ChurchRegistry/`

---

## Migration/

**Purpose:** Documents migration plans, source-to-target mappings, and cutover checklists for architecture and data migrations.

**Minimum Sections:**
- Data and schema migration plan
- Compatibility notes
- Validation criteria after migration

**Update Source:** `Architechtural Docs/New Covenant/Migration/`

---

## Runbooks/

**Purpose:** Executable operational runbooks for build, deploy, rollback, and incident handling.

**Minimum Sections:**
- Build and deploy sequence
- Verification checklist
- Escalation and rollback steps

**Update Source:** `Architechtural Docs/New Covenant/Runbooks/`

---

## Secrets/

**Purpose:** Temporary, local secret files only. **Never commit keys or credentials.**

**Expected Usage:**
- Temporary local secret files only
- Never commit keys or credentials

**Update Source:** `Architechtural Docs/New Covenant/Architecture/FLOW-POLICY.md`

---

## Tests/

**Purpose:** Architecture-level tests and validation scripts for deployment and schema safety.

**Minimum Sections:**
- Test inventory
- Smoke and regression coverage
- Required pre-release checks

**Update Source:** `Architechtural Docs/New Covenant/Tests/`

---

## Release Notes

- **2026-04-28:** All subfolder READMEs initially created.
- **2026-05-11:** All subfolder READMEs consolidated into this single file.

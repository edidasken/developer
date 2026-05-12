# New Covenant Architecture Index

Created: 2026-04-28
Authority: This tree is the canonical source for architecture artifacts.
Update flow: New Covenant -> Old Covenant

---

## Release Notes

- **2026-04-30:** AI-generated as-built documentation suite complete. Six docs produced via Gemini 2.5 Flash covering scripts, views, data layer, architecture overview, operations runbook, and doc-set index. Automation pipeline (`AI_Doc_Runner/`) added. `Assistants.md` reference doc added.
- **2026-04-28:** Initial structure and canonicalization of New Covenant architecture tree. All folders and placeholders established. Symlinks and migration plans documented.

---

## Root Files

- [AS-BUILT-Doc-Set-Index.md](Architecture/AS-BUILT-Doc-Set-Index.md) — Master index of all AI-generated as-built docs

---

## Architecture Map

- **Architecture/**
	- [A-FlockOS New Covenant.md](Architecture/A-FlockOS%20New%20Covenant.md)
	- [A-State of Data.md](Architecture/A-State%20of%20Data.md)
	- [AS-BUILT-Architecture-Overview.md](Architecture/AS-BUILT-Architecture-Overview.md) *(AI-generated)*
	- [AS-BUILT-Data-Layer-Inventory.md](Architecture/AS-BUILT-Data-Layer-Inventory.md) *(AI-generated)*
	- [AS-BUILT-Doc-Set-Index.md](Architecture/AS-BUILT-Doc-Set-Index.md) *(AI-generated)*
	- [AS-BUILT-Operations-Guide.md](Architecture/AS-BUILT-Operations-Guide.md) *(AI-generated)*
	- [AS-BUILT-Script-Module-Inventory.md](Architecture/AS-BUILT-Script-Module-Inventory.md) *(AI-generated)*
	- [AS-BUILT-View-Inventory.md](Architecture/AS-BUILT-View-Inventory.md) *(AI-generated)*
	- [FLOW-POLICY.md](Architecture/FLOW-POLICY.md)
	- [INDEX.md](Architecture/INDEX.md)
	- [Structure-Parity-Map.md](Architecture/Structure-Parity-Map.md)
	- [Assistants.md](Architecture/Assistants.md) — AI doc-gen workflow reference
	- [B-Master Code.md](Architecture/B-Master%20Code.md)
	- [C-Master FirestoreSync.md](Architecture/C-Master%20FirestoreSync.md)
	- [D-Master SyncHandler.md](Architecture/D-Master%20SyncHandler.md)
	- [E-Master CamelCase.md](Architecture/E-Master%20CamelCase.md)
	- [New Covenant Schema.sql](Architecture/New%20Covenant%20Schema.sql)
	- [Z-Variance.md](Architecture/Z-Variance.md)
	- [combined_schema_manifest.deployable.json](Architecture/combined_schema_manifest.deployable.json)

- **Automation/**
	- [AI_Doc_Runner/](Automation/AI_Doc_Runner/) — Gemini-powered as-built doc generation pipeline
	- [audit_firestore_against_schema.cjs](Automation/audit_firestore_against_schema.cjs)
	- [generate_schema_manifest_from_sql.cjs](Automation/generate_schema_manifest_from_sql.cjs)
	- [mirror_architecture_to_old_covenant.cjs](Automation/mirror_architecture_to_old_covenant.cjs)
	- [publish_truth_schema_backup.cjs](Automation/publish_truth_schema_backup.cjs)
	- [Shepherds/](Automation/Shepherds/)

- **Deployment/**
	- [ChurchRegistry/](Deployment/ChurchRegistry/)
		- [ChurchTemplate.json](Deployment/ChurchRegistry/ChurchTemplate.json)
		- [FlockOS-Root.json](Deployment/ChurchRegistry/FlockOS-Root.json)
		- [GAS.json](Deployment/ChurchRegistry/GAS.json)
		- [Master-API.json](Deployment/ChurchRegistry/Master-API.json)
		- [TheForest.json](Deployment/ChurchRegistry/TheForest.json)
		- [Trinity.json](Deployment/ChurchRegistry/Trinity.json)
		- [README.md](Deployment/ChurchRegistry/README.md)
	- [Firestore/](Deployment/Firestore/)
		- [firestore.indexes.json](Deployment/Firestore/firestore.indexes.json)
		- [firestore.rules](Deployment/Firestore/firestore.rules)
	- [README.md](Deployment/README.md)

- **Migration/**
	- [README.md](Migration/README.md)

- **Platforms/**
	- [ATOG/](Platforms/ATOG/)
		- [README.md](Platforms/ATOG/README.md)
	- [FlockChat/](Platforms/FlockChat/README.md)
	- [README.md](Platforms/README.md)

- **Runbooks/**
	- [README.md](Runbooks/README.md)

- **Secrets/**
	- [Flock/](Secrets/Flock/)
		- [CurrentFBPW.json](Secrets/Flock/CurrentFBPW.json)
		- [firestore.indexes.json](Secrets/Flock/firestore.indexes.json)
		- [flockos-comms-firebase-adminsdk-fbsvc-2eec2d6f2d.json](Secrets/Flock/flockos-comms-firebase-adminsdk-fbsvc-2eec2d6f2d.json)
		- [flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json](Secrets/Flock/flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json)
		- [flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json](Secrets/Flock/flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json)
		- [flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json](Secrets/Flock/flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json)
		- [flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json](Secrets/Flock/flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json)
	- [README.md](Secrets/README.md)

- **Tests/**
	- [README.md](Tests/README.md)

---

## Update source
- Primary source for mirrored docs: Architechtural Docs/New Covenant/

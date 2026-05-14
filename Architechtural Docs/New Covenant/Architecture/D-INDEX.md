# New Covenant Architecture Index

Created: 2026-04-28
Authority: This tree is the canonical source for architecture artifacts.
Update flow: New Covenant -> Old Covenant

---

## Release Notes

- **2026-05-14 (pass 4):** Fourth audit pass completed. Created `Q-AS-BUILT-App-Dependencies.md` with comprehensive script loading order documentation for all 8 app shells (FlockOS, FEED, FlockChat, FlockShow, FlockStand, GROW, Invite, embed-launcher) and 9 embed files (embed-flockos, embed-stand, embed-feed, embed-flockchat, embed-flockshow, embed-grow, embed-about, embed-launcher). Documents complete dependency chains from Firebase SDKs → auth layer → backend modules → app-specific logic → Unity components. Includes Firebase SDK version table, loading patterns, base href strategies, and dependency graph. Added to Architecture Map in D-INDEX.md.
- **2026-05-14 (pass 3):** Third audit pass completed. Fixed CACHE_NAME version references from v1.01 to v1.03 in K-AS-BUILT-Operations-Guide.md. Corrected ChurchRegistry canonical location from `Covenant/Scrolls/ChurchRegistry/` to `Architechtural Docs/New Covenant/Deployment/ChurchRegistry/` throughout. Deleted 37 macOS duplicate files with " 2" suffix from Automation/ directories. Updated To-Do.md to mark Unified Footer as completed (commit 233d2ec9).
- **2026-05-13 (pass 2):** Second audit pass completed. Added `stand.js` (app.stand/) to `G-AS-BUILT-Script-Module-Inventory.md`. Removed 13 duplicate module rows from G-AS-BUILT (scribes, veil, fold/index, shepherd/index, priesthood/garments first occurrences). Fixed `F-AS-BUILT-Architecture-Overview.md` accuracy: `app.flockchat/` Firebase config note corrected (standalone HTML is not patched by B-Build; only embed-flockchat.html is via step 9e). `O-Automation-Shepherds-README.md` expanded with full 36-script inventory in 5 categories, plus Iris-only milestone scripts.
- **2026-05-13:** Full as-built audit completed. Three new standalone app shells documented: `app.feed/` (Sermon Prep & Manuscript Builder), `app.flockchat/` (church team messaging PWA), `app.flockshow/` (church presentation app). Four new embeds documented: `embed-feed.html`, `embed-flockchat.html`, `embed-flockshow.html`, `embed-launcher.html`. B-Build step list in `K-AS-BUILT-Operations-Guide.md` expanded to all 18 patch steps. `N-Automation-README.md` updated with `audit_firestore_against_schema.cjs`. Repo layout tree corrected for all 8 app shells.
- **2026-04-30:** AI-generated as-built documentation suite complete. Six docs produced via Gemini 2.5 Flash covering scripts, views, data layer, architecture overview, operations runbook, and doc-set index. Automation pipeline (`AI_Doc_Runner/`) added. `Assistants.md` reference doc added.
- **2026-04-28:** Initial structure and canonicalization of New Covenant architecture tree. All folders and placeholders established. Symlinks and migration plans documented.

---

## Root Files

- [J-AS-BUILT-Doc-Set-Index.md](Architecture/J-AS-BUILT-Doc-Set-Index.md) — Master index of all AI-generated as-built docs

---

## Architecture Map

- **Architecture/**
	- [A-FlockOS New Covenant.md](A-FlockOS%20New%20Covenant.md)
	- [B-Master Code.md](B-Master%20Code.md)
	- [C-Setup.md](C-Setup.md)
	- [D-INDEX.md](D-INDEX.md)
	- [E-FLOW-POLICY.md](E-FLOW-POLICY.md)
	- [F-AS-BUILT-Architecture-Overview.md](F-AS-BUILT-Architecture-Overview.md) *(AI-generated)*
	- [G-AS-BUILT-Script-Module-Inventory.md](G-AS-BUILT-Script-Module-Inventory.md) *(AI-generated)*
	- [H-AS-BUILT-View-Inventory.md](H-AS-BUILT-View-Inventory.md) *(AI-generated)*
	- [I-AS-BUILT-Data-Layer-Inventory.md](I-AS-BUILT-Data-Layer-Inventory.md) *(AI-generated)*
	- [J-AS-BUILT-Doc-Set-Index.md](J-AS-BUILT-Doc-Set-Index.md) *(AI-generated)*
	- [K-AS-BUILT-Operations-Guide.md](K-AS-BUILT-Operations-Guide.md) *(AI-generated)*
	- [L-Structure-Parity-Map.md](L-Structure-Parity-Map.md)
	- [M-DEBUGGING-MAP.md](M-DEBUGGING-MAP.md)
	- [N-Automation-README.md](N-Automation-README.md)
	- [O-Automation-Shepherds-README.md](O-Automation-Shepherds-README.md)
	- [P-README.md](P-README.md)
	- [Q-AS-BUILT-App-Dependencies.md](Q-AS-BUILT-App-Dependencies.md) *(Complete dependency reference)*
	- [Z-New Covenant Schema.sql](Z-New%20Covenant%20Schema.sql)
	- [Z-Combined_Schema_Manifest.deployable.json](Z-Combined_Schema_Manifest.deployable.json)

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
		- [README.md](Deployment/Firestore/README.md)
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
		- [README.md](Secrets/Flock/README.md)
	- [README.md](Secrets/README.md)

- **Tests/**
	- [README.md](Tests/README.md)

- **Data/**
	- [README.md](Data/README.md)

- **Debugging/**
	- [README.md](Debugging/README.md)

---

## Update source
- Primary source for mirrored docs: Architechtural Docs/New Covenant/

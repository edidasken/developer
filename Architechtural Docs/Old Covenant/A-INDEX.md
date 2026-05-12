# Old Covenant Architecture Index

Created: 2026-04-28 | Updated: 2026-05-11
Role: Documentation for the legacy FlockOS platform (Covenant/). Historical reference — not the active development target.

---

## Release Notes

- **2026-05-11:** Index rebuilt to reflect actual as-built contents of Old Covenant docs.
- **2026-04-28:** Initial structure established.

---

## Root Files

- [A-INDEX.md](A-INDEX.md) — This file
- [B-FLOW-POLICY.md](B-FLOW-POLICY.md) — Old Covenant branching and deployment policy

---

## Architecture/

Design and operational documents covering the full lifecycle of the legacy Covenant platform.

| File | Purpose |
|------|---------|
| `A-Table of Contents.md` | Master table of contents and full file index for all Covenant architecture docs (updated April 2026 after archive cleanup) |
| `A-Plan for New Covenant.md` | Scope document for the New Covenant rewrite — ES module architecture, entry point, contract registry, domain modules |
| `AA-Project Support Pitch.md` | Missionary support pitch for FlockOS — the vision, the problem (fragmented church software), and the stewardship case |
| `B-In Order to Send.md` | Succession document — everything that must be done technically, spiritually, and practically before FlockOS can live on without its builder |
| `C-Self-Hosting Guide.md` | How to host FlockOS independently for your own church using GAS + Sheets + GitHub Pages + Firebase (cost: $0 for most churches) |
| `D-Deployment and Connection.md` | As-built v1.0 deployment guide — build script, launcher layout, app links, CSS source of truth, church config requirements, root and church deployment paths |
| `E-Bezalel Dependencies.md` | As-built v1.0 Bezalel build system — what Bezalel is, how it works, dependencies, codex files, and the A-Build_Churches.sh pipeline |
| `F-Sync Secrets.md` | GAS `SYNC_SECRET` values and Sheet IDs for all church deployments (FlockOS, TBC, TheForest, GAS) — set in Script Properties |
| `G-Verified Endpoints.md` | Live GAS web app URLs and Firebase configs for all church deployments (FlockOS, TBC, TheForest, GAS) |
| `H-End to End Plan.md` | As-built v1.0 end-to-end architecture — single-source-of-truth model, canonical source locations, build pipeline, config requirements |
| `I-Firestore Reduction.md` | Firestore read reduction plan — project mapping per church, analysis of `the_upper_room.js` (~154 `.get()` calls, 6 listeners), optimization strategy |
| `J-Firestore Rules.md` | As-built v1.0 Firestore security rules — per-church project model (no `churches/{id}` nesting), deploy instructions, canonical rules source |
| `K-Flock Docs.md` | FlockOS: The Complete Guide — full multi-chapter documentation of the platform vision, architecture, modules, deployment, security, and operational continuity |
| `P-Master Cleanup FlockOS.md` | GAS Google Sheets cleanup scripts — `DeleteUnknownTabs.gs` with `CLEAN_GAS`, `STRIP_TO_FIRESTORE`, and migration modes |
| `Q-The 150 Plan.md` | The 150/100 roadmap — scored improvement plan for FlockOS v3.17 (created April 12, 2026) |
| `R-Permissions Plan.md` | As-built v3.5 AccessControl Groups reference — Column D values, granular `MODULE_PERMISSIONS` in GAS, all modules implemented |
| `S-FlockChat.md` | FlockChat build plan — real-time team messaging for the church, HipChat-inspired, backed by flockos-comms Firebase project |
| `T-Permissions Audit.md` | As-built permissions audit (April 13, 2026) — RBAC role definitions from `the_cornerstone.js`, `firm_foundation.js`, `the_tabernacle.js` |
| `U-Workflows.md` | Church operational workflows — Elder Care workflow and others for coordinating sustained church support |
| `V-Bezalel.html` | Bezalel build dashboard (HTML) — in-browser tool for viewing and deploying GAS source code |
| `V-Covenant-v1.0-Release.md` | Covenant v1.0 release notes — as-built documentation update summary, links to all canonical architecture docs |
| `V-Covenant-v1.1-Release.md` | Covenant v1.1 release notes — builds on v1.0 architecture foundation, updated canonical docs |
| `W-Timeline.md` | Project timeline — detailed day-by-day build log (April 14–24, 2026) covering FlockChat integration, multi-church build system, UI/UX overhaul |
| `X-Action Items.md` | Open backend/frontend gap items — prioritized implementation task list (last updated April 21, 2026, v3.17) |
| `Y-Debugging Issues.md` | Debugging checklist for any church deployment — how to test, what to capture in `[FLOCK-DEBUG]` console output, how to report issues |
| `Z-Project Documents.md` | Comprehensive file index of the entire FlockOS master project — use as checklist for site-wide updates (last audited April 21, 2026, v3.17) |
| `Z-Variance.md` | Complete schema audit — variance between Covenant and New_Covenant runtime Firestore contracts, sync maps, camelCase field maps, and UI payload schemas |

---

## Automation/

Documentation for the Old Covenant automation layer (docs only — no live scripts).

| File | Purpose |
|------|---------|
| `A-README.md` | Automation folder overview |
| `B-generate_schema_manifest_from_sql.md` | Docs for the schema manifest generator |
| `C-mirror_architecture_to_old_covenant.md` | Docs for the architecture mirror script |
| `D-publish_truth_schema_backup.md` | Docs for the schema backup publisher |

---

## Platforms/

Platform-specific documentation for ATOG and FlockChat.

### Platforms/ATOG/ — A Touch of the Gospel

| File | Purpose |
|------|---------|
| `A-Table of Contents.md` | ATOG table of contents |
| `A-ATOG Style Sheet.md` | ATOG styling guide |
| `A-Differences in Theme.md` | Theme differences between ATOG and FlockOS |
| `B-Overview and Architecture.md` | ATOG architecture overview |
| `C-Firebase Project Setup.md` | Firebase project setup for ATOG |
| `D-Deployment Guide.md` | ATOG deployment guide |
| `E-Push Notifications.md` | Push notification setup |
| `F-Firebase Config and Keys.md` | Firebase config and key management |
| `G-Firestore Rules.md` | ATOG Firestore security rules |
| `H-Roles and Permissions.md` | ATOG roles and permissions |
| `I-File Map.md` | ATOG file map |
| `J-ATOG Built Deployment Links.md` | As-built deployment links |
| `K-ATOG Built Firestore Rules.md` | As-built Firestore rules |

### Platforms/FlockChat/

| File | Purpose |
|------|---------|
| `A-Table of Contents.md` | FlockChat table of contents |
| `B-Overview and Architecture.md` | FlockChat architecture overview |
| `C-Firebase Project Setup.md` | Firebase project setup for FlockChat |
| `D-Deployment Guide.md` | FlockChat deployment guide |
| `E-Push Notifications.md` | Push notification setup |
| `F-Firebase Config and Keys.md` | Firebase config and key management |
| `G-Firestore Rules.md` | FlockChat Firestore security rules |
| `H-Roles and Permissions.md` | FlockChat roles and permissions |
| `I-File Map.md` | FlockChat file map |
| `J-FlockChat Deployment Links.md` | As-built deployment links |
| `K-FlockChat Firestore Rules.md` | As-built Firestore rules |

---

## Runbooks/

Operational runbooks and build records.

| File | Purpose |
|------|---------|
| `A-Builds.md` | Build history and church deployment records |
| `B-Testimony-Structure-Map.md` | Testimony data structure map |
| `Dashboard.html` | Build dashboard (HTML) |
| `Snapshot.sh` | Incremental backup script |

---

## Tests/

Architecture-level test scripts.

| File | Purpose |
|------|---------|
| `deployment_tests.js` | Deployment validation tests |
| `foundation_tests.js` | Foundation/core module tests |
| `vine_tests.js` | Vine module tests |
| `index.html` | Test runner UI |

---

## Update Source
- Historical reference. Changes to the live platform go in `Architechtural Docs/New Covenant/`.

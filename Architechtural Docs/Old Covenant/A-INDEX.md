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

Design and operational documents covering the full lifecycle of the legacy platform.

| File | Purpose |
|------|---------|
| `A-Table of Contents.md` | Master table of contents |
| `A-Plan for New Covenant.md` | Bridge document — the plan that initiated the New Covenant rewrite |
| `AA-Project Support Pitch.md` | Project support pitch document |
| `B-In Order to Send.md` | Sending and deployment prerequisites |
| `C-Self-Hosting Guide.md` | Self-hosting setup guide |
| `D-Deployment and Connection.md` | Deployment and Firebase connection guide |
| `E-Bezalel Dependencies.md` | Bezalel script dependencies |
| `F-Sync Secrets.md` | Secrets sync procedures |
| `G-Verified Endpoints.md` | Verified API and Firebase endpoints |
| `H-End to End Plan.md` | End-to-end architecture plan |
| `I-Firestore Reduction.md` | Firestore data reduction strategy |
| `J-Firestore Rules.md` | Firestore security rules documentation |
| `K-Flock Docs.md` | Flock platform documentation |
| `P-Master Cleanup FlockOS.md` | Master cleanup and refactor log |
| `Q-The 150 Plan.md` | The 150-church growth plan |
| `R-Permissions Plan.md` | Role and permissions plan |
| `S-FlockChat.md` | FlockChat architecture notes |
| `T-Permissions Audit.md` | Permissions audit results |
| `U-Workflows.md` | Operational workflows |
| `V-Bezalel.html` | Bezalel build dashboard (HTML) |
| `V-Covenant-v1.0-Release.md` | Covenant v1.0 release notes |
| `V-Covenant-v1.1-Release.md` | Covenant v1.1 release notes |
| `W-Timeline.md` | Project timeline |
| `X-Action Items.md` | Outstanding action items |
| `Y-Debugging Issues.md` | Debugging history and known issues |
| `Z-Project Documents.md` | Supporting project documents |
| `Z-Variance.md` | Variance log (planned vs. actual) |

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

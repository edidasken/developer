# Testimony Structure Map

Purpose: keep Covenant/Testimony as the single understandable home for internal docs, operational references, and secrets.

## Canonical Folder Roles

- Covenant/Testimony/Architecture
  - Core FlockOS architecture and master references.
  - Includes master code docs used by build codex generation:
    - L-Master Code.md
    - M-Master FirestoreSync.md
    - N-Master SyncHandler.md
    - O-Master CamelCase.md

- Covenant/Testimony/Platforms
  - Platform-specific documentation sets.
  - Use one subfolder per platform:
    - ATOG
    - FlockChat

- Covenant/Testimony/Runbooks
  - Operational runbooks, maps, and active deployment references.
  - Includes Builds.md (deployment tree source for FlockOS_Churches.html).

- Covenant/Testimony/Secrets
  - Local-only secret material.
  - Keep secret files under Secrets/Flock.
  - Never publish this content.

- Covenant/Testimony/Migration
  - Temporary migration notes/checklists while restructuring.

## What Does NOT Belong Here

- Runtime app source code (Pages, Scripts, Images) should stay under Covenant/Courts.
- Build implementation scripts should stay under Covenant/Bezalel/Scripts.
- Church deployment outputs should stay under Covenant/Nations.

## Legacy Policy

- If content is obsolete, duplicate, or replaced by a canonical file:
  - Move it to Covenant/Storehouse/Legacy with a date-stamped folder.
- Do not keep duplicate source-of-truth copies in active folders.

## Source-of-Truth Rules

1. One active source per artifact type.
2. Duplicates are archived, not left in parallel active trees.
3. Update references when moving sources.
4. Keep folder intent stable to avoid future drift.

## Quick Placement Guide

- "Architecture/master code docs" -> Covenant/Testimony/Architecture
- "Platform docs" -> Covenant/Testimony/Platforms/<PlatformName>
- "Ops runbook / deployment map" -> Covenant/Testimony/Runbooks
- "Secrets/keys/password-json" -> Covenant/Testimony/Secrets/Flock
- "Historical/retired copies" -> Covenant/Storehouse/Legacy

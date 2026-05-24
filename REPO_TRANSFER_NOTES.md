# Repo Transfer Notes

## Purpose
This repository is being transferred to a new GitHub account/repo name. The target repo name should be `developer`.

## Important context
- The full repository contents need to be copied over intact.
- Architectural docs will be moved separately.
- After the transfer, build scripts may need path updates and/or repo-name adjustments.
- Keep this file in the repo root so it can be copied into the new repository and used as context for a fresh Sonnet chat.

## Current repo shape
- Root project contains the main web app, Capacitor config, and deployment/build metadata.
- There are multiple generations / deployment trees:
  - `New_Covenant/` — primary active source tree
  - `Nations/` — built deployment outputs
  - `Iris/` — operational build scripts and automation
  - `flockchat-public/` — FlockChat public deploy source
  - `functions/` and `functions-fcm/` — Firebase function code
  - `Architechtural Docs/` — separate docs, intended to be handled separately from the code transfer

## Build notes
- Root `package.json` has `build:www`, `cap:sync`, `cap:ios`, and `cap:android`.
- `Nations/FlockOS/package.json` and related Nation folders use a more complete `build:www` rsync-based packaging flow.
- The repo documentation currently describes:
  - A-Build for `Covenant/`
  - B-Build for `New_Covenant/` → `Nations/<Church>/`
- If the repo name changes, check any scripts, docs, or config that still hardcode `FlockOS` or the old GitHub URL.

## Likely follow-up tasks after transfer
- Update repo name references from `FlockOS` to `developer` where appropriate.
- Verify remote URLs, GitHub Pages / hosting references, and any build output paths.
- Confirm the entire working tree was copied, including hidden files and build metadata.
- Re-run the build after any path/script changes.
- Commit and push the final state from the new remote.

## Suggested next-chat prompt
“Review the repo transfer notes, rename/repoint any scripts or metadata still tied to the old repo name, verify the build pipeline, and confirm the new repo is complete.”

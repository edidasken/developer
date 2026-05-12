# Nations/

Created: 2026-05-11

---

## What Is This Folder?

`Nations/` is the **build output directory** for all church deployments of FlockOS New Covenant.

Each subfolder represents one deployed church instance — a fully branded, self-contained copy of the FlockOS app shell. These folders are generated and maintained automatically by the **B-Build** process (`A-Build_Churches.sh`) and are **never edited by hand**.

---

## How It Works

The B-Build script reads from the master source at `New_Covenant/` (the canonical single source of truth), applies each church's branding and configuration, and rsyncs the result into the corresponding `Nations/<Church>/` folder. From there, Firebase Hosting serves each church's copy from its dedicated project.

**Source:** `New_Covenant/`
**Build script:** `Iris/Bezalel/Scripts/A-Build_Churches.sh`
**Deploy target:** Firebase Hosting (one project per church)

---

## Current Church Deployments

| Folder        | Church / Deployment        |
|---------------|---------------------------|
| `FlockOS/`    | FlockOS Root (master demo) |
| `GAS/`        | Greater Anointing Sanctuary |
| `Root/`       | FlockOS Root namespace     |
| `TBC/`        | Trinity Baptist Church     |
| `TheForest/`  | The Forest Church          |

---

## Folder Structure (per church)

Each church folder mirrors `New_Covenant/` exactly after build:

```
<Church>/
  index.html          ← branded app shell
  the_living_water.js ← core app module
  Scripts/            ← app scripts
  Styles/             ← app styles
  Views/              ← page views
  Data/               ← static data assets
  Images/             ← branding and UI images
  app.embeds/         ← embedded content shell
  app.flockos/        ← FlockOS sub-app
  app.grow/           ← Grow sub-app
  app.invite/         ← Invite sub-app
  app.stand/          ← Stand sub-app
```

---

## Rules

- **Do NOT edit files here directly.** All changes must be made in `New_Covenant/` and pushed through B-Build.
- **Do NOT add new church folders manually.** Adding a church requires updating `New_Covenant/Scripts/builds_codex.js` and the build script, then running B-Build.
- These folders are tracked in git as build artifacts — they should always reflect the last successful build.

#!/usr/bin/env bash
# ======================================================================
# B-Standalone_Repo_Scaffold.sh — Add standalone repo metadata to a
# built Nation folder so it can function as its own repository root.
#
# Usage:
#   bash Iris/Bezalel/Scripts/B-Standalone_Repo_Scaffold.sh \
#     Nations/FlockOS "FlockOS" "flockos" "Nations/Root"
# ======================================================================
set -euo pipefail

TARGET_DIR="${1:?Usage: bash $0 <target-dir> <church-name> <repo-name> <source-export-dir>}"
CHURCH_NAME="${2:?Usage: bash $0 <target-dir> <church-name> <repo-name> <source-export-dir>}"
SHORT_NAME="${3:?Usage: bash $0 <target-dir> <church-name> <repo-name> <source-export-dir>}"
SOURCE_EXPORT_DIR="${4:?Usage: bash $0 <target-dir> <church-name> <repo-name> <source-export-dir>}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$SCRIPT_DIR/../../.." && pwd)"
REPO_ROOT="$WORKSPACE"

copy_if_exists() {
  local source_path="$1"
  local destination_path="$2"
  if [ -f "$source_path" ]; then
    cp "$source_path" "$destination_path"
  fi
}

mkdir -p "$TARGET_DIR"

echo "  → Adding standalone repo files to $(basename "$TARGET_DIR")"

# Root-level configuration and license files that should exist in every
# standalone Nation repo.
ROOT_FILES=(
  .firebaseignore
  .firebaserc
  .gitignore
  .nojekyll
  LICENSE
  capacitor.config.ts
  church.firestore.rules
  firebase.json
  FlockChat.Firestore.Rules
)

CONFIG_FILES=(
  "config/church-firestore.firebase.json|church-firestore.firebase.json"
  "config/church-firestore.json|church-firestore.json"
  "config/firestore.indexes.json|firestore.indexes.json"
  "config/firebase-church.json|firebase-church.json"
  "config/flockchat-firebase.json|flockchat-firebase.json"
  "config/flockchat-firestore.indexes.json|flockchat-firestore.indexes.json"
)

for file in "${ROOT_FILES[@]}"; do
  copy_if_exists "$REPO_ROOT/$file" "$TARGET_DIR/$file"
done

copy_if_exists "$REPO_ROOT/Nations/Root/package-lock.json" "$TARGET_DIR/package-lock.json"

for mapping in "${CONFIG_FILES[@]}"; do
  IFS='|' read -r source_path destination_path <<< "$mapping"
  copy_if_exists "$REPO_ROOT/$source_path" "$TARGET_DIR/$destination_path"
done

copy_if_exists "$SCRIPT_DIR/Import_FlockOS.sh" "$TARGET_DIR/Import_FlockOS.sh"

if [ -f "$TARGET_DIR/Import_FlockOS.sh" ]; then
  python3 - "$TARGET_DIR/Import_FlockOS.sh" "$SOURCE_EXPORT_DIR" <<'PYEOF'
from pathlib import Path
import sys

script_path = Path(sys.argv[1])
source_export_dir = sys.argv[2]

content = script_path.read_text()
old = 'SOURCE_DIR="${FLOCKOS_SOURCE_DIR:-/Users/greg.granger/Desktop/Deployments/Nations/FlockOS}"'
new = f'SOURCE_DIR="${{FLOCKOS_SOURCE_DIR:-{source_export_dir}}}"'
if old in content:
    content = content.replace(old, new)
else:
    content = content.replace("/Users/greg.granger/Desktop/Deployments/Nations/FlockOS", source_export_dir)
script_path.write_text(content)
PYEOF
fi

PACKAGE_TEMPLATE="$REPO_ROOT/Nations/Root/package.json"
python3 - "$PACKAGE_TEMPLATE" "$TARGET_DIR/package.json" "$CHURCH_NAME" "$SHORT_NAME" <<'PYEOF'
import json
import sys
from pathlib import Path

source_pkg = Path(sys.argv[1])
target_pkg = Path(sys.argv[2])
church_name = sys.argv[3]
short_name = sys.argv[4]

with source_pkg.open() as f:
    pkg = json.load(f)

# Keep the package name stable for the destination repo and make the
# standalone copy self-describing.
pkg["name"] = short_name
pkg["description"] = f"Standalone deployment repository for {church_name}."
pkg["private"] = True

build_www = (
    "rm -rf www && mkdir -p www && "
    "rsync -a --delete "
    "--exclude='.git/' "
    "--exclude='www/' "
    "--exclude='node_modules/' "
    "--exclude='.DS_Store' "
    "--exclude='.venv/' "
    "--exclude='venv/' "
    "--exclude='ios/' "
    "--exclude='android/' "
    "--exclude='.firebase/' "
    "--exclude='.vscode/' "
    "--exclude='.idea/' "
    "--exclude='*.log' "
    "--exclude='*.tmp' "
    "--exclude='*.bak' "
    "--exclude='package.json' "
    "--exclude='package-lock.json' "
    "--exclude='README.md' "
    "--exclude='LICENSE' "
    "--exclude='.gitignore' "
    "--exclude='.firebaseignore' "
    "--exclude='.nojekyll' "
    "--exclude='firebase.json' "
    "--exclude='flockchat-firebase.json' "
    "--exclude='FlockChat.Firestore.Rules' "
    "--exclude='church-firestore.firebase.json' "
    "--exclude='church-firestore.json' "
    "--exclude='church.firestore.rules' "
    "--exclude='capacitor.config.ts' "
    "./ www/FlockOS/ && "
    "cp index.html manifest.json the_living_water.js www/"
)

pkg["scripts"] = {
    "build:www": build_www,
    "cap:sync": "npm run build:www && npx cap sync",
    "cap:ios": "npm run cap:sync && npx cap open ios",
    "cap:android": "npm run cap:sync && npx cap open android"
}

with target_pkg.open("w") as f:
    json.dump(pkg, f, indent=2)
    f.write("\n")
PYEOF

cat > "$TARGET_DIR/.gitignore" <<'EOF'
# ══════════════════════════════════════════════════════════════════════════
# Standalone Nation repo .gitignore
# ══════════════════════════════════════════════════════════════════════════

# ── OS / Editor artifacts ─────────────────────────────────────────────────
.DS_Store
Thumbs.db
*.swp
*.swo
*~
.vscode/
.idea/

# ── Dependencies / build artifacts ────────────────────────────────────────
node_modules/
www/
ios/
android/
dist/
build/
coverage/
.cache/
.firebase/
*.log
*.tmp
*.bak

# ── Environment files ─────────────────────────────────────────────────────
.env
.env.*
EOF

python3 - "$TARGET_DIR/README.md" "$CHURCH_NAME" "$SHORT_NAME" <<'PYEOF'
import sys
from pathlib import Path

readme_path = Path(sys.argv[1])
church_name = sys.argv[2]
short_name = sys.argv[3]

content = f"""# FlockOS — {church_name}

Standalone FlockOS deployment repository for **{church_name}** (`{short_name}`).

This folder is generated by **B-Build** and is intended to be a complete,
self-contained repository root for this specific Nation.

## Included
- App shell and service worker
- App modules, views, data, images, and sub-apps
- Church-specific configuration and Firebase/hosting files
- License and repo metadata
- Standalone build scripts in `package.json`

## Common commands
```bash
npm install
npm run build:www
npm run cap:sync
```

## Notes
- This repo is meant to be edited as an independent deployment copy.
- Regenerate it from the master source by running the Nation build pipeline.
"""

readme_path.write_text(content)
PYEOF

echo "  ✓ Standalone repo scaffold ready for $(basename "$TARGET_DIR")"

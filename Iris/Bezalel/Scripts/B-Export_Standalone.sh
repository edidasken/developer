#!/usr/bin/env bash
# ======================================================================
# B-Export_Standalone.sh — Export a self-contained, standalone copy of
# the FlockOS project for one specific church.
#
# Output:
#   Covenant/Testimony/Migration/FlockOS CRM for <ShortName>/
#
# What's included:
#   • Repo-root project files (package.json, firebase.json, index.html, etc.)
#   • Full Covenant/ tree:
#       - Bezalel/      (all build scripts)
#       - Courts/       (FlockChat, ATOG, FlockOS source)
#       - Foundations/  (shared adapters, vessels)
#       - Gate/         (templates)
#       - Scrolls/      (only this church's JSON + ChurchTemplate)
#       - Shepherds/    (verify/build/deploy helpers)
#       - Testimony/    (full docs — gitignored in standalone)
#       - Storehouse/   (empty stub — no root data copied)
#   • Nations/<ShortName>/  ← only this church's branded deployment
#   • A fresh .gitignore that excludes Testimony/ and Storehouse/
#   • A fresh README pointer
#
# What's NOT included:
#   • .git history (fresh project)
#   • Other churches' folders under Nations/
#   • node_modules, .venv, snapshots, etc.
#
# Usage:
#   bash "Iris/Bezalel/Scripts/B-Export_Standalone.sh" <ShortName>
#   bash "Iris/Bezalel/Scripts/B-Export_Standalone.sh" TBC
#   bash "Iris/Bezalel/Scripts/B-Export_Standalone.sh" TheForest --dry-run
# ======================================================================
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────
DRY_RUN=false
SHORT_NAME=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    *) [ -z "$SHORT_NAME" ] && SHORT_NAME="$arg" ;;
  esac
done

if [ -z "$SHORT_NAME" ]; then
  echo "ERROR: Church short name required."
  echo "Usage: bash $0 <ShortName>"
  echo ""
  echo "Available churches:"
  for jf in "$(dirname "$0")/../../Scrolls/ChurchRegistry"/*.json; do
    bn="$(basename "$jf" .json)"
    [[ "$bn" == "ChurchTemplate" || "$bn" == "Master-API" ]] && continue
    echo "  • $bn"
  done
  exit 1
fi

# ── Paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
COVENANT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# When invoked via canonical Iris path, COVENANT_ROOT is wrong.
# Re-anchor to actual Covenant/ folder (which holds Courts, Scrolls, etc.).
if [ ! -d "$COVENANT_ROOT/Courts/TheTabernacle" ]; then
  _CANDIDATE_REPO="$(cd "$COVENANT_ROOT/.." && pwd)"
  if [ -d "$_CANDIDATE_REPO/Covenant/Courts/TheTabernacle" ]; then
    COVENANT_ROOT="$_CANDIDATE_REPO/Covenant"
  fi
fi
REPO_ROOT="$(cd "$COVENANT_ROOT/.." && pwd)"
CONFIGS_DIR="$COVENANT_ROOT/Scrolls/ChurchRegistry"

# Resolve the church config (try local file first, then ask user it's a known shortName)
CHURCH_CONFIG=""
if [ -f "$CONFIGS_DIR/${SHORT_NAME}.json" ]; then
  CHURCH_CONFIG="$CONFIGS_DIR/${SHORT_NAME}.json"
fi

if [ -z "$CHURCH_CONFIG" ]; then
  # Fall back to looking up by .shortName in any local JSON
  for jf in "$CONFIGS_DIR"/*.json; do
    bn="$(basename "$jf" .json)"
    [[ "$bn" == "ChurchTemplate" || "$bn" == "Master-API" ]] && continue
    if [ "$(jq -r '.shortName // empty' "$jf")" = "$SHORT_NAME" ]; then
      CHURCH_CONFIG="$jf"
      break
    fi
  done
fi

# Last resort: fetch from master API
if [ -z "$CHURCH_CONFIG" ] && [ -f "$CONFIGS_DIR/Master-API.json" ]; then
  _API_URL=$(jq -r '.apiUrl // empty' "$CONFIGS_DIR/Master-API.json")
  if [ -n "$_API_URL" ]; then
    echo "Fetching $SHORT_NAME from master API…"
    _RESP=$(curl -sfL "${_API_URL}?action=church.configs" 2>/dev/null || echo '')
    _MATCH=$(echo "$_RESP" | jq --arg sn "$SHORT_NAME" '.configs[] | select(.shortName==$sn)')
    if [ -n "$_MATCH" ]; then
      CHURCH_CONFIG="$(mktemp)"
      echo "$_MATCH" > "$CHURCH_CONFIG"
    fi
  fi
fi

if [ -z "$CHURCH_CONFIG" ] || [ ! -s "$CHURCH_CONFIG" ]; then
  echo "ERROR: No config found for shortName '$SHORT_NAME'."
  exit 1
fi

CHURCH_NAME=$(jq -r '.name'      "$CHURCH_CONFIG")
CHURCH_SHORT=$(jq -r '.shortName' "$CHURCH_CONFIG")
EXPORT_NAME="FlockOS CRM for ${CHURCH_SHORT}"
EXPORT_DEST="$COVENANT_ROOT/Testimony/Migration/${EXPORT_NAME}"

# ── Pre-flight ────────────────────────────────────────────────────────
echo "════════════════════════════════════════════════════════════════════"
echo "  Standalone Export: $CHURCH_NAME ($CHURCH_SHORT)"
echo "════════════════════════════════════════════════════════════════════"
echo "  Source:      $REPO_ROOT"
echo "  Destination: $EXPORT_DEST"
$DRY_RUN && echo "  Mode:        DRY-RUN (no files will be written)"
echo ""

command -v rsync >/dev/null || { echo "ERROR: rsync required"; exit 1; }
command -v jq    >/dev/null || { echo "ERROR: jq required";    exit 1; }

# Ensure the church has a built deployment to copy
DEPLOYED_DIR="$COVENANT_ROOT/Nations/$CHURCH_SHORT"
if [ ! -d "$DEPLOYED_DIR/FlockOS" ]; then
  echo "ERROR: No built deployment at Nations/$CHURCH_SHORT/FlockOS/"
  echo "       Run A-Build_Churches.sh first."
  exit 1
fi

# ── Build action plan ─────────────────────────────────────────────────
RSYNC_FLAGS=(-a)
$DRY_RUN && RSYNC_FLAGS+=(--dry-run)

# Common excludes for any rsync into the export
COMMON_EXCLUDES=(
  --exclude='.DS_Store'
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='.venv/'
  --exclude='venv/'
  --exclude='__pycache__/'
  --exclude='*.pyc'
  --exclude='*.log'
  --exclude='*.bak'
  --exclude='.next/'
  --exclude='dist/'
  --exclude='build/'
  --exclude='.cache/'
)

# ── Wipe any previous export and recreate ─────────────────────────────
if ! $DRY_RUN; then
  if [ -d "$EXPORT_DEST" ]; then
    echo "Removing previous export…"
    rm -rf "$EXPORT_DEST"
  fi
  mkdir -p "$EXPORT_DEST"
fi

# ── 1. Repo-root project files ────────────────────────────────────────
echo "[1/7] Copying repo-root project files…"
ROOT_FILES=(
  package.json
  package-lock.json
  firebase.json
  FlockChat.Firestore.Rules
  capacitor.config.ts
  index.html
  LICENSE
  README.md
)
CONFIG_FILES=(
  "config/church-firestore.firebase.json|church-firestore.firebase.json"
  "config/church-firestore.json|church-firestore.json"
  "config/firebase-church.json|firebase-church.json"
  "config/firestore.indexes.json|firestore.indexes.json"
  "config/flockchat-firebase.json|flockchat-firebase.json"
  "config/flockchat-firestore.indexes.json|flockchat-firestore.indexes.json"
)
for f in "${ROOT_FILES[@]}"; do
  if [ -f "$REPO_ROOT/$f" ]; then
    if $DRY_RUN; then
      echo "    [dry-run] $f"
    else
      cp "$REPO_ROOT/$f" "$EXPORT_DEST/$f"
    fi
  fi
done
for mapping in "${CONFIG_FILES[@]}"; do
  IFS='|' read -r source_path destination_path <<< "$mapping"
  if [ -f "$REPO_ROOT/$source_path" ]; then
    if $DRY_RUN; then
      echo "    [dry-run] $destination_path"
    else
      cp "$REPO_ROOT/$source_path" "$EXPORT_DEST/$destination_path"
    fi
  fi
done

# Also copy the public hosting tree (FlockChat hosting source)
if [ -d "$REPO_ROOT/flockchat-public" ]; then
  echo "    flockchat-public/ (FlockChat hosting tree)"
  rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
    "$REPO_ROOT/flockchat-public/" "$EXPORT_DEST/flockchat-public/"
fi

# ── 2. Covenant/ — sub-tree by sub-tree ───────────────────────────────
echo "[2/7] Copying Bezalel/ (build scripts) from Iris/…"
rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
  "$REPO_ROOT/Iris/Bezalel/" "$EXPORT_DEST/Covenant/Bezalel/"

echo "[3/7] Copying Covenant/Courts/ (FlockOS, FlockChat, ATOG sources)…"
rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
  "$COVENANT_ROOT/Courts/" "$EXPORT_DEST/Covenant/Courts/"

echo "[4/7] Copying Covenant/Foundations/, Gate/, Shepherds/, Scrolls/ProductRegistry/…"
for sub in Foundations Gate Shepherds; do
  if [ -d "$COVENANT_ROOT/$sub" ]; then
    rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
      "$COVENANT_ROOT/$sub/" "$EXPORT_DEST/Covenant/$sub/"
  fi
done
if [ -d "$COVENANT_ROOT/Scrolls/ProductRegistry" ]; then
  rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
    "$COVENANT_ROOT/Scrolls/ProductRegistry/" "$EXPORT_DEST/Covenant/Scrolls/ProductRegistry/"
fi

# ── 5. Scrolls/ChurchRegistry — only THIS church + template ───────────
echo "[5/7] Copying Covenant/Scrolls/ChurchRegistry/ (only $CHURCH_SHORT + template)…"
if ! $DRY_RUN; then
  mkdir -p "$EXPORT_DEST/Covenant/Scrolls/ChurchRegistry"
  cp "$CONFIGS_DIR/ChurchTemplate.json" "$EXPORT_DEST/Covenant/Scrolls/ChurchRegistry/" 2>/dev/null || true
  # Write the church's config under its shortName.json (works whether source was local or API-fetched)
  jq '.' "$CHURCH_CONFIG" > "$EXPORT_DEST/Covenant/Scrolls/ChurchRegistry/${CHURCH_SHORT}.json"
else
  echo "    [dry-run] ChurchTemplate.json + ${CHURCH_SHORT}.json"
fi

# ── 6. Testimony/ + empty Storehouse/ ─────────────────────────────────
echo "[6/7] Copying Covenant/Testimony/ (will be gitignored in standalone)…"
rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
  --exclude='Migration/' \
  "$COVENANT_ROOT/Testimony/" "$EXPORT_DEST/Covenant/Testimony/"

if ! $DRY_RUN; then
  mkdir -p "$EXPORT_DEST/Covenant/Storehouse"
  cat > "$EXPORT_DEST/Covenant/Storehouse/README.md" <<'EOF'
# Storehouse

This folder is intentionally empty in standalone exports.
Use it for your own backups, archived files, and legacy material.
EOF
fi

# ── 7. Nations/<ShortName>/ — branded deployment + standalone scaffolding
echo "[7/7] Copying Covenant/Nations/$CHURCH_SHORT/ (branded deployment)…"
rsync "${RSYNC_FLAGS[@]}" "${COMMON_EXCLUDES[@]}" \
  "$DEPLOYED_DIR/" "$EXPORT_DEST/Covenant/Nations/$CHURCH_SHORT/"

# ── Standalone scaffolding: .gitignore + README pointer ───────────────
if ! $DRY_RUN; then
  cat > "$EXPORT_DEST/.gitignore" <<'EOF'
# ── OS / editor noise ──
.DS_Store
*.swp
*~

# ── Dependencies / build artifacts ──
node_modules/
.venv/
venv/
__pycache__/
*.pyc
.next/
dist/
build/
.cache/
*.log

# ── Local-only working folders ──
Covenant/Testimony/
Covenant/Storehouse/

# ── Firebase / secrets (church-specific — keep out of public commits) ──
.firebaserc
*-service-account.json
*.firebase-debug.log
EOF

  cat > "$EXPORT_DEST/STANDALONE.md" <<EOF
# FlockOS CRM for ${CHURCH_NAME} (${CHURCH_SHORT})

This is a standalone export of the FlockOS platform branded for **${CHURCH_NAME}**.

Generated: $(date '+%Y-%m-%d %H:%M:%S %Z')
Source:    Master FlockOS repo @ $(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'untracked')

## What's here
- \`Covenant/Nations/${CHURCH_SHORT}/\` — your branded FlockOS deployment
- \`Covenant/Courts/\` — full source for FlockOS, FlockChat, ATOG
- \`Covenant/Bezalel/Scripts/\` — build & deploy scripts
- \`Covenant/Scrolls/ChurchRegistry/${CHURCH_SHORT}.json\` — your church config
- \`Covenant/Testimony/\` — internal documentation (gitignored)

## Quick start

\`\`\`bash
# Initialize git (this export has no .git history)
git init && git add -A && git commit -m "Initial standalone export"

# Rebuild the deployment after edits
bash "Iris/Bezalel/Scripts/A-Build_Churches.sh"
\`\`\`

## Live URL
After deploying to GitHub Pages or your own hosting, your FlockOS will be at:
\`<your-host>/Covenant/Nations/${CHURCH_SHORT}/index.html\`
EOF
fi

# ── Summary ───────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
if $DRY_RUN; then
  echo "  Dry-run complete — no files written."
else
  SIZE=$(du -sh "$EXPORT_DEST" 2>/dev/null | awk '{print $1}')
  echo "  ✓ Export complete: $EXPORT_NAME  ($SIZE)"
  echo "  → $EXPORT_DEST"
fi
echo "════════════════════════════════════════════════════════════════════"

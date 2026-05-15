#!/usr/bin/env bash
# ======================================================================
# FlockOS — Multi-Church Build Script
# Reads each JSON config in Architechtural Docs/New Covenant/Deployment/ChurchRegistry/ and produces a
# fully-branded deployment under Nations/<shortName>/
#
# BRANDING SOURCE OF TRUTH:
#   NewCovenant/brand.md
#   All brand values (colors, fonts, names, copy) are defined there.
#   Church-specific overrides live in Architechtural Docs/New Covenant/Deployment/ChurchRegistry/<church>.json
#   under the brandName field. This script reads brandName from each config
#   and injects it into the deployed HTML at build time.
#
# Output:
#   Nations/FlockOS/
#   Nations/GAS/
#   Nations/TBC/
#   Nations/TheForest/
# Note: GAS/TBC/TheForest configs are fetched from the master API (Master-API.json).
# ======================================================================
set -euo pipefail

# ── Flag parsing ─────────────────────────────────────────────────────
DRY_RUN=false
DEPLOY_COMMS=false
SKIP_TRUTH_SCHEMA_PUBLISH=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --deploy-comms) DEPLOY_COMMS=true ;;
    --skip-truth-schema-publish) SKIP_TRUTH_SCHEMA_PUBLISH=true ;;
  esac
done
if $DRY_RUN; then echo "🏗  DRY RUN — no files will be written"; echo ""; fi

COVENANT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# When invoked via canonical path (Iris/...), COVENANT_ROOT resolves
# to "Iris" — but Covenant/ tree still holds the rsync targets and
# Tabernacle source. Detect and re-anchor to the real Covenant/ folder.
if [ ! -d "$COVENANT_ROOT/Courts/TheTabernacle" ]; then
  WORKSPACE_ROOT="$(cd "$COVENANT_ROOT/.." && pwd)"
  if [ -d "$WORKSPACE_ROOT/Covenant/Courts/TheTabernacle" ]; then
    COVENANT_ROOT="$WORKSPACE_ROOT/Covenant"
  fi
fi
WORKSPACE_ROOT="$(cd "$COVENANT_ROOT/.." && pwd)"
CONFIGS_DIR="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Deployment/ChurchRegistry"
CHURCH_DIR="$COVENANT_ROOT/Nations"
SOURCE_DIR="$COVENANT_ROOT/Courts/TheTabernacle"
ROOT_MANIFEST="$CHURCH_DIR/FlockOS/manifest.json"
ROOT_SW="$CHURCH_DIR/FlockOS/the_living_water.js"

# ── Default values (hardcoded in source for GitHub Pages root) ────────
DEFAULT_CONFIG="$CONFIGS_DIR/FlockOS-Root.json"
DEF_NAME=$(jq -r '.name' "$DEFAULT_CONFIG")
DEF_TAGLINE=$(jq -r '.tagline' "$DEFAULT_CONFIG")
DEF_FAVICON=$(jq -r '.favicon' "$DEFAULT_CONFIG")
DEF_PORTRAIT=$(jq -r '.portrait' "$DEFAULT_CONFIG")
DEF_THEME=$(jq -r '.themeColor' "$DEFAULT_CONFIG")
DEF_BG=$(jq -r '.backgroundColor' "$DEFAULT_CONFIG")
DEF_DB_URL=$(jq -r '.databaseUrl' "$DEFAULT_CONFIG")

# ── Dependency check ──────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq"
  exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required for launcher generation."
  exit 1
fi
if ! $SKIP_TRUTH_SCHEMA_PUBLISH && ! command -v node &>/dev/null; then
  echo "ERROR: node is required for Truth schema backup publish."
  echo "       Install Node.js or re-run with --skip-truth-schema-publish"
  exit 1
fi
if $DEPLOY_COMMS && ! command -v firebase &>/dev/null; then
  echo "ERROR: firebase CLI is required for --deploy-comms. Install with: npm install -g firebase-tools"
  exit 1
fi

# ── Pre-flight validation ─────────────────────────────────────────────
echo "Running pre-flight checks…"
PREFLIGHT_OK=true

# Check critical source files exist
CRITICAL_FILES=(
  "$SOURCE_DIR/Pages/the_good_shepherd.html"
  "$SOURCE_DIR/Pages/index.html"
  "$SOURCE_DIR/Scripts/the_tabernacle.js"
  "$SOURCE_DIR/Scripts/the_true_vine.js"
  "$SOURCE_DIR/Scripts/the_living_water.js"
  "$SOURCE_DIR/Scripts/the_upper_room.js"
  "$SOURCE_DIR/Scripts/the_life.js"
  "$ROOT_MANIFEST"
  "$ROOT_SW"
)
for f in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "  ✗ MISSING: $f"
    PREFLIGHT_OK=false
  fi
done

# Validate JSON configs
for jf in "$CONFIGS_DIR"/*.json; do
  [[ "$(basename "$jf")" == "ChurchTemplate.json" ]] && continue
  [[ "$(basename "$jf")" == "Master-API.json" ]] && continue
  if ! jq empty "$jf" 2>/dev/null; then
    echo "  ✗ INVALID JSON: $(basename "$jf")"
    PREFLIGHT_OK=false
  else
    # Check required fields
    _sn=$(jq -r '.shortName // empty' "$jf")
    _db=$(jq -r '.databaseUrl // empty' "$jf")
    if [ -z "$_sn" ]; then
      echo "  ✗ Missing shortName in $(basename "$jf")"
      PREFLIGHT_OK=false
    fi
    if [ -z "$_db" ]; then
      echo "  ✗ Missing databaseUrl in $(basename "$jf")"
      PREFLIGHT_OK=false
    fi
  fi
done

# Validate root manifest.json
if ! jq empty "$ROOT_MANIFEST" 2>/dev/null; then
  echo "  ✗ INVALID JSON: manifest.json"
  PREFLIGHT_OK=false
fi

# Validate FlockChat hosting sources before optional comms deploy
if $DEPLOY_COMMS; then
  COMMS_REQUIRED_FILES=(
    "$WORKSPACE_ROOT/firebase.json"
    "$WORKSPACE_ROOT/Covenant/Courts/TheFellowship/FlockChat.html"
    "$WORKSPACE_ROOT/Covenant/Courts/TheFellowship/FlockChat/the_word.js"
    "$WORKSPACE_ROOT/Covenant/Courts/TheFellowship/FlockChat/manifest.json"
    "$WORKSPACE_ROOT/Covenant/Courts/TheFellowship/FlockChat/Images/FlockChat_AppIcon.png"
    "$WORKSPACE_ROOT/Covenant/Courts/TheFellowship/FlockChat/firebase-messaging-sw.js"
    "$WORKSPACE_ROOT/Covenant/Foundations/SharedVessels/styles/american_garments.css"
  )
  for f in "${COMMS_REQUIRED_FILES[@]}"; do
    if [ ! -f "$f" ]; then
      echo "  ✗ MISSING (comms deploy): $f"
      PREFLIGHT_OK=false
    fi
  done
fi

if ! $PREFLIGHT_OK; then
  echo ""
  echo "Pre-flight FAILED. Fix errors above before building."
  exit 1
fi
echo "  ✓ All pre-flight checks passed"
echo ""

# ── Optional: fetch church configs from the master FlockOS API ─────────────
# Create Active\ Deployments/Master-API.json with { "apiUrl": "...", "apiToken": "..." }
# to build church deployments from the Church Registry instead of local JSON files.
MASTER_API_FILE="$CONFIGS_DIR/Master-API.json"
BUILD_CONFIGS_DIR="$CONFIGS_DIR"  # default: use local JSON files

if [ -f "$MASTER_API_FILE" ]; then
  _API_URL=$(jq -r '.apiUrl // empty' "$MASTER_API_FILE")
  if [ -n "$_API_URL" ]; then
    echo "Fetching church configs from master API…"
    _RESPONSE=$(curl -sfL "${_API_URL}?action=church.configs" 2>/dev/null || echo '')
    if echo "$_RESPONSE" | jq -e '.ok == true and (.configs | length) > 0' &>/dev/null; then
      _TMP_DIR=$(mktemp -d)
      while IFS= read -r _cfg; do
        _SHORT=$(echo "$_cfg" | jq -r '.shortName')
        [ -z "$_SHORT" ] && continue
        echo "$_cfg" | jq '{
          id: .id, name: .name, shortName: .shortName, brandName: .brandName,
          tagline: .tagline, favicon: .favicon, portrait: .portrait,
          themeColor: .themeColor, backgroundColor: .backgroundColor,
          databaseUrl: .databaseUrl, photosUrl: .photosUrl,
          adminEmail: .adminEmail, analyticsId: .analyticsId,
          firebaseConfig: .firebaseConfig, version: .version
        }' > "$_TMP_DIR/flockos-${_SHORT}.json"
      done < <(echo "$_RESPONSE" | jq -c '.configs[]')
      _FETCHED=$(find "$_TMP_DIR" -name '*.json' | wc -l | tr -d ' ')
      echo "  → $_FETCHED config(s) fetched from API"
      BUILD_CONFIGS_DIR="$_TMP_DIR"
    else
      echo "Warning: API returned no active configs. Falling back to local JSON files."
    fi
  fi
fi

# ── Ensure Church output directory exists (do NOT wipe — preserves church-specific images) ─
mkdir -p "$CHURCH_DIR"

# ── Regenerate bezalel_codex.js from master Code.gs ────────────────────────
# This file embeds the full Code.gs content as a JS variable so bezalel.html
# and bezalel_matrix.html can offer a one-click Copy for Code.gs as well.
MASTER_CODE="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Architecture/B-Master Code.md"
CODEX_OUT="$SOURCE_DIR/Pages/bezalel_codex.js"
if ! $DRY_RUN && [ -f "$MASTER_CODE" ] && command -v python3 &>/dev/null; then
  python3 -c "
import json, sys
with open(sys.argv[1], 'r') as f:
    content = f.read()
lines = len(content.splitlines())
out  = '// AUTO-GENERATED by A-Build_Churches.sh — do not edit manually.\n'
out += '// Source: Architechtural Docs/New Covenant/Architecture/B-Master Code.md\n'
out += '// Lines: ' + str(lines) + '\n'
out += 'window.BEZALEL_CODE_GS = ' + json.dumps(content) + ';\n'
out += 'window.BEZALEL_CODE_GS_LINES = ' + str(lines) + ';\n'
with open(sys.argv[2], 'w') as f:
    f.write(out)
print('  → bezalel_codex.js regenerated (' + str(lines) + ' lines)')
" "$MASTER_CODE" "$CODEX_OUT"
  # Also copy to New_Covenant/Scripts/ so the New Covenant Bezalel view can load it
  cp "$CODEX_OUT" "$WORKSPACE_ROOT/New_Covenant/Scripts/bezalel_codex.js" 2>/dev/null && \
    echo "  → bezalel_codex.js copied to New_Covenant/Scripts/" || true
fi

# ── Publish combined schema manifest to FlockOS-Truth backup store ─────────
TRUTH_SCHEMA_MANIFEST="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Architecture/Z-Combined_Schema_Manifest.deployable.json"
TRUTH_SCHEMA_PUBLISHER="$WORKSPACE_ROOT/Iris/Bezalel/Scripts/publish_truth_schema_backup.cjs"
TRUTH_SCHEMA_SQL="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Architecture/Z-New Covenant Schema.sql"
if ! $SKIP_TRUTH_SCHEMA_PUBLISH; then
  echo "Publishing combined schema backup to FlockOS-Truth…"
  if $DRY_RUN; then
    echo "  [dry-run] Would run: node 'Iris/Bezalel/Scripts/publish_truth_schema_backup.cjs'"
  else
    if [ ! -f "$TRUTH_SCHEMA_SQL" ]; then
      echo "  ✗ MISSING: $TRUTH_SCHEMA_SQL"
      echo "    SQL schema is authoritative and required before running BCP."
      exit 1
    fi
    if [ ! -f "$TRUTH_SCHEMA_PUBLISHER" ]; then
      echo "  ✗ MISSING: $TRUTH_SCHEMA_PUBLISHER"
      exit 1
    fi
    (
      cd "$WORKSPACE_ROOT"
      node "$TRUTH_SCHEMA_PUBLISHER"
    )
    echo "  ✓ Schema backup published to flockos-truth"
  fi
  echo ""
fi

# ── Count configs (excluding template and Master-API) ───────────────────────
CONFIG_COUNT=$(find "$BUILD_CONFIGS_DIR" -maxdepth 1 -name '*.json' ! -name 'ChurchTemplate.json' ! -name 'Master-API.json' | wc -l | tr -d ' ')
if [ "$CONFIG_COUNT" -eq 0 ]; then
  echo "No church configs found in $BUILD_CONFIGS_DIR"
  exit 1
fi
echo "Building $CONFIG_COUNT church deployment(s)…"
echo ""

# ── Sync canonical CSS source-of-truth into Tabernacle before rsync ─────
# SharedVessels is the single source of truth; mirror it into Tabernacle
# so the church rsync (and Nations/Root reference) stay in sync.
SHARED_CSS="$COVENANT_ROOT/Foundations/SharedVessels/styles/american_garments.css"
TABERNACLE_CSS="$SOURCE_DIR/Styles/american_garments.css"
if [ -f "$SHARED_CSS" ]; then
  mkdir -p "$(dirname "$TABERNACLE_CSS")"
  if ! cmp -s "$SHARED_CSS" "$TABERNACLE_CSS"; then
    cp "$SHARED_CSS" "$TABERNACLE_CSS"
    echo "  → american_garments.css synced from SharedVessels → Tabernacle"
  fi
fi

# New_Covenant is a separate product. No sync from Tabernacle.

# ── Build each church ───────────────────────────────────────────────────
for config in "$BUILD_CONFIGS_DIR"/*.json; do
  # Skip template and API auth files
  [[ "$(basename "$config")" == "ChurchTemplate.json" ]] && continue
  [[ "$(basename "$config")" == "Master-API.json" ]] && continue

  CHURCH_NAME=$(jq -r '.name' "$config")
  CHURCH_SHORT=$(jq -r '.shortName' "$config")
  CHURCH_ID=$(jq -r '.id // empty' "$config")
  CHURCH_BRAND=$(jq -r '.brandName // .name' "$config")
  CHURCH_TAGLINE=$(jq -r '.tagline' "$config")
  CHURCH_FAVICON=$(jq -r '.favicon // empty' "$config")
  CHURCH_PORTRAIT=$(jq -r '.portrait // empty' "$config")
  CHURCH_THEME=$(jq -r '.themeColor' "$config")
  CHURCH_BG=$(jq -r '.backgroundColor' "$config")
  CHURCH_DB_URL=$(jq -r '.databaseUrl' "$config")
  CHURCH_PHOTOS_URL=$(jq -r '.photosUrl // empty' "$config")
  CHURCH_VERSION=$(jq -r '.version // "1.0"' "$config")
  CHURCH_ANALYTICS=$(jq -r '.analyticsId // empty' "$config")
  CHURCH_FB_CONFIG=$(jq -r '.firebaseConfig // empty' "$config")
  CHURCH_SHORT_LOWER=$(printf '%s' "$CHURCH_SHORT" | tr '[:upper:]' '[:lower:]')

  OUT="$CHURCH_DIR/$CHURCH_SHORT"
  echo "  → $CHURCH_SHORT ($CHURCH_NAME)"

  if $DRY_RUN; then
    echo "    [dry-run] Would build → Nations/$CHURCH_SHORT/"
    echo "    [dry-run]   DB URL: $CHURCH_DB_URL"
    echo "    [dry-run]   Theme: $CHURCH_THEME | BG: $CHURCH_BG"
    [ -n "$CHURCH_FB_CONFIG" ] && echo "    [dry-run]   Firebase: custom config"
    echo ""
    continue
  fi

  mkdir -p "$OUT"

  # 1. Copy FlockOS/ source tree (exclude dev-only files)
  rsync -a \
    --exclude='*.md' --exclude='*.gs' --exclude='*.bak' --exclude='*.txt' \
    --exclude='Tools/' \
    --exclude='FlockOS.html' \
    --exclude='Pages/bezalel_matrix_local.html' \
    "$SOURCE_DIR/" "$OUT/FlockOS/"

  # 1b. Copy public portal template to Nation root
  cp "$SOURCE_DIR/FlockOS.html" "$OUT/FlockOS.html"

  # 1c. Rewrite bare relative paths in portal FlockOS.html so they resolve from
  # the Nation root (where FlockOS.html lives) into the FlockOS/ subfolder
  # (where Scripts/, Pages/, Images/, Styles/ actually got rsynced in step 1).
  # Without this, src="Scripts/fine_linen.js" 404s and Adornment/etc. are
  # undefined at runtime ("the adornment is missing").
  sed -i '' \
    -e 's|src="Scripts/|src="FlockOS/Scripts/|g' \
    -e 's|src="Pages/|src="FlockOS/Pages/|g' \
    -e 's|src="Images/|src="FlockOS/Images/|g' \
    -e 's|href="Scripts/|href="FlockOS/Scripts/|g' \
    -e 's|href="Pages/|href="FlockOS/Pages/|g' \
    -e 's|href="Images/|href="FlockOS/Images/|g' \
    -e 's|href="Styles/|href="FlockOS/Styles/|g' \
    -e "s|href='Pages/|href='FlockOS/Pages/|g" \
    "$OUT/FlockOS.html"

  # 2. Copy root-level manifest and service worker
  [ "$ROOT_MANIFEST" != "$OUT/manifest.json" ] && cp "$ROOT_MANIFEST" "$OUT/manifest.json"
  [ "$ROOT_SW" != "$OUT/the_living_water.js" ] && cp "$ROOT_SW"       "$OUT/the_living_water.js"

  # 2b. Copy LICENSE from repo root into each church deployment
  if [ -f "$WORKSPACE_ROOT/LICENSE" ]; then
    cp "$WORKSPACE_ROOT/LICENSE" "$OUT/LICENSE"
  fi

  # 2a. Generate thin redirect index.html — legacy bookmark / direct URL support
  cat > "$OUT/index.html" <<'REDIRECT_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0; url=FlockOS.html">
  <script>window.location.replace('FlockOS.html');</script>
  <title>FlockOS</title>
</head>
<body></body>
</html>
REDIRECT_EOF

  # 3. Brand with church-specific values

  # Escape values for sed
  ESC_NAME=$(printf '%s\n' "$CHURCH_NAME" | sed 's/[&/\\]/\\&/g')
  ESC_BRAND=$(printf '%s\n' "$CHURCH_BRAND" | sed 's/[&#\\]/\\&/g')
  ESC_TAGLINE=$(printf '%s\n' "$CHURCH_TAGLINE" | sed 's/[&/\\]/\\&/g')
  ESC_FAVICON=$(printf '%s\n' "$CHURCH_FAVICON" | sed 's/[&/\\]/\\&/g')
  ESC_PORTRAIT=$(printf '%s\n' "$CHURCH_PORTRAIT" | sed 's/[&/\\]/\\&/g')
  ESC_THEME=$(printf '%s\n' "$CHURCH_THEME" | sed 's/[&/\\]/\\&/g')
  ESC_BG=$(printf '%s\n' "$CHURCH_BG" | sed 's/[&/\\]/\\&/g')
  ESC_DB_URL=$(printf '%s\n' "$CHURCH_DB_URL" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_DB_URL=$(printf '%s\n' "$DEF_DB_URL" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_TAGLINE=$(printf '%s\n' "$DEF_TAGLINE" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_FAVICON=$(printf '%s\n' "$DEF_FAVICON" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_PORTRAIT=$(printf '%s\n' "$DEF_PORTRAIT" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_THEME=$(printf '%s\n' "$DEF_THEME" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_BG=$(printf '%s\n' "$DEF_BG" | sed 's/[&/\\]/\\&/g')
  ESC_DEF_NAME=$(printf '%s\n' "$DEF_NAME" | sed 's/[&/\\]/\\&/g')

  # 3a. manifest.json — precise JSON replacement
  MANIFEST_FAVICON="${CHURCH_FAVICON:-FlockOS_icon.png}"
  jq --arg n "$CHURCH_NAME" --arg s "$CHURCH_SHORT" --arg t "$CHURCH_TAGLINE" \
     --arg f "$MANIFEST_FAVICON" --arg tc "$CHURCH_THEME" --arg bg "$CHURCH_BG" \
     '.name=$n | .short_name=$s | .description=$t | .background_color=$bg | .theme_color=$tc |
      (.icons[].src) |= sub("FlockOS_[A-Za-z_]+\\.png";$f) |
      (.shortcuts[].icons[].src) |= sub("FlockOS_[A-Za-z_]+\\.png";$f)' \
     "$OUT/manifest.json" > "$OUT/manifest.json.tmp" && mv "$OUT/manifest.json.tmp" "$OUT/manifest.json"

  # 3b. HTML/JS — replace database URL, tagline, theme, background
  find "$OUT" \( -name '*.html' -o -name '*.js' \) -type f | while read -r file; do
    sed -i '' \
      -e "s|${ESC_DEF_DB_URL}|${ESC_DB_URL}|g" \
      -e "s|${ESC_DEF_TAGLINE}|${ESC_TAGLINE}|g" \
      -e "s|${ESC_DEF_THEME}|${ESC_THEME}|g" \
      -e "s|${ESC_DEF_BG}|${ESC_BG}|g" \
      "$file"
  done

  # 3b-0. Flock Suite navbar links — substitute per-church FlockChat/ATOG URLs
  # Source templates use placeholder paths "../../FlockChat.html" and "../../ATOG.html".
  # Real deployed pages live at Nations/<church>/FlockOS/Pages/, so target paths
  # need to escape 4 levels up to reach Covenant/Courts/.
  # FlockChat URL gets ?church=<shortname-lower> so it scopes to the right Firestore.
  CHURCH_FLOCKCHAT_URL=$(jq -r '.appLinks.flockchat // empty' "$config")
  CHURCH_ATOG_URL=$(jq -r '.appLinks.atog // empty'           "$config")
  # Fallback to canonical pattern when appLinks not present (API-fetched configs)
  # FlockChat is hosted on Firebase (flockos-comms) — absolute URL avoids broken
  # GitHub Pages relative paths and serves the working PWA shell.
  [ -z "$CHURCH_FLOCKCHAT_URL" ] && CHURCH_FLOCKCHAT_URL="https://flockos-comms.web.app/?church=${CHURCH_SHORT_LOWER}"
  [ -z "$CHURCH_ATOG_URL" ]      && CHURCH_ATOG_URL="../../Courts/TheUpperRoom/ATOG.html?church=${CHURCH_SHORT_LOWER}"
  # Portal-level URLs (for FlockOS.html at Nations/<church>/ root — no depth compensation)
  PORTAL_FC_URL="$CHURCH_FLOCKCHAT_URL"
  PORTAL_AT_URL="$CHURCH_ATOG_URL"
  # Prepend ../../ unless URL is absolute (compensate for Pages/ depth)
  [[ "$CHURCH_FLOCKCHAT_URL" != http* ]] && CHURCH_FLOCKCHAT_URL="../../${CHURCH_FLOCKCHAT_URL}"
  [[ "$CHURCH_ATOG_URL"      != http* ]] && CHURCH_ATOG_URL="../../${CHURCH_ATOG_URL}"
  ESC_FC_URL=$(printf '%s\n' "$CHURCH_FLOCKCHAT_URL" | sed 's/[&/\\]/\\&/g')
  ESC_AT_URL=$(printf '%s\n' "$CHURCH_ATOG_URL"      | sed 's/[&/\\]/\\&/g')
  find "$OUT/FlockOS/Pages" -name '*.html' -type f | while read -r file; do
    sed -i '' \
      -e "s|href=\"\.\./\.\./FlockChat\.html\"|href=\"${ESC_FC_URL}\"|g" \
      -e "s|href=\"\.\./\.\./ATOG\.html\"|href=\"${ESC_AT_URL}\"|g" \
      "$file"
  done

  # Substitute portal-level placeholder URLs in FlockOS.html (Nation root)
  if [ -f "$OUT/FlockOS.html" ]; then
    ESC_PORTAL_FC=$(printf '%s\n' "$PORTAL_FC_URL" | sed 's/[&/\\]/\\&/g')
    ESC_PORTAL_AT=$(printf '%s\n' "$PORTAL_AT_URL" | sed 's/[&/\\]/\\&/g')
    sed -i '' \
      -e "s|href=\"PORTAL_FLOCKCHAT_HREF\"|href=\"${ESC_PORTAL_FC}\"|g" \
      -e "s|href=\"PORTAL_ATOG_HREF\"|href=\"${ESC_PORTAL_AT}\"|g" \
      "$OUT/FlockOS.html"
  fi

  # 3b-iv. Google Analytics — inject church tag or strip root tag
  DEF_ANALYTICS="G-D7V88DPF3T"
  find "$OUT" -name '*.html' -type f | while read -r file; do
    if [ -n "$CHURCH_ANALYTICS" ]; then
      # Replace root tag ID with church-specific tag ID
      sed -i '' \
        -e "s|${DEF_ANALYTICS}|${CHURCH_ANALYTICS}|g" \
        "$file"
    else
      # Strip the entire Google tag block (3 lines: comment + script src + inline script block)
      python3 -c "
import re, sys
content = open(sys.argv[1]).read()
cleaned = re.sub(
  r'\s*<!-- Google tag \(gtag\.js\) -->\s*<script async src=\"https://www\.googletagmanager\.com/gtag/js\?id=[^\"]+\"></script>\s*<script>[\s\S]*?</script>',
  '',
  content
)
open(sys.argv[1], 'w').write(cleaned)
" "$file"
    fi
  done

  # 3b-i. Portrait / logo — replace splash screen img src in FlockOS.html + index.html + the_good_shepherd.html + pages index
  if [ -n "$CHURCH_PORTRAIT" ]; then
    for _portal_f in "$OUT/FlockOS.html" "$OUT/index.html"; do
      [ -f "$_portal_f" ] && sed -i '' \
        -e "s|id=\"church-hero-logo\" class=\"splash-bg\" src=\"FlockOS/Images/[^\"]*\"|id=\"church-hero-logo\" class=\"splash-bg\" src=\"FlockOS/Images/${ESC_PORTRAIT}\"|g" \
        "$_portal_f"
    done
    GS_FILE="$OUT/FlockOS/Pages/the_good_shepherd.html"
    if [ -f "$GS_FILE" ]; then
      sed -i '' \
        -e "s|id=\"church-splash-logo\" class=\"splash-bg\" src=\"\.\./Images/[^\"]*\"|id=\"church-splash-logo\" class=\"splash-bg\" src=\"../Images/${ESC_PORTRAIT}\"|g" \
        "$GS_FILE"
    fi
    PAGES_INDEX="$OUT/FlockOS/Pages/index.html"
    if [ -f "$PAGES_INDEX" ]; then
      sed -i '' \
        -e "s|id=\"church-pages-logo\" class=\"splash-bg\" src=\"\.\./Images/[^\"]*\"|id=\"church-pages-logo\" class=\"splash-bg\" src=\"../Images/${ESC_PORTRAIT}\"|g" \
        "$PAGES_INDEX"
    fi
  fi

  # 3b-ii. Photos URL injection (replace empty PHOTOS_URL constant)
  if [ -n "$CHURCH_PHOTOS_URL" ]; then
    ESC_PHOTOS_URL=$(printf '%s\n' "$CHURCH_PHOTOS_URL" | sed 's/[&/\\]/\\&/g')
    find "$OUT" -name '*.html' -type f | while read -r file; do
      sed -i '' "s|const PHOTOS_URL = '';|const PHOTOS_URL = '${ESC_PHOTOS_URL}';|g" "$file"
    done
  fi

  # 3b-iii. Favicon replacement — all .png icon/logo references across HTML + JS
  if [ -n "$CHURCH_FAVICON" ]; then
    find "$OUT" \( -name '*.html' -o -name '*.js' \) -type f | while read -r file; do
      sed -i '' \
        -e "s|Favicon\.png|${ESC_FAVICON}|g" \
        -e "s|FlockOS_icon\.png|${ESC_FAVICON}|g" \
        -e "s|FlockOS_Camo\.png|${ESC_FAVICON}|g" \
        -e "s|rel=\"icon\" type=\"image/png\" href=\"FlockOS/Images/[^\"]*\"|rel=\"icon\" type=\"image/png\" href=\"FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|rel=\"apple-touch-icon\" href=\"FlockOS/Images/[^\"]*\"|rel=\"apple-touch-icon\" href=\"FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|rel=\"icon\" type=\"image/png\" href=\"\.\./\.\./FlockOS/Images/[^\"]*\"|rel=\"icon\" type=\"image/png\" href=\"../../FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|rel=\"apple-touch-icon\" href=\"\.\./\.\./FlockOS/Images/[^\"]*\"|rel=\"apple-touch-icon\" href=\"../../FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|rel=\"icon\" type=\"image/png\" href=\"\.\./Images/[^\"]*\"|rel=\"icon\" type=\"image/png\" href=\"../Images/${ESC_FAVICON}\"|g" \
        -e "s|rel=\"apple-touch-icon\" href=\"\.\./Images/[^\"]*\"|rel=\"apple-touch-icon\" href=\"../Images/${ESC_FAVICON}\"|g" \
        -e "s|property=\"og:image\" content=\"FlockOS/Images/[^\"]*\"|property=\"og:image\" content=\"FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|property=\"og:image\" content=\"\.\./\.\./FlockOS/Images/[^\"]*\"|property=\"og:image\" content=\"../../FlockOS/Images/${ESC_FAVICON}\"|g" \
        -e "s|property=\"og:image\" content=\"\.\./Images/[^\"]*\"|property=\"og:image\" content=\"../Images/${ESC_FAVICON}\"|g" \
        "$file"
    done
  fi

  # 3b-v. Firebase project override (per-church Firebase config)
  if [ -n "$CHURCH_FB_CONFIG" ] && echo "$CHURCH_FB_CONFIG" | jq -e '.apiKey' &>/dev/null; then
    FB_JSON=$(echo "$CHURCH_FB_CONFIG" | jq -c '.')
    # Inject window.FLOCK_FIREBASE_CONFIG and window.FLOCK_CHURCH_ID into the_upper_room.js
    UR_FILE="$OUT/FlockOS/Scripts/the_upper_room.js"
    if [ -f "$UR_FILE" ]; then
      TMPF=$(mktemp)
      echo "window.FLOCK_FIREBASE_CONFIG = ${FB_JSON};" > "$TMPF"
      if [ -n "$CHURCH_ID" ]; then
        echo "window.FLOCK_CHURCH_ID = \"${CHURCH_ID}\";" >> "$TMPF"
      fi
      cat "$UR_FILE" >> "$TMPF"
      mv "$TMPF" "$UR_FILE"
    fi
  fi

  # 3b-vi. Truth Editor — church deployments edit their OWN Firestore, not flockos-truth
  GS_FILE_TRUTH="$OUT/FlockOS/Pages/the_good_shepherd.html"
  if [ -f "$GS_FILE_TRUTH" ]; then
    sed -i '' 's|<script defer src="../Scripts/the_truth.js"></script>|<script>window.FLOCK_TRUTH_USE_LOCAL = true;</script>\n<script defer src="../Scripts/the_truth.js"></script>|' "$GS_FILE_TRUTH"
  fi

  # 3c. Title/meta replacement — ALL HTML files
  find "$OUT" -name '*.html' -type f | while read -r file; do
    sed -i '' \
      -e "s|<title>${ESC_DEF_NAME}</title>|<title>${ESC_NAME}</title>|g" \
      -e "s|<title>${ESC_DEF_NAME} — Admin</title>|<title>${ESC_NAME} — Admin</title>|g" \
      -e "s|<title>${ESC_DEF_NAME} — The Wall</title>|<title>${ESC_NAME} — The Wall</title>|g" \
      -e "s|og:title\" content=\"${ESC_DEF_NAME}\"|og:title\" content=\"${ESC_NAME}\"|g" \
      "$file"
  done

  # 3d. Brand name replacement — topbar, offline page, lockdown, wall header
  find "$OUT" \( -name '*.html' -o -name '*.js' \) -type f | while read -r file; do
    sed -i '' \
      -e "s#>FlockOS <span>Admin</span>#>${ESC_BRAND} <span>Admin</span>#g" \
      -e "s#title=\"Home\">FlockOS</div>#title=\"Home\">${ESC_BRAND}</div>#g" \
      -e "s#<title>FlockOS — Offline</title>#<title>${ESC_NAME} — Offline</title>#g" \
      -e "s#FlockOS can't reach the server#${ESC_NAME} can't reach the server#g" \
      -e "s#next version of FlockOS#next version of ${ESC_NAME}#g" \
      -e "s#access FlockOS here#access ${ESC_NAME} here#g" \
      -e "s#alt=\"FlockOS\"#alt=\"${ESC_NAME}\"#g" \
      "$file"
  done

  # 3e. Wall page — header, lockdown banner, and logo
  WALL_FILE="$OUT/FlockOS/Pages/the_wall.html"
  if [ -f "$WALL_FILE" ]; then
    sed -i '' \
      -e "s|<h1[^>]*>FlockOS</h1>|<h1 class=\"wall-title\">${ESC_NAME}</h1>|g" \
      -e "s|FlockOS is in maintenance mode|${ESC_NAME} is in maintenance mode|g" \
      -e "s|FlockOS v1.00|${ESC_NAME} v${CHURCH_VERSION:-1.3}|g" \
      "$WALL_FILE"
    if [ -n "$CHURCH_PORTRAIT" ]; then
      sed -i '' \
        -e "s|id=\"wall-logo\" class=\"wall-logo\" src=\"\.\./Images/[^\"]*\"|id=\"wall-logo\" class=\"wall-logo\" src=\"../Images/${ESC_PORTRAIT}\"|g" \
        "$WALL_FILE"
    fi
  fi

  # 3f. Deployment Guide (the_pentecost.html) — inject church-specific DATABASE_URL
  PENTECOST_FILE="$OUT/FlockOS/Pages/the_pentecost.html"
  if [ -f "$PENTECOST_FILE" ]; then
    sed -i '' \
      -e "s|\[YOUR_DATABASE_URL\]|${ESC_DB_URL}|g" \
      -e "s|\[DATABASE_URL\]|${ESC_DB_URL}|g" \
      -e "s|FlockOS &mdash; Deployment &amp; Project Guide|${ESC_NAME} \&mdash; Deployment \&amp; Project Guide|g" \
      -e "s|<title>FlockOS — Deployment &amp; Project Guide</title>|<title>${ESC_NAME} — Deployment \\&amp; Project Guide</title>|g" \
      "$PENTECOST_FILE"
  fi

  # 3g. Value Proposition (fishing-for-men.html) — brand with church name
  FISHING_FILE="$OUT/FlockOS/Pages/fishing-for-men.html"
  if [ -f "$FISHING_FILE" ]; then
    sed -i '' \
      -e "s|FlockOS — Value Proposition|${ESC_NAME} — Value Proposition|g" \
      -e "s|<title>FlockOS — Value Proposition</title>|<title>${ESC_NAME} — Value Proposition</title>|g" \
      -e "s|FlockOS is a full-featured|${ESC_NAME} runs on FlockOS, a full-featured|g" \
      -e "s|FlockOS delivers|${ESC_NAME} delivers|g" \
      -e "s|FlockOS covers|${ESC_NAME} covers|g" \
      -e "s|FlockOS &mdash; Fishing for Men|${ESC_NAME} \&mdash; Value Proposition|g" \
      "$FISHING_FILE"
  fi

  # 3h. About / The Why (About_FlockOS.html) — copied as-is, no branding
  # (This page is the same across all deployments.)

  echo "    → Nations/$CHURCH_SHORT/"
  echo ""
done

echo "======================================================================"
echo "  $CONFIG_COUNT deployment(s) built → Nations/"
echo ""
ls -1 "$CHURCH_DIR" | while read -r d; do
  echo "    Nations/$d/"
done
echo ""
echo "======================================================================"

if $DEPLOY_COMMS; then
  echo ""
  echo "Deploying FlockChat hosting to flockos-comms.web.app…"
  if $DRY_RUN; then
    echo "  [dry-run] Would run: firebase deploy --only hosting --project flockos-comms"
  else
    (
      cd "$WORKSPACE_ROOT"
      firebase deploy --only hosting --project flockos-comms
    )
    echo "  ✓ Deployed to flockos-comms.web.app"
  fi

  # ── Deploy Firestore indexes to each church project ───────────────────
  echo ""
  echo "Deploying Firestore indexes to church projects…"
  INDEXES_FILE="$WORKSPACE_ROOT/firestore.indexes.json"
  if [ ! -f "$INDEXES_FILE" ]; then
    echo "  ✗ MISSING: firestore.indexes.json — skipping index deploy"
  else
    # Collect project IDs from ChurchRegistry (firebaseProjectId field, skip if absent = GAS)
    INDEX_PROJECTS=()
    for _cfg in "$CONFIGS_DIR"/*.json; do
      [[ "$(basename "$_cfg")" == "ChurchTemplate.json" ]] && continue
      [[ "$(basename "$_cfg")" == "Master-API.json" ]] && continue
      _proj=$(jq -r '.firebaseProjectId // empty' "$_cfg")
      [ -z "$_proj" ] && continue
      INDEX_PROJECTS+=("$_proj")
    done

    if [ ${#INDEX_PROJECTS[@]} -eq 0 ]; then
      echo "  ⚠ No firebaseProjectId found in ChurchRegistry — skipping index deploy"
    else
      for _proj in "${INDEX_PROJECTS[@]}"; do
        if $DRY_RUN; then
          echo "  [dry-run] Would run: firebase deploy --only firestore:indexes --project $_proj"
        else
          echo "  → Deploying indexes to ${_proj}…"
          (
            cd "$WORKSPACE_ROOT"
            firebase deploy --only firestore:indexes --project "$_proj" 2>&1
          ) && echo "  ✓ Indexes deployed to $_proj" || echo "  ✗ Index deploy failed for $_proj (check firebase CLI auth)"
        fi
      done
    fi
  fi

  # ── Deploy Firestore rules to each church project ─────────────────────
  echo ""
  echo "Deploying Firestore rules to church projects…"
  _RULES_FILE="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Deployment/Firestore/firestore.rules"
  _CHURCH_CFG="$WORKSPACE_ROOT/church-firestore.json"
  if [ ! -f "$_RULES_FILE" ]; then
    echo "  ✗ MISSING: Deployment/Firestore/firestore.rules — skipping rules deploy"
  else
    RULES_PROJECTS=()
    for _cfg in "$CONFIGS_DIR"/*.json; do
      [[ "$(basename "$_cfg")" == "ChurchTemplate.json" ]] && continue
      [[ "$(basename "$_cfg")" == "Master-API.json" ]] && continue
      _proj=$(jq -r '.firebaseProjectId // empty' "$_cfg")
      [ -z "$_proj" ] && continue
      RULES_PROJECTS+=("$_proj")
    done

    if [ ${#RULES_PROJECTS[@]} -eq 0 ]; then
      echo "  ⚠ No firebaseProjectId found in ChurchRegistry — skipping rules deploy"
    else
      for _proj in "${RULES_PROJECTS[@]}"; do
        if $DRY_RUN; then
          echo "  [dry-run] Would run: firebase deploy --only firestore:rules --config church-firestore.json --project $_proj"
        else
          echo "  → Deploying rules to ${_proj}…"
          (
            cd "$WORKSPACE_ROOT"
            firebase deploy --only firestore:rules --config church-firestore.json --project "$_proj" 2>&1
          ) && echo "  ✓ Rules deployed to $_proj" || echo "  ✗ Rules deploy failed for $_proj (check firebase CLI auth)"
        fi
      done
    fi
  fi
fi

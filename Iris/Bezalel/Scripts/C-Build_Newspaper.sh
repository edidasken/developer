#!/usr/bin/env bash
# ======================================================================
# C-Build_Newspaper.sh — Build The Newspaper for each Nation
#
# Source of truth:  Newspaper/
# Output:           Nations/<Church>/Newspaper/
#
# Per-church patches applied to each copy:
#   • sw.js             → unique CACHE_NAME
#   • manifest.json     → church name / theme branding
#   • index.html        → <title>, window.HERALD_CHURCH_NAME,
#                         window.HERALD_CHURCH_ID,
#                         window.FLOCK_FIREBASE_CONFIG
#   • Sections/*/index.html → same Firebase config injected
#
# Config data read from:
#   Architechtural Docs/New Covenant As Built/Church Registry/<church>.json
#
# Usage:
#   bash Iris/Bezalel/Scripts/C-Build_Newspaper.sh
#   bash Iris/Bezalel/Scripts/C-Build_Newspaper.sh --dry-run
# ======================================================================
set -euo pipefail

# ── Flag parsing ─────────────────────────────────────────────────────
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done
$DRY_RUN && echo "🏗  DRY RUN — no files will be written" && echo ""

# ── Paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Script lives at Iris/Bezalel/Scripts/ → workspace root is 3 levels up
WORKSPACE="$(cd "$SCRIPT_DIR/../../.." && pwd)"
NEWSPAPER="$WORKSPACE/Newspaper"
NATIONS_DIR="$WORKSPACE/Nations"
CONFIGS_DIR="$WORKSPACE/Architechtural Docs/New Covenant As Built/Church Registry"

# ── Dependency check ──────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq"; exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required."; exit 1
fi

# ── Church definitions ────────────────────────────────────────────────
# FORMAT:  "NationsFolder|ConfigFile|CACHE_NAME"
CHURCHES=(
  "Root|FlockOS-Root.json|flock-newspaper-root-v1.0"
  "FlockOS|FlockOS-Root.json|flock-newspaper-flockos-v1.0"
  "TBC|Trinity.json|flock-newspaper-tbc-v1.0"
  "TheForest|TheForest.json|flock-newspaper-theforest-v1.0"
  "GAS|GAS.json|flock-newspaper-gas-v1.0"
)

# ── Pre-flight checks ─────────────────────────────────────────────────
echo "Running pre-flight checks…"
PREFLIGHT_OK=true

[ -d "$NEWSPAPER" ]              || { echo "  ✗ MISSING: Newspaper/";              PREFLIGHT_OK=false; }
[ -f "$NEWSPAPER/index.html" ]   || { echo "  ✗ MISSING: Newspaper/index.html";    PREFLIGHT_OK=false; }
[ -f "$NEWSPAPER/sw.js" ]        || { echo "  ✗ MISSING: Newspaper/sw.js";         PREFLIGHT_OK=false; }
[ -f "$NEWSPAPER/manifest.json" ]|| { echo "  ✗ MISSING: Newspaper/manifest.json"; PREFLIGHT_OK=false; }
[ -f "$NEWSPAPER/Styles/the_broadsheet.css" ] \
  || { echo "  ✗ MISSING: Newspaper/Styles/the_broadsheet.css"; PREFLIGHT_OK=false; }
[ -f "$NEWSPAPER/Scripts/firm_foundation.js" ] \
  || { echo "  ✗ MISSING: Newspaper/Scripts/firm_foundation.js"; PREFLIGHT_OK=false; }

# Verify CACHE_NAME sentinel exists in sw.js (needed for per-church patching)
grep -q "const CACHE_NAME = 'flock-newspaper" "$NEWSPAPER/sw.js" \
  || { echo "  ✗ sw.js missing CACHE_NAME sentinel (must start with flock-newspaper)"; PREFLIGHT_OK=false; }

# Verify Firebase config block sentinel exists in index.html
grep -q "FLOCK_FIREBASE_CONFIG_BLOCK" "$NEWSPAPER/index.html" \
  || { echo "  ✗ index.html missing <!-- FLOCK_FIREBASE_CONFIG_BLOCK --> sentinel"; PREFLIGHT_OK=false; }

# Verify all church configs exist
for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE <<< "$entry"
  CFG="$CONFIGS_DIR/$CONFIG"
  [ -f "$CFG" ] || { echo "  ✗ MISSING config: Church Registry/$CONFIG"; PREFLIGHT_OK=false; }
done

$PREFLIGHT_OK || { echo ""; echo "Pre-flight FAILED. Aborting."; exit 1; }
echo "  ✓ All pre-flight checks passed"
echo ""

# ── Build each Nation ─────────────────────────────────────────────────
mkdir -p "$NATIONS_DIR"

for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE_NAME <<< "$entry"

  CFG="$CONFIGS_DIR/$CONFIG"
  TARGET="$NATIONS_DIR/$FOLDER/Newspaper"

  echo "═══ Building  Nations/$FOLDER/Newspaper  ←  $CONFIG ═══"

  # Read config values
  CHURCH_NAME=$(jq -r '.name'                         "$CFG")
  CHURCH_ID=$(jq -r   '.id'                           "$CFG")
  SHORT_NAME=$(jq -r  '.shortName'                    "$CFG")
  THEME_COLOR=$(jq -r '.themeColor   // "#faf6ed"'    "$CFG")
  BG_COLOR=$(jq -r    '.backgroundColor // "#1a100a"' "$CFG")
  FB_CONFIG_JSON=$(jq -r '.firebaseConfig // "null"'  "$CFG")

  if $DRY_RUN; then
    echo "  [dry] rsync Newspaper/ → Nations/$FOLDER/Newspaper/"
    echo "  [dry] CACHE_NAME:   $CACHE_NAME"
    echo "  [dry] Church:       $CHURCH_NAME ($CHURCH_ID)"
    echo "  [dry] Theme:        $THEME_COLOR on $BG_COLOR"
    echo "  [dry] Firebase:     $([ "$FB_CONFIG_JSON" = 'null' ] && echo 'none (GAS-only)' || echo 'injected')"
    echo ""
    continue
  fi

  # ── Export all env vars BEFORE any python block ───────────────────
  export _NP_TARGET="$TARGET"
  export _NP_CHURCH_NAME="$CHURCH_NAME"
  export _NP_SHORT_NAME="$SHORT_NAME"
  export _NP_THEME_COLOR="$THEME_COLOR"
  export _NP_BG_COLOR="$BG_COLOR"
  export _NP_FOLDER="$FOLDER"
  export _NP_CHURCH_ID="$CHURCH_ID"
  export _NP_FB_CONFIG="$FB_CONFIG_JSON"
  export _NP_CACHE_NAME="$CACHE_NAME"

  # ── 1. rsync Newspaper/ → Nations/<Folder>/Newspaper/ ────────────
  mkdir -p "$TARGET"
  rsync -a --delete \
    --exclude='.DS_Store' \
    --exclude='ThePlan.md' \
    "$NEWSPAPER/" "$TARGET/"
  echo "  ✓ rsync complete"

  # ── 2. Patch sw.js — CACHE_NAME ──────────────────────────────────
  sed -i '' "s|const CACHE_NAME = 'flock-newspaper[^']*'|const CACHE_NAME = '$CACHE_NAME'|" \
    "$TARGET/sw.js"
  echo "  ✓ sw.js CACHE_NAME → $CACHE_NAME"

  # ── 3. Patch manifest.json ────────────────────────────────────────
  python3 << 'PYEOF'
import os, json

target   = os.environ['_NP_TARGET']
path     = target + '/manifest.json'

with open(path, 'r') as f:
    m = json.load(f)

m['name']             = os.environ['_NP_CHURCH_NAME'] + ' — Herald'
m['short_name']       = os.environ['_NP_SHORT_NAME']
m['theme_color']      = os.environ['_NP_THEME_COLOR']
m['background_color'] = os.environ['_NP_BG_COLOR']
m['start_url']        = '/Nations/' + os.environ['_NP_FOLDER'] + '/Newspaper/'

with open(path, 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
print('  ✓ manifest.json patched')
PYEOF

  # ── 4. Patch index.html — title, church identity, Firebase config ─
  python3 << 'PYEOF'
import os, json, re

target      = os.environ['_NP_TARGET']
church_name = os.environ['_NP_CHURCH_NAME']
church_id   = os.environ['_NP_CHURCH_ID']
fb_raw      = os.environ['_NP_FB_CONFIG']
path        = target + '/index.html'

with open(path, 'r') as f:
    content = f.read()

# Patch <title>
content = re.sub(
    r'<title>[^<]*</title>',
    f'<title>{church_name} — Herald</title>',
    content
)

# Build Firebase config script block
try:
    fb_obj = json.loads(fb_raw)
except Exception:
    fb_obj = None

if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
    fb_js = json.dumps(fb_obj, indent=4)
    config_block = (
        f'  <!-- Firebase config: {church_id} -->\n'
        f'  <script>\n'
        f'    window.FLOCK_FIREBASE_CONFIG = {fb_js};\n'
        f'    window.HERALD_CHURCH_NAME = "{church_name}";\n'
        f'    window.HERALD_CHURCH_ID   = "{church_id}";\n'
        f'  </script>'
    )
else:
    config_block = (
        f'  <!-- No Firebase: {church_id} (GAS-only) -->\n'
        f'  <script>\n'
        f'    window.FLOCK_FIREBASE_CONFIG = null;\n'
        f'    window.HERALD_CHURCH_NAME = "{church_name}";\n'
        f'    window.HERALD_CHURCH_ID   = "{church_id}";\n'
        f'  </script>'
    )

# Replace sentinel block
content = re.sub(
    r'<!-- FLOCK_FIREBASE_CONFIG_BLOCK -->.*?<!-- /FLOCK_FIREBASE_CONFIG_BLOCK -->',
    (f'<!-- FLOCK_FIREBASE_CONFIG_BLOCK -->\n'
     f'{config_block}\n'
     f'  <!-- /FLOCK_FIREBASE_CONFIG_BLOCK -->'),
    content,
    flags=re.DOTALL
)

with open(path, 'w') as f:
    f.write(content)
print('  ✓ index.html patched (title + church identity + Firebase config)')
PYEOF

  # ── 5. Patch each Section index.html ─────────────────────────────
  python3 << 'PYEOF'
import os, json
from pathlib import Path

target      = os.environ['_NP_TARGET']
church_name = os.environ['_NP_CHURCH_NAME']
church_id   = os.environ['_NP_CHURCH_ID']
fb_raw      = os.environ['_NP_FB_CONFIG']

try:
    fb_obj = json.loads(fb_raw)
except Exception:
    fb_obj = None

if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
    fb_js = json.dumps(fb_obj, indent=6)
    config_script = (
        f'  <script>\n'
        f'    window.FLOCK_FIREBASE_CONFIG = {fb_js};\n'
        f'    window.HERALD_CHURCH_NAME = "{church_name}";\n'
        f'    window.HERALD_CHURCH_ID   = "{church_id}";\n'
        f'  </script>'
    )
else:
    config_script = (
        f'  <script>\n'
        f'    window.FLOCK_FIREBASE_CONFIG = null;\n'
        f'    window.HERALD_CHURCH_NAME = "{church_name}";\n'
        f'    window.HERALD_CHURCH_ID   = "{church_id}";\n'
        f'  </script>'
    )

sections_root = Path(target) / 'Sections'
patched = 0
for section_html in sorted(sections_root.glob('*/index.html')):
    content = section_html.read_text()
    if 'HERALD_CHURCH_NAME' not in content:
        content = content.replace('<head>', f'<head>\n{config_script}', 1)
        section_html.write_text(content)
        patched += 1

print(f'  ✓ {patched} section HTMLs patched with church identity')
PYEOF

  echo "  ✓ Nations/$FOLDER/Newspaper build complete"
  echo ""

done

echo "════════════════════════════════════════"
echo "  C-Build complete — all nations built"
echo "════════════════════════════════════════"


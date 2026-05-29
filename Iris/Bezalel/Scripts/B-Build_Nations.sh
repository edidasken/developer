#!/usr/bin/env bash
# ======================================================================
# B-Build_Nations.sh — Build New_Covenant for each Nation
#
# Source of truth:  New_Covenant/
# Output:           $NATIONS_REPO_ROOT/<church>/   (standalone repo root)
#
# Per-church patches applied to each copy:
#   • Scripts/the_true_vine.js  → church GAS API endpoints
#   • the_living_water.js (SW)  → unique CACHE_NAME
#   • manifest.json             → church name / branding
#   • index.html                → <title>, window.FLOCK_FIREBASE_CONFIG
#
# Config data read from:  Architechtural Docs/New Covenant As Built/Church Registry/<church>.json
#
# Usage:
#   bash Covenant/Bezalel/Scripts/B-Build_Nations.sh
#   bash Covenant/Bezalel/Scripts/B-Build_Nations.sh --dry-run
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
# Script lives at Covenant/Bezalel/Scripts/ → workspace root is 3 levels up
WORKSPACE="$(cd "$SCRIPT_DIR/../../.." && pwd)"
NEW_COVENANT="$WORKSPACE/New_Covenant"
# Build directly into the in-repo Nations/ output directory.
NATIONS_DIR="$WORKSPACE/Nations"
CONFIGS_DIR="$WORKSPACE/Architechtural Docs/New Covenant As Built/Church Registry"
# Backward-compatible fallback for older docs/paths.
LEGACY_CONFIGS_DIR="$WORKSPACE/Architechtural Docs/New Covenant/Deployment/ChurchRegistry"
if [ ! -d "$CONFIGS_DIR" ] && [ -d "$LEGACY_CONFIGS_DIR" ]; then
  CONFIGS_DIR="$LEGACY_CONFIGS_DIR"
fi

BUILT_TARGETS=()

resolve_nation_repo() {
  case "$1" in
    FlockOS) echo "$NATIONS_DIR/FlockOS" ;;
    Root) echo "$NATIONS_DIR/Root" ;;
    TBC) echo "$NATIONS_DIR/TBC" ;;
    TheForest) echo "$NATIONS_DIR/TheForest" ;;
    GAS) echo "$NATIONS_DIR/GAS" ;;
    *) return 1 ;;
  esac
}

target_already_built() {
  local candidate="$1"
  local item
  for item in "${BUILT_TARGETS[@]-}"; do
    [ "$item" = "$candidate" ] && return 0
  done
  return 1
}

# ── Dependency check ──────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq"; exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required."; exit 1
fi
if [ ! -f "$WORKSPACE/Iris/Bezalel/Scripts/B-Standalone_Repo_Scaffold.sh" ]; then
  echo "ERROR: Missing standalone repo scaffold helper: Iris/Bezalel/Scripts/B-Standalone_Repo_Scaffold.sh"
  exit 1
fi

# ── Church definitions ────────────────────────────────────────────────
# FORMAT:  "FolderName|ConfigFile|CACHE_NAME"
CHURCHES=(
  "Root|FlockOS-Root.json|flockos-root-v1.05"
  "FlockOS|FlockOS-Root.json|flockos-v1.05"
  "TBC|Trinity.json|flockos-tbc-v1.05"
  "TheForest|TheForest.json|flockos-theforest-v1.05"
  "GAS|GAS.json|flockos-gas-v1.05"
)

# ── Pre-flight ────────────────────────────────────────────────────────
echo "Running pre-flight checks…"
PREFLIGHT_OK=true

[ -d "$NEW_COVENANT" ] || { echo "  ✗ MISSING: New_Covenant/"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/index.html" ] || { echo "  ✗ MISSING: New_Covenant/index.html (selector)"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.flockos/app.flockos.html" ] || { echo "  ✗ MISSING: New_Covenant/app.flockos/app.flockos.html (app)"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.flockos/manifest.json" ] || { echo "  ✗ MISSING: New_Covenant/app.flockos/manifest.json"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.grow/app.grow.html" ] || { echo "  ✗ MISSING: New_Covenant/app.grow/app.grow.html"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.grow/manifest.json" ] || { echo "  ✗ MISSING: New_Covenant/app.grow/manifest.json"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/the_living_water.js" ] || { echo "  ✗ MISSING: New_Covenant/the_living_water.js"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/Scripts/the_true_vine.js" ] || { echo "  ✗ MISSING: New_Covenant/Scripts/the_true_vine.js"; PREFLIGHT_OK=false; }

for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE <<< "$entry"
  CFG="$CONFIGS_DIR/$CONFIG"
  [ -f "$CFG" ] || { echo "  ✗ MISSING config: $CFG"; PREFLIGHT_OK=false; }
done

# ── Theme policy check ────────────────────────────────────────────────
# Every New_Covenant/app.*/<entry>.html MUST:
#   1. Run the theme bootstrap script before first paint
#      (sets <html data-theme="…"> from localStorage.flock_theme)
#   2. NOT redeclare core NC theme tokens (--bg, --bg-raised, --ink, --line)
#      in its local :root — those belong to new_covenant.css
echo ""
echo "Running NC theme policy checks…"
THEME_OK=true
APP_HTMLS=$(find "$NEW_COVENANT" -maxdepth 2 -type f -path "*/app.*/*.html" \
              ! -name "embed-*.html" ! -name "index.html" 2>/dev/null)

for html in $APP_HTMLS; do
  rel="${html#$NEW_COVENANT/}"

  # Rule 1: theme bootstrap present
  if ! grep -q "localStorage.getItem('flock_theme')" "$html"; then
    echo "  ✗ THEME POLICY: $rel missing theme bootstrap script"
    echo "      (must read localStorage.flock_theme and set <html data-theme=…> before first paint)"
    THEME_OK=false
  fi

  # Rule 2: no local override of core NC theme tokens in :root
  bad=$(python3 - "$html" << 'PYEOF'
import sys, re
src = open(sys.argv[1]).read()
forbidden = ('--bg:', '--bg-raised:', '--ink:', '--line:')
v = set()
for m in re.finditer(r':root\s*\{([^}]*)\}', src):
    body = m.group(1)
    for t in forbidden:
        if t in body:
            v.add(t.rstrip(':'))
if v:
    print(' '.join(sorted(v)))
PYEOF
)
  if [ -n "$bad" ]; then
    echo "  ✗ THEME POLICY: $rel overrides core NC tokens in :root → $bad"
    echo "      (remove from local :root; let new_covenant.css define them)"
    THEME_OK=false
  fi
done

$THEME_OK && echo "  ✓ NC theme policy: all app HTMLs comply"

$PREFLIGHT_OK && $THEME_OK || { echo ""; echo "Pre-flight FAILED."; exit 1; }
echo "  ✓ All checks passed"
echo ""

# ── Build each Nation ─────────────────────────────────────────────────
mkdir -p "$NATIONS_DIR"

for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE_NAME <<< "$entry"

  CFG="$CONFIGS_DIR/$CONFIG"
  TARGET="$(resolve_nation_repo "$FOLDER")"
  if [ -z "$TARGET" ]; then
    echo "ERROR: No sibling repo target mapped for church '$FOLDER'"
    exit 1
  fi
  if [ ! -d "$TARGET" ]; then
    echo "ERROR: Missing sibling repo target: $TARGET"
    exit 1
  fi
  if target_already_built "$TARGET"; then
    echo "  ↳ Skipping duplicate repo target: $TARGET (church alias: $FOLDER)"
    echo ""
    continue
  fi
  BUILT_TARGETS+=("$TARGET")

  echo "═══ Building  $TARGET  ←  $CONFIG ═══"

  # Read config values
  DB_URL=$(jq -r '.databaseUrl' "$CFG")
  CHURCH_NAME=$(jq -r '.name' "$CFG")
  CHURCH_ID=$(jq -r '.id' "$CFG")
  SHORT_NAME=$(jq -r '.shortName' "$CFG")
  THEME_COLOR=$(jq -r '.themeColor // "#e8a838"' "$CFG")
  BG_COLOR=$(jq -r '.backgroundColor // "#0c1445"' "$CFG")

  if $DRY_RUN; then
    echo "  [dry] rsync New_Covenant → $TARGET/"
    echo "  [dry] GAS URL: $DB_URL"
    echo "  [dry] CACHE_NAME: $CACHE_NAME"
    echo "  [dry] Church: $CHURCH_NAME"
    echo ""
    continue
  fi

  # ── 1. rsync New_Covenant → Nations/<Folder> ──────────────────────
  rsync -a --delete \
    --exclude='.DS_Store' \
    --exclude='Google Sites Embeds/' \
    "$NEW_COVENANT/" "$TARGET/"
  echo "  ✓ rsync complete"

  # ── 2. Patch Scripts/the_true_vine.js — all 4 GAS endpoints ───────
  export _NC_DB_URL="$DB_URL"
  export _NC_TARGET="$TARGET"
  python3 << 'PYEOF'
import os, re

target  = os.environ['_NC_TARGET']
new_url = os.environ['_NC_DB_URL']
vine    = target + '/Scripts/the_true_vine.js'

with open(vine, 'r') as f:
    content = f.read()

# Replace every GAS script.google.com exec URL in the endpoint arrays
content = re.sub(
    r"'https://script\.google\.com/macros/s/[^']+/exec'",
    f"'{new_url}'",
    content
)

with open(vine, 'w') as f:
    f.write(content)
print('  ✓ the_true_vine.js GAS endpoints patched')
PYEOF

  # ── 3. Patch the_living_water.js — CACHE_NAME ─────────────────────
  sed -i '' "s|const CACHE_NAME = '[^']*'|const CACHE_NAME = '$CACHE_NAME'|" \
    "$TARGET/the_living_water.js"
  echo "  ✓ the_living_water.js CACHE_NAME → $CACHE_NAME"

  # ── 4. Patch app.flockos/manifest.json — name / branding ─────────
  export _NC_CHURCH_NAME="$CHURCH_NAME"
  export _NC_CHURCH_ID="$CHURCH_ID"
  export _NC_SHORT_NAME="$SHORT_NAME"
  export _NC_THEME_COLOR="$THEME_COLOR"
  export _NC_BG_COLOR="$BG_COLOR"
  python3 << 'PYEOF'
import os, json

t = os.environ['_NC_TARGET']
path = t + '/app.flockos/manifest.json'

with open(path, 'r') as f:
    m = json.load(f)

m['name']             = os.environ['_NC_CHURCH_NAME']
m['short_name']       = os.environ['_NC_SHORT_NAME']
m['theme_color']      = os.environ['_NC_THEME_COLOR']
m['background_color'] = os.environ['_NC_BG_COLOR']

with open(path, 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
print('  ✓ app.flockos/manifest.json patched')
PYEOF

  # ── 5. Patch app.flockos/app.flockos.html — <title>, apple title, Firebase config ──
  FB_CONFIG_JSON=$(jq -r '.firebaseConfig // "null"' "$CFG")
  export _NC_FB_CONFIG="$FB_CONFIG_JSON"
  GAS_ONLY=$(jq -r '.gasOnly // false' "$CFG")
  export _NC_GAS_ONLY="$GAS_ONLY"
  export _NC_FOLDER="$FOLDER"
  python3 << 'PYEOF'
import os, json, re

t          = os.environ['_NC_TARGET']
name       = os.environ['_NC_CHURCH_NAME']
church_id  = os.environ.get('_NC_CHURCH_ID', '')
fb_raw     = os.environ['_NC_FB_CONFIG']
path       = t + '/app.flockos/app.flockos.html'

with open(path, 'r') as f:
    content = f.read()

# Patch <title>
content = re.sub(r'<title>[^<]*</title>', f'<title>{name}</title>', content)

# Patch apple-mobile-web-app-title
content = re.sub(
    r'(<meta name="apple-mobile-web-app-title" content=")[^"]*(")',
    rf'\g<1>{name}\g<2>',
    content
)

# Inject FLOCK_CHURCH_ID so the_firebase_config.js can enforce project isolation
if church_id and '<head>' in content:
    content = content.replace(
        '<head>',
        f'<head>\n  <script>window.FLOCK_CHURCH_ID = "{church_id}";</script>',
        1
    )

# Handle Firebase config / GAS-only stripping
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'

try:
    fb_obj = json.loads(fb_raw)
except Exception:
    fb_obj = None

if gas_only:
    # GAS-only build — strip ALL Firebase references from app.flockos.html
    # Remove firestore preconnect / dns-prefetch lines
    content = re.sub(r'[ \t]*<link[^>]+firestore\.googleapis\.com[^>]*>\n?', '', content)
    # Remove firebase_config modulepreload
    content = re.sub(r'[ \t]*<link[^>]+the_firebase_config\.js[^>]*>\n?', '', content)
    # Remove window.FLOCK_FIREBASE_CONFIG script block
    content = re.sub(
        r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
        '',
        content,
        flags=re.DOTALL
    )
    # Remove Firebase SDK <script> tags
    content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
    # Inject FLOCK_NO_FIREBASE flag so the_firebase_config.js returns null
    if '<head>' in content:
        content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
    print('  ✓ app.flockos.html Firebase stripped (GAS-only build)')
elif isinstance(fb_obj, dict) and 'projectId' in fb_obj:
    # Church has its own Firebase project — patch the config block
    cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
    for k, v in fb_obj.items():
        cfg_lines.append(f"      {k}:  '{v}',")
    cfg_lines.append('    };')
    new_block = '\n'.join(cfg_lines)
    content = re.sub(
        r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
        new_block,
        content,
        flags=re.DOTALL
    )
    print('  ✓ app.flockos.html Firebase config replaced with church config')
else:
    print('  ✓ app.flockos.html Firebase config kept as default (shared)')

with open(path, 'w') as f:
    f.write(content)
print(f'  ✓ app.flockos.html title → {name}')
PYEOF

  # ── 6. Patch app.grow/app.grow.html — Firebase config for public church info ──
  python3 << 'PYEOF'
import os, json, re

t          = os.environ['_NC_TARGET']
fb_raw     = os.environ['_NC_FB_CONFIG']
gas_only   = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path       = t + '/app.grow/app.grow.html'

if not os.path.exists(path):
    print('  ✓ app.grow/app.grow.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        # GAS-only: strip the FLOCK_FIREBASE_CONFIG block entirely
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '',
            content,
            flags=re.DOTALL
        )
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.grow/app.grow.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None

        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block,
                content,
                flags=re.DOTALL
            )
            print('  ✓ app.grow/app.grow.html Firebase config replaced with church config')
        else:
            print('  ✓ app.grow/app.grow.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 8. Patch app.embeds/embed-flockos.html — Firebase config ────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-flockos.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-flockos.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-flockos.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-flockos.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-flockos.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9. Patch app.embeds/embed-grow.html — Firebase config ────────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-grow.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-grow.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-grow.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-grow.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-grow.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9b. Patch app.embeds/embed-stand.html — Firebase config ──────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-stand.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-stand.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-stand.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-stand.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-stand.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9c. Patch app.embeds/embed-flockshow.html — Firebase config ──────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-flockshow.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-flockshow.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-flockshow.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-flockshow.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-flockshow.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9c2. Patch app.embeds/embed-flockshamar.html — Firebase config ────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-flockshamar.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-flockshamar.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-flockshamar.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-flockshamar.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-flockshamar.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9c3. Patch app.embeds/embed-wellspring.html — Firebase config ──────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-wellspring.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-wellspring.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-wellspring.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-wellspring.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-wellspring.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9c4. Patch app.embeds/embed-invite.html — Firebase config ───────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-invite.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-invite.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-invite.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-invite.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-invite.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9d. Patch app.embeds/embed-launcher.html — church name + base URL ─
  python3 << 'PYEOF'
import os

t      = os.environ['_NC_TARGET']
name   = os.environ['_NC_CHURCH_NAME']
folder = os.path.basename(t)
path   = t + '/app.embeds/embed-launcher.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-launcher.html not present — skip patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    base_url = f'https://edidasken.github.io/developer/Nations/{folder}/'
    content = content.replace('{{CHURCH_NAME}}', name)
    content = content.replace('{{BASE_URL}}', base_url)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.embeds/embed-launcher.html → {name} / {base_url}')
PYEOF

  # ── 9d-ii. Patch app.flockchat/app.flockchat.html — per-church Firebase config ──
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.flockchat/app.flockchat.html'

if not os.path.exists(path):
    print('  ✓ app.flockchat/app.flockchat.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<!--\s*Firebase Config\s*-->\n\s*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.flockchat/app.flockchat.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print(f'  ✓ app.flockchat/app.flockchat.html Firebase config → {fb_obj["projectId"]}')
        else:
            print('  ✓ app.flockchat/app.flockchat.html Firebase config kept as default (flockos-notify)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9e. Patch app.embeds/embed-flockchat.html — iframe src ───────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-flockchat.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-flockchat.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-flockchat.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-flockchat.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-flockchat.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9f. Patch app.embeds/embed-feed.html — Firebase config ─────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-feed.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-feed.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-feed.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-feed.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-feed.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9g. Patch app.feed/feed.html — Firebase config ─────────────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.feed/feed.html'

if not os.path.exists(path):
    print('  ✓ app.feed/feed.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.feed/feed.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.feed/feed.html Firebase config replaced with church config')
        else:
            print('  ✓ app.feed/feed.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9h. Patch app.embeds/embed-melchizedek.html — Firebase config ───
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-melchizedek.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-melchizedek.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-melchizedek.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-melchizedek.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-melchizedek.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9i. Patch app.melchizedek/index.html — Firebase config ─────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.melchizedek/index.html'

if not os.path.exists(path):
    print('  ✓ app.melchizedek/index.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        print('  ✓ app.melchizedek/index.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.melchizedek/index.html Firebase config replaced with church config')
        else:
            print('  ✓ app.melchizedek/index.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9j. Patch app.melchizedek/app.melchizedek.html — Firebase config ───
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.melchizedek/app.melchizedek.html'

if not os.path.exists(path):
    print('  ✓ app.melchizedek/app.melchizedek.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.melchizedek/app.melchizedek.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.melchizedek/app.melchizedek.html Firebase config replaced with church config')
        else:
            print('  ✓ app.melchizedek/app.melchizedek.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9k. Patch app.embeds/embed-multiply.html — Firebase config ───────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-multiply.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-multiply.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*window\.FLOCK_CHURCH_ID[^<]*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.embeds/embed-multiply.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.embeds/embed-multiply.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-multiply.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 10. Patch app.invite/app.invite.html — Firebase config ───────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.invite/app.invite.html'

if not os.path.exists(path):
    print('  ✓ app.invite/app.invite.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ app.invite/app.invite.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None
        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:            '{v}',")
            cfg_lines.append('    };')
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};',
                new_block, content, flags=re.DOTALL)
            print('  ✓ app.invite/app.invite.html Firebase config replaced with church config')
        else:
            print('  ✓ app.invite/app.invite.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 11. Patch app.invite/manifest.json — church name ─────────────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/app.invite/manifest.json'

if not os.path.exists(path):
    print('  ✓ app.invite/manifest.json not present — skip name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.invite/manifest.json name → {name} · The Invitation')
PYEOF

  # ── 11b. Patch app.flockshow/manifest.json — church name ─────────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/app.flockshow/manifest.json'

if not os.path.exists(path):
    print('  ✓ app.flockshow/manifest.json not present — skip name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.flockshow/manifest.json name → {name} · FlockShow')
PYEOF

  # ── 11c. Patch app.feed/manifest.json — church name ──────────────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/app.feed/manifest.json'

if not os.path.exists(path):
    print('  ✓ app.feed/manifest.json not present — skip name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.feed/manifest.json name → {name} · Bread Maker')
PYEOF

  # ── 11d. Patch app.flockchat/manifest.json — church name ─────────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/app.flockchat/manifest.json'

if not os.path.exists(path):
    print('  ✓ app.flockchat/manifest.json not present — skip name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.flockchat/manifest.json name → {name} · FlockChat')
PYEOF

  # ── 11e. Patch app.stand/manifest.json — church name ─────────────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/app.stand/manifest.json'

if not os.path.exists(path):
    print('  ✓ app.stand/manifest.json not present — skip name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.stand/manifest.json name → {name} · Flock Stand')
PYEOF

  # ── 11k. Patch multiply.html — Firebase config + FLOCK_CHURCH_ID ────
  python3 << 'PYEOF'
import os, json, re

t          = os.environ['_NC_TARGET']
fb_raw     = os.environ['_NC_FB_CONFIG']
church_id  = os.environ.get('_NC_CHURCH_ID', '')
gas_only   = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path       = t + '/app.multiply/multiply.html'

if not os.path.exists(path):
    print('  ✓ multiply.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*window\.FLOCK_CHURCH_ID[^<]*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ multiply.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None

        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            cfg_lines.append(f"    window.FLOCK_CHURCH_ID = '{church_id or 'root'}';")
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*\n\s*window\.FLOCK_CHURCH_ID\s*=[^;]+;',
                new_block, content, flags=re.DOTALL)
            print(f'  ✓ multiply.html Firebase config → {fb_obj["projectId"]} / church {church_id or "root"}')
        else:
            print('  ✓ multiply.html Firebase config kept as default (flockos-notify)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 11l. Patch flocknews-editor.html — Firebase config + FLOCK_CHURCH_ID ──
  python3 << 'PYEOF'
import os, json, re

t          = os.environ['_NC_TARGET']
fb_raw     = os.environ['_NC_FB_CONFIG']
church_id  = os.environ.get('_NC_CHURCH_ID', '')
gas_only   = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path       = t + '/app.flocknews/flocknews-editor.html'

if not os.path.exists(path):
    print('  ✓ flocknews-editor.html not present — skip Firebase patch')
else:
    with open(path, 'r') as f:
        content = f.read()

    if gas_only:
        content = re.sub(
            r'[ \t]*<script>\s*window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*window\.FLOCK_CHURCH_ID[^<]*</script>\n?',
            '', content, flags=re.DOTALL)
        content = re.sub(r'[ \t]*<script[^>]+gstatic\.com/firebasejs[^>]*></script>\n?', '', content)
        if '<head>' in content:
            content = content.replace('<head>', '<head>\n  <script>window.FLOCK_NO_FIREBASE = true;</script>', 1)
        print('  ✓ flocknews-editor.html Firebase stripped (GAS-only build)')
    else:
        try:
            fb_obj = json.loads(fb_raw)
        except Exception:
            fb_obj = None

        if isinstance(fb_obj, dict) and 'projectId' in fb_obj:
            cfg_lines = ['    window.FLOCK_FIREBASE_CONFIG = {']
            for k, v in fb_obj.items():
                cfg_lines.append(f"      {k}:  '{v}',")
            cfg_lines.append('    };')
            cfg_lines.append(f"    window.FLOCK_CHURCH_ID = '{church_id or 'root'}';")
            new_block = '\n'.join(cfg_lines)
            content = re.sub(
                r'window\.FLOCK_FIREBASE_CONFIG\s*=\s*\{[^}]+\};\s*\n\s*window\.FLOCK_CHURCH_ID\s*=[^;]+;',
                new_block, content, flags=re.DOTALL)
            print(f'  ✓ flocknews-editor.html Firebase config → {fb_obj["projectId"]} / church {church_id or "root"}')
        else:
            print('  ✓ flocknews-editor.html Firebase config kept as default (flockos-notify)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 11m. Patch app.flocknews/flocknews.html — replace {{CHURCH_NAME}} + {{CHURCH_WEBSITE}} ──
  CHURCH_WEBSITE=$(jq -r '.website // "flock-os.github.io"' "$CFG")
  export _NC_CHURCH_WEBSITE="$CHURCH_WEBSITE"
  python3 << 'PYEOF'
import os

t       = os.environ['_NC_TARGET']
name    = os.environ['_NC_CHURCH_NAME']
website = os.environ['_NC_CHURCH_WEBSITE']
path    = t + '/app.flocknews/flocknews.html'

if not os.path.exists(path):
    print('  ✓ flocknews.html not present — skip church name patch')
else:
    with open(path, 'r') as f:
        content = f.read()
    content = content.replace('{{CHURCH_NAME}}', name)
    content = content.replace('{{CHURCH_WEBSITE}}', website)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ flocknews.html church name → {name} · website → {website}')
PYEOF

  # ── 12. Patch index.html selector — replace {{CHURCH_NAME}} ────────
  python3 << 'PYEOF'
import os

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
path = t + '/index.html'

with open(path, 'r') as f:
    content = f.read()

content = content.replace('{{CHURCH_NAME}}', name)

with open(path, 'w') as f:
    f.write(content)
print(f'  ✓ index.html selector → {name}')
PYEOF

  # ── 13. Patch launcher manifest.json — name / branding ────────────
  python3 << 'PYEOF'
import os, json

t    = os.environ['_NC_TARGET']
name = os.environ['_NC_CHURCH_NAME']
tc   = os.environ['_NC_THEME_COLOR']
bc   = os.environ['_NC_BG_COLOR']
path = t + '/manifest.json'

if not os.path.exists(path):
    print('  ✓ launcher manifest.json not present — skip')
else:
    with open(path, 'r') as f:
        m = json.load(f)
    m['name']             = name
    m['short_name']       = name
    m['theme_color']      = tc
    m['background_color'] = bc
    with open(path, 'w') as f:
        json.dump(m, f, indent=2)
        f.write('\n')
    print(f'  ✓ launcher manifest.json → {name}')
PYEOF

  bash "$WORKSPACE/Iris/Bezalel/Scripts/B-Standalone_Repo_Scaffold.sh" "$TARGET" "$CHURCH_NAME" "$SHORT_NAME"
  echo "  ✓ Nations/$FOLDER complete"
  echo ""
done

echo "══════════════════════════════════════════════"
echo "Nations build complete:"
for target in "${BUILT_TARGETS[@]}"; do
  echo "  ${target}/"
done
echo ""

# ── Check seed_database.json freshness ────────────────────────────────
# Alert if source data files are newer than seed_database.json
if ! $DRY_RUN; then
  SEED_DB="$WORKSPACE/New_Covenant/Data/seed_database.json"
  SOURCE_FILES=(
    "$WORKSPACE/New_Covenant/Data/strongs-greek.js"
    "$WORKSPACE/New_Covenant/Data/strongs-hebrew.js"
    "$WORKSPACE/New_Covenant/Data/teaching_plans.js"
  )
  
  if [ -f "$SEED_DB" ]; then
    SEED_DB_TIME=$(stat -f %m "$SEED_DB" 2>/dev/null || stat -c %Y "$SEED_DB" 2>/dev/null)
    NEEDS_UPDATE=false
    
    for SOURCE in "${SOURCE_FILES[@]}"; do
      if [ -f "$SOURCE" ]; then
        SOURCE_TIME=$(stat -f %m "$SOURCE" 2>/dev/null || stat -c %Y "$SOURCE" 2>/dev/null)
        if [ "$SOURCE_TIME" -gt "$SEED_DB_TIME" ]; then
          NEEDS_UPDATE=true
          break
        fi
      fi
    done
    
    if [ "$NEEDS_UPDATE" = true ]; then
      echo "⚠️  NOTICE: Source data files are newer than seed_database.json"
      echo "   Run: python3 Iris/Shepherds/Build/update_seed_database.py"
      echo ""
    fi
  fi
fi

# ── Firebase Deployments ──────────────────────────────────────────────
# Deploy Firestore rules and FlockChat hosting
echo "══════════════════════════════════════════════"
echo "Deploying Firebase rules + hosting…"
echo ""

if ! $DRY_RUN; then
  # Church Rules → truth, trinity, theforest, notify
  CHURCH_RULES="$WORKSPACE/church.firestore.rules"
  FLOCKCHAT_RULES="$WORKSPACE/FlockChat.Firestore.Rules"
  CHURCH_CONFIG="$WORKSPACE/config/firebase-church.json"

  if [ -f "$CHURCH_RULES" ] && [ -f "$CHURCH_CONFIG" ]; then
    echo "Deploying comprehensive church rules…"
    for PROJECT in flockos-truth flockos-trinity flockos-theforest flockos-notify; do
      echo "  → $PROJECT"
      firebase deploy --only firestore:rules,firestore:indexes --project "$PROJECT" --config "$CHURCH_CONFIG" --non-interactive 2>&1 | grep -E "Deploy complete|Error" || true
    done
    echo "  ✓ Church rules deployed"
  else
    echo "  ⚠  church.firestore.rules or config/firebase-church.json not found — skipping church deployments"
  fi

  echo ""

  # FlockChat Rules + Hosting → comms
  if [ -f "$FLOCKCHAT_RULES" ]; then
    echo "Deploying standalone FlockChat rules + hosting…"
    echo "  → flockos-comms (rules + hosting)"
    firebase deploy --only firestore:rules,hosting --project flockos-comms --non-interactive 2>&1 | grep -E "Deploy complete|Error" || true
    echo "  ✓ FlockChat deployed"
  else
    echo "  ⚠  FlockChat.Firestore.Rules not found — skipping comms deployment"
  fi

  echo ""
  echo "══════════════════════════════════════════════"
fi

# ── Seed build event → flockos-notify Firestore /milestones ──────────
# Records this build in The Generations (church build log).
# Non-fatal: if gcloud isn't authenticated the build still succeeds.
if ! $DRY_RUN; then
  SEED_SCRIPT="$SCRIPT_DIR/../../Shepherds/Build/seed_build_event.py"
  if [ -f "$SEED_SCRIPT" ]; then
    # Capture last git commit subject + hash for the log entry
    GIT_SUBJECT=$(git -C "$WORKSPACE" log -1 --pretty=format:'%s' 2>/dev/null || echo "B-Build")
    GIT_HASH=$(git -C "$WORKSPACE" log -1 --pretty=format:'%h' 2>/dev/null || echo "")
    BUILD_DATE=$(date +%Y-%m-%d)
    BUILD_TITLE="Build: ${GIT_SUBJECT}"
    BUILD_DESC="B-Build completed on ${BUILD_DATE}. Nations synced: Root, FlockOS, TBC, TheForest, GAS. Commit: ${GIT_HASH}. ${GIT_SUBJECT}"

    python3 "$SEED_SCRIPT" \
      --title "$BUILD_TITLE" \
      --description "$BUILD_DESC" \
      --category "build" \
      --date "$BUILD_DATE" \
      || true  # never fail the build
  fi
fi

# ── Push the three church Nation repos ───────────────────────────────
if ! $DRY_RUN; then
  echo "══════════════════════════════════════════════"
  echo "Pushing church Nation repos…"
  echo ""
  PUSHED_ANY=false
  for TARGET in "${BUILT_TARGETS[@]}"; do
    REPO_NAME="$(basename "$TARGET")"
    echo "  → ${REPO_NAME}"
    if [ -d "$TARGET/.git" ]; then
      git -C "$TARGET" push -u origin main
      PUSHED_ANY=true
    else
      echo "  ⚠ skipping push for $REPO_NAME — not a git repository"
    fi
  done
  $PUSHED_ANY && echo "  ✓ Church Nation repos pushed" || echo "  ⚠ no git repos were available to push"
  echo ""
fi

echo "Next: commit + push to deploy via GitHub Pages / Firebase."

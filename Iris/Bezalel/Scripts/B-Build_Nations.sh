#!/usr/bin/env bash
# ======================================================================
# B-Build_Nations.sh — Build New_Covenant for each Nation
#
# Source of truth:  New_Covenant/
# Output:           Nations/<church>/   (repo root)
#
# Per-church patches applied to each copy:
#   • Scripts/the_true_vine.js  → church GAS API endpoints
#   • the_living_water.js (SW)  → unique CACHE_NAME
#   • manifest.json             → church name / branding
#   • index.html                → <title>, window.FLOCK_FIREBASE_CONFIG
#
# Config data read from:  Covenant/Scrolls/ChurchRegistry/<church>.json
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
NATIONS_DIR="$WORKSPACE/Nations"
CONFIGS_DIR="$WORKSPACE/Covenant/Scrolls/ChurchRegistry"

# ── Dependency check ──────────────────────────────────────────────────
if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: brew install jq"; exit 1
fi
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required."; exit 1
fi

# ── Church definitions ────────────────────────────────────────────────
# FORMAT:  "FolderName|ConfigFile|CACHE_NAME"
CHURCHES=(
  "Root|FlockOS-Root.json|flockos-root-v1.01"
  "FlockOS|FlockOS-Root.json|flockos-v1.01"
  "TBC|Trinity.json|flockos-tbc-v1.01"
  "TheForest|TheForest.json|flockos-theforest-v1.01"
  "GAS|GAS.json|flockos-gas-v1.01"
)

# ── Pre-flight ────────────────────────────────────────────────────────
echo "Running pre-flight checks…"
PREFLIGHT_OK=true

[ -d "$NEW_COVENANT" ] || { echo "  ✗ MISSING: New_Covenant/"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/index.html" ] || { echo "  ✗ MISSING: New_Covenant/index.html (selector)"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.flockos/app.flockos.html" ] || { echo "  ✗ MISSING: New_Covenant/app.flockos/app.flockos.html (app)"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.flockos/manifest.json" ] || { echo "  ✗ MISSING: New_Covenant/app.flockos/manifest.json"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.grow/app.grow.html" ] || { echo "  ✗ MISSING: New_Covenant/app.grow/app.grow.html"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/app.grow/grow-manifest.json" ] || { echo "  ✗ MISSING: New_Covenant/app.grow/grow-manifest.json"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/the_living_water.js" ] || { echo "  ✗ MISSING: New_Covenant/the_living_water.js"; PREFLIGHT_OK=false; }
[ -f "$NEW_COVENANT/Scripts/the_true_vine.js" ] || { echo "  ✗ MISSING: New_Covenant/Scripts/the_true_vine.js"; PREFLIGHT_OK=false; }

for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE <<< "$entry"
  CFG="$CONFIGS_DIR/$CONFIG"
  [ -f "$CFG" ] || { echo "  ✗ MISSING config: $CFG"; PREFLIGHT_OK=false; }
done

$PREFLIGHT_OK || { echo ""; echo "Pre-flight FAILED."; exit 1; }
echo "  ✓ All checks passed"
echo ""

# ── Build each Nation ─────────────────────────────────────────────────
mkdir -p "$NATIONS_DIR"

for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE_NAME <<< "$entry"

  CFG="$CONFIGS_DIR/$CONFIG"
  TARGET="$NATIONS_DIR/$FOLDER"

  echo "═══ Building  Nations/$FOLDER  ←  $CONFIG ═══"

  # Read config values
  DB_URL=$(jq -r '.databaseUrl' "$CFG")
  CHURCH_NAME=$(jq -r '.name' "$CFG")
  CHURCH_ID=$(jq -r '.id' "$CFG")
  SHORT_NAME=$(jq -r '.shortName' "$CFG")
  THEME_COLOR=$(jq -r '.themeColor // "#e8a838"' "$CFG")
  BG_COLOR=$(jq -r '.backgroundColor // "#0c1445"' "$CFG")

  if $DRY_RUN; then
    echo "  [dry] rsync New_Covenant → Nations/$FOLDER"
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
    base_url = f'https://flock-os.github.io/FlockOS/Nations/{folder}/'
    content = content.replace('{{CHURCH_NAME}}', name)
    content = content.replace('{{BASE_URL}}', base_url)
    with open(path, 'w') as f:
        f.write(content)
    print(f'  ✓ app.embeds/embed-launcher.html → {name} / {base_url}')
PYEOF

  # ── 9e. Patch app.embeds/embed-flockchat.html — Firebase config ──────
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

  # ── 9f. Patch app.embeds/embed-breadmaker.html — Firebase config ─────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.embeds/embed-breadmaker.html'

if not os.path.exists(path):
    print('  ✓ app.embeds/embed-breadmaker.html not present — skip Firebase patch')
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
        print('  ✓ app.embeds/embed-breadmaker.html Firebase stripped (GAS-only build)')
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
            print('  ✓ app.embeds/embed-breadmaker.html Firebase config replaced with church config')
        else:
            print('  ✓ app.embeds/embed-breadmaker.html Firebase config kept as default (shared)')

    with open(path, 'w') as f:
        f.write(content)
PYEOF

  # ── 9g. Patch app.feed/bread_maker.html — Firebase config ────────────
  python3 << 'PYEOF'
import os, json, re

t        = os.environ['_NC_TARGET']
fb_raw   = os.environ['_NC_FB_CONFIG']
gas_only = os.environ.get('_NC_GAS_ONLY', 'false').strip().lower() == 'true'
path     = t + '/app.feed/bread_maker.html'

if not os.path.exists(path):
    print('  ✓ app.feed/bread_maker.html not present — skip Firebase patch')
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
        print('  ✓ app.feed/bread_maker.html Firebase stripped (GAS-only build)')
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
            print('  ✓ app.feed/bread_maker.html Firebase config replaced with church config')
        else:
            print('  ✓ app.feed/bread_maker.html Firebase config kept as default (shared)')

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

  echo "  ✓ Nations/$FOLDER complete"
  echo ""
done

echo "══════════════════════════════════════════════"
echo "Nations build complete:"
for entry in "${CHURCHES[@]}"; do
  IFS='|' read -r FOLDER CONFIG CACHE <<< "$entry"
  echo "  Nations/$FOLDER/"
done
echo ""

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

echo "Next: commit + push to deploy via GitHub Pages / Firebase."

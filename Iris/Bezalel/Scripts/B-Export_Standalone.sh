#!/usr/bin/env bash
# ======================================================================
# B-Export_Standalone.sh — Export built Nations into standalone copies.
#
# Source of truth for export payload:   $SOURCE_ROOT/<Nation>/
# Standalone repo roots:               /Users/greg.granger/Desktop/Deployments/{build,flockos,trinity,theforest,offline}
#
# What this does:
#   1. Copies each built Nation folder out of the repo's Nations/ build output
#   2. Re-scaffolds the destination so it can act as its own repository root
#   3. Verifies the exported copy contains the runtime entrypoints expected
#
# Usage:
#   bash Iris/Bezalel/Scripts/B-Export_Standalone.sh
#   bash Iris/Bezalel/Scripts/B-Export_Standalone.sh --dry-run
#   bash Iris/Bezalel/Scripts/B-Export_Standalone.sh --force
#   bash Iris/Bezalel/Scripts/B-Export_Standalone.sh --source /path/to/Nations --target-root /path/to/output
# ======================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_ROOT="$WORKSPACE/Nations"
DEFAULT_TARGET_ROOT="/Users/greg.granger/Desktop/Deployments"
TARGET_ROOT="$DEFAULT_TARGET_ROOT"
DRY_RUN=false
FORCE=false

usage() {
  cat <<'EOF'
Usage:
  bash Iris/Bezalel/Scripts/B-Export_Standalone.sh [--dry-run] [--force] [--source PATH] [--target-root PATH]

Options:
  --dry-run         Show what would be exported without writing files
  --force           Resync existing destination folders in place
  --source PATH     Built Nations source root (default: repo/Nations)
  --target-root PATH Export destination base (default: /Users/greg.granger/Desktop/Deployments)
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --source)
      [ $# -ge 2 ] || { echo "ERROR: --source requires a path"; exit 1; }
      SOURCE_ROOT="$2"
      shift 2
      ;;
    --target-root)
      [ $# -ge 2 ] || { echo "ERROR: --target-root requires a path"; exit 1; }
      TARGET_ROOT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "ERROR: Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

SCaffold_HELPER="$SCRIPT_DIR/B-Standalone_Repo_Scaffold.sh"

if [ ! -d "$SOURCE_ROOT" ]; then
  echo "ERROR: Source Nations folder not found: $SOURCE_ROOT"
  exit 1
fi

if [ ! -f "$SCaffold_HELPER" ]; then
  echo "ERROR: Missing standalone scaffold helper: $SCaffold_HELPER"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "ERROR: rsync is required."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required."
  exit 1
fi

if [ "$DRY_RUN" = false ]; then
  mkdir -p "$TARGET_ROOT"
fi

target_repo_name_for_nation() {
  case "$1" in
    Root) echo "build" ;;
    FlockOS) echo "flockos" ;;
    TBC) echo "trinity" ;;
    TheForest) echo "theforest" ;;
    GAS) echo "offline" ;;
    *) return 1 ;;
  esac
}

church_name_for_nation() {
  case "$1" in
    Root|FlockOS) echo "FlockOS" ;;
    TBC) echo "Trinity Baptist Church" ;;
    TheForest) echo "The Forest" ;;
    GAS) echo "FlockOS-GAS" ;;
    *) echo "$1" ;;
  esac
}

cleanup_copy_artifacts() {
  local dir="$1"
  local artifact_count

  artifact_count="$(find "$dir" -depth \( -name '* 2' -o -name '* 2.*' \) -print | wc -l | tr -d ' ')"
  if [ "${artifact_count:-0}" -gt 0 ]; then
    find "$dir" -depth \( -name '* 2' -o -name '* 2.*' \) -exec rm -rf {} +
    echo "  ✓ removed ${artifact_count} copy artifact(s)"
  fi
}

echo "Exporting standalone Nations"
echo "  source: $SOURCE_ROOT"
echo "  target: $TARGET_ROOT"
echo "  mode:   $([ "$DRY_RUN" = true ] && echo DRY-RUN || echo LIVE)"
echo ""

is_exportable_nation() {
  local dir="$1"
  [ -d "$dir" ] || return 1
  [ -f "$dir/index.html" ] || [ -f "$dir/FlockOS.html" ] || [ -f "$dir/the_living_water.js" ]
}

validate_export() {
  local nation_dir="$1"
  local errors=0

  for required in index.html manifest.json the_living_water.js package.json README.md .gitignore; do
    if [ ! -f "$nation_dir/$required" ]; then
      echo "  ✗ missing $required"
      errors=$((errors + 1))
    fi
  done

  for required_dir in Scripts Styles Views Data Images app.embeds; do
    if [ ! -d "$nation_dir/$required_dir" ]; then
      echo "  ✗ missing $required_dir/"
      errors=$((errors + 1))
    fi
  done

  if [ ! -d "$nation_dir/app.flockos" ]; then
    echo "  ✗ missing app.flockos/"
    errors=$((errors + 1))
  fi

  if [ ! -d "$nation_dir/app.grow" ]; then
    echo "  ✗ missing app.grow/"
    errors=$((errors + 1))
  fi

  if [ ! -d "$nation_dir/app.stand" ]; then
    echo "  ✗ missing app.stand/"
    errors=$((errors + 1))
  fi

  return $errors
}

NATION_DIRS=()
while IFS= read -r dir; do
  [ -n "$dir" ] && NATION_DIRS+=("$dir")
done < <(find "$SOURCE_ROOT" -mindepth 1 -maxdepth 1 -type d | sort)

if [ "${#NATION_DIRS[@]}" -eq 0 ]; then
  echo "ERROR: No Nation folders found under $SOURCE_ROOT"
  exit 1
fi

exported=()
failed=()

for source_dir in "${NATION_DIRS[@]}"; do
  nation_name="$(basename "$source_dir")"

  if ! is_exportable_nation "$source_dir"; then
    echo "Skipping non-Nation directory: $nation_name"
    continue
  fi

  target_repo_name="$(target_repo_name_for_nation "$nation_name")" || {
    echo "Skipping unmapped Nation directory: $nation_name"
    continue
  }

  church_name="$(church_name_for_nation "$nation_name")"
  target_dir="$TARGET_ROOT/$target_repo_name"

  echo "→ $nation_name"
  echo "  target repo: $target_repo_name"

  if $DRY_RUN; then
    echo "  [dry-run] would export to $target_dir"
    echo ""
    exported+=("$nation_name")
    continue
  fi

  mkdir -p "$target_dir"

  rsync -a --delete \
    --exclude='.git/' \
    --exclude='.git' \
    --exclude='node_modules/' \
    --exclude='www/' \
    --exclude='.DS_Store' \
    "$source_dir/" "$target_dir/"

  cleanup_copy_artifacts "$target_dir"

  bash "$SCaffold_HELPER" "$target_dir" "$church_name" "$target_repo_name" "$source_dir"

  echo "  validating…"
  if validate_export "$target_dir"; then
    echo "  ✓ exported"
    exported+=("$nation_name")
  else
    echo "  ✗ validation failed"
    failed+=("$nation_name")
  fi
  echo ""
done

echo "Export summary"
echo "  exported: ${#exported[@]}"
if [ "${#exported[@]}" -gt 0 ]; then
  printf '    - %s\n' "${exported[@]}"
fi

if [ "${#failed[@]}" -gt 0 ]; then
  echo "  failed: ${#failed[@]}"
  printf '    - %s\n' "${failed[@]}"
  exit 1
fi

echo ""
echo "Standalone export complete."
echo "Output root: $TARGET_ROOT"

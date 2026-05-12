#!/usr/bin/env bash
# ======================================================================
# Snapshot.sh — Manual incremental backup of the FlockOS Software repo.
#
# Creates a timestamped, fully-browsable copy at:
#   /Users/greg.granger/Desktop/FlockOS/Storehouse/Snapshot-DD-MM-YYYY HHMMSS/
#
# Uses rsync --link-dest against the previous snapshot, so unchanged files
# are hardlinked (near-zero extra disk per snapshot) while each snapshot
# remains a complete, independent copy you can browse or restore from.
#
# Usage:
#   bash Covenant/Testimony/Runbooks/Snapshot.sh           # take a snapshot
#   bash Covenant/Testimony/Runbooks/Snapshot.sh --dry-run # preview only
#   bash Covenant/Testimony/Runbooks/Snapshot.sh --list    # list snapshots
#   bash Covenant/Testimony/Runbooks/Snapshot.sh --prune N # keep newest N
# ======================================================================
set -euo pipefail

# ── Resolve repo root (Software/) and Storehouse destination ──────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"              # .../FlockOS/Software
STOREHOUSE="$(cd "$REPO_ROOT/.." && pwd)/Storehouse"      # .../FlockOS/Storehouse

# ── Flags ─────────────────────────────────────────────────────────────
DRY_RUN=false
LIST_ONLY=false
PRUNE_KEEP=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --list)    LIST_ONLY=true; shift ;;
    --prune)   PRUNE_KEEP="${2:-}"; shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) echo "Unknown flag: $1"; exit 1 ;;
  esac
done

# ── Dependencies ──────────────────────────────────────────────────────
command -v rsync >/dev/null || { echo "ERROR: rsync required"; exit 1; }

# ── List mode ─────────────────────────────────────────────────────────
if $LIST_ONLY; then
  if [ ! -d "$STOREHOUSE" ]; then
    echo "(no Storehouse yet at $STOREHOUSE)"
    exit 0
  fi
  echo "Snapshots in $STOREHOUSE:"
  find "$STOREHOUSE" -maxdepth 1 -type d -name 'Snapshot-*' -print0 \
    | sort -z | while IFS= read -r -d '' d; do
      sz=$(du -sh "$d" 2>/dev/null | awk '{print $1}')
      printf "  %s  (%s)\n" "$(basename "$d")" "$sz"
    done
  exit 0
fi

# ── Prune mode ────────────────────────────────────────────────────────
if [ -n "$PRUNE_KEEP" ]; then
  if ! [[ "$PRUNE_KEEP" =~ ^[0-9]+$ ]] || [ "$PRUNE_KEEP" -lt 1 ]; then
    echo "ERROR: --prune requires a positive integer"; exit 1
  fi
  # Sort by mtime (oldest first) so prune removes truly oldest regardless of filename format
  mapfile -t SNAPS < <(find "$STOREHOUSE" -maxdepth 1 -type d -name 'Snapshot-*' -print0 \
    | xargs -0 stat -f '%m %N' 2>/dev/null \
    | sort -n | awk '{ $1=""; sub(/^ /, ""); print }')
  TOTAL=${#SNAPS[@]}
  if [ "$TOTAL" -le "$PRUNE_KEEP" ]; then
    echo "Nothing to prune ($TOTAL snapshot(s), keeping $PRUNE_KEEP)."
    exit 0
  fi
  REMOVE_COUNT=$((TOTAL - PRUNE_KEEP))
  echo "Pruning $REMOVE_COUNT old snapshot(s), keeping newest $PRUNE_KEEP…"
  for ((i=0; i<REMOVE_COUNT; i++)); do
    target="${SNAPS[$i]}"
    if $DRY_RUN; then
      echo "  [dry-run] rm -rf $target"
    else
      echo "  rm -rf $(basename "$target")"
      rm -rf "$target"
    fi
  done
  exit 0
fi

# ── Snapshot mode ─────────────────────────────────────────────────────
mkdir -p "$STOREHOUSE"
TS="$(date '+%d-%m-%Y %H%M%S')"
DEST="$STOREHOUSE/Snapshot-$TS"

# Capture git HEAD (if available) for the manifest
GIT_HEAD=""
GIT_BRANCH=""
GIT_DIRTY=""
if command -v git >/dev/null && git -C "$REPO_ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  GIT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo '')"
  GIT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
  if ! git -C "$REPO_ROOT" diff --quiet 2>/dev/null || ! git -C "$REPO_ROOT" diff --cached --quiet 2>/dev/null; then
    GIT_DIRTY="yes"
  else
    GIT_DIRTY="no"
  fi
fi

# Excludes: ephemeral / regenerable / OS noise. .git IS preserved (needed for full restore).
EXCLUDES=(
  --exclude='.DS_Store'
  --exclude='node_modules/'
  --exclude='.venv/'
  --exclude='venv/'
  --exclude='__pycache__/'
  --exclude='*.pyc'
  --exclude='.next/'
  --exclude='dist/'
  --exclude='build/'
  --exclude='.cache/'
  --exclude='.parcel-cache/'
  --exclude='*.log'
)

# Find the previous snapshot by mtime (newest existing Snapshot-* directory)
LINK_DEST_ARG=()
ABS_PREV=""
if [ -d "$STOREHOUSE" ]; then
  ABS_PREV="$(find "$STOREHOUSE" -maxdepth 1 -type d -name 'Snapshot-*' -print0 2>/dev/null \
    | xargs -0 stat -f '%m %N' 2>/dev/null \
    | sort -nr | head -n 1 | awk '{ $1=""; sub(/^ /, ""); print }')"
fi
if [ -n "$ABS_PREV" ] && [ -d "$ABS_PREV" ]; then
  LINK_DEST_ARG=(--link-dest="$ABS_PREV")
  echo "Incremental from: $(basename "$ABS_PREV")"
fi

echo "Snapshot source : $REPO_ROOT"
echo "Snapshot dest   : $DEST"
[ -n "$GIT_HEAD" ] && echo "Git HEAD        : $GIT_BRANCH @ ${GIT_HEAD:0:12} (dirty=$GIT_DIRTY)"

RSYNC_FLAGS=(-a --delete)
if $DRY_RUN; then
  RSYNC_FLAGS+=(--dry-run --stats)
  echo "(dry-run — no files will be copied)"
fi

rsync "${RSYNC_FLAGS[@]}" "${EXCLUDES[@]}" ${LINK_DEST_ARG[@]+"${LINK_DEST_ARG[@]}"} \
  "$REPO_ROOT/" "$DEST/"

if $DRY_RUN; then
  echo "Dry-run complete."
  exit 0
fi

# Write manifest
{
  echo "Snapshot:    $(basename "$DEST")"
  echo "Created:     $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Source:      $REPO_ROOT"
  echo "Host:        $(hostname)"
  echo "User:        $(id -un)"
  if [ -n "$GIT_HEAD" ]; then
    echo "Git branch:  $GIT_BRANCH"
    echo "Git HEAD:    $GIT_HEAD"
    echo "Git dirty:   $GIT_DIRTY"
  fi
  if [ ${#LINK_DEST_ARG[@]+x} ] && [ ${#LINK_DEST_ARG[@]} -gt 0 ]; then
    echo "Linked from: $(basename "${ABS_PREV:-}")"
  fi
} > "$DEST/SNAPSHOT.txt"

# Update 'latest' symlink atomically (overwrites any existing link, never duplicates)
LATEST_LINK="$STOREHOUSE/latest"
ln -sfn "$(basename "$DEST")" "$LATEST_LINK"

SIZE=$(du -sh "$DEST" 2>/dev/null | awk '{print $1}')
echo ""
echo "✓ Snapshot complete: $(basename "$DEST")  ($SIZE on disk including hardlinks)"
echo "  Latest → $(readlink "$LATEST_LINK")"

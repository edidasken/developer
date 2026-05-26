#!/usr/bin/env bash
# ======================================================================
# B-Snapshot_Storehouse.sh — Snapshot Desktop Deployments into the Storehouse.
#
# Creates a timestamped, browsable copy at:
#   /Users/greg.granger/Library/CloudStorage/GoogleDrive-flockos.notify@gmail.com/My Drive/Developer/Storehouse/DD-MM-YYYY (hh_mm_ss)
#
# The snapshot includes the full /Users/greg.granger/Desktop/Deployments tree as-is.
#
# Usage:
#   bash Iris/Bezalel/Scripts/B-Snapshot_Storehouse.sh
#   bash Iris/Bezalel/Scripts/B-Snapshot_Storehouse.sh --dry-run
#   bash Iris/Bezalel/Scripts/B-Snapshot_Storehouse.sh --help
# ======================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOYMENTS_ROOT="/Users/greg.granger/Desktop/Deployments"
STOREHOUSE="/Users/greg.granger/Library/CloudStorage/GoogleDrive-flockos.notify@gmail.com/My Drive/Developer/Storehouse"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown flag: $1"
      exit 1
      ;;
  esac
done

command -v rsync >/dev/null || { echo "ERROR: rsync required"; exit 1; }
mkdir -p "$STOREHOUSE"

TS="$(date '+%d-%m-%Y (%H_%M_%S)')"
DEST="$STOREHOUSE/$TS"

# Keep the requested folder format exact; if a collision happens within the same
# second, wait until the next second so we do not need to alter the name.
while [[ -e "$DEST" ]]; do
  sleep 1
  TS="$(date '+%d-%m-%Y (%H_%M_%S)')"
  DEST="$STOREHOUSE/$TS"
done

echo "Snapshot source : $DEPLOYMENTS_ROOT"
echo "Snapshot dest   : $DEST"
if $DRY_RUN; then
  echo "(dry-run — no files will be copied)"
fi

RSYNC_FLAGS=(-a --delete)
if $DRY_RUN; then
  RSYNC_FLAGS+=(--dry-run --stats)
fi

rsync "${RSYNC_FLAGS[@]}" "$DEPLOYMENTS_ROOT/" "$DEST/"

if $DRY_RUN; then
  echo "Dry-run complete."
  exit 0
fi

{
  echo "Snapshot:  $(basename "$DEST")"
  echo "Created:   $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "Source:    $DEPLOYMENTS_ROOT"
  echo "Host:      $(hostname)"
  echo "User:      $(id -un)"
  echo "Format:    DD-MM-YYYY (hh_mm_ss)"
} > "$DEST/SNAPSHOT.txt"

SIZE=$(du -sh "$DEST" 2>/dev/null | awk '{print $1}')
echo ""
echo "✓ Snapshot complete: $(basename "$DEST")  ($SIZE)"
echo "  Saved to: $STOREHOUSE"

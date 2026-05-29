#!/bin/zsh
set -euo pipefail

SOURCE_DIR="${1:-${FLOCKOS_SOURCE_DIR:-/Users/greg.granger/Desktop/Deployments/Nations/TBC}}"
DEST_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "Source directory not found: $SOURCE_DIR" >&2
  exit 1
fi

SOURCE_DIR="$(cd "$SOURCE_DIR" && pwd)"

if [[ "$SOURCE_DIR" == "$DEST_DIR" ]]; then
  echo "Source directory must be different from the destination repo root." >&2
  exit 1
fi

rsync -a --delete \
  --exclude='.DS_Store' \
  --exclude='Import_FlockOS.sh' \
  "$SOURCE_DIR"/ "$DEST_DIR"/

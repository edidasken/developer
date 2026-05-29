#!/usr/bin/env zsh
set -euo pipefail

SOURCE_DIR="${FLOCKOS_SOURCE_DIR:-/Users/greg.granger/Desktop/Deployments/Nations/FlockOS}"
DEST_DIR="${0:A:h}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  print -u2 "Import_FlockOS.sh: source directory not found: $SOURCE_DIR"
  exit 1
fi

SOURCE_ABS="${SOURCE_DIR:A}"
DEST_ABS="${DEST_DIR:A}"

if [[ "$SOURCE_ABS" == "$DEST_ABS" ]]; then
  print -u2 "Import_FlockOS.sh: source and destination must be different: $SOURCE_ABS"
  exit 1
fi

rsync -a \
  --exclude='/.git/' \
  --exclude='.DS_Store' \
  --exclude='Import_FlockOS.sh' \
  "$SOURCE_ABS"/ "$DEST_ABS"/
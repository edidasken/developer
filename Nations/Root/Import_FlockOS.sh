#!/usr/bin/env zsh
set -euo pipefail

SCRIPT_DIR="${0:A:h}"
REPO_ROOT="${SCRIPT_DIR:h:h}"
NATION="${SCRIPT_DIR:t}"
SHARED_IMPORTER="$REPO_ROOT/Iris/Bezalel/Scripts/Import_FlockOS.sh"

if [[ -f "$SHARED_IMPORTER" && "${0:A}" != "$SHARED_IMPORTER" ]]; then
  exec "$SHARED_IMPORTER" "$@"
fi

print -r -- "Import_FlockOS.sh: shared importer unavailable for ${NATION}"
#!/bin/bash
# refresh_seed_database.sh — Update seed_database.json from source data files
#
# USAGE:
#   bash Iris/Shepherds/Build/refresh_seed_database.sh
#
# This script updates New_Covenant/Data/seed_database.json to ensure it includes
# the latest data from all source files:
#   - strongs-greek.js (5,523 entries)
#   - strongs-hebrew.js (8,674 entries)
#   - teaching_plans.js (teaching sessions)
#   - All other value-added collections
#
# Run this when:
#   - You've added/updated content in Data/ folder
#   - B-Build warns that seed_database.json is out of date
#   - Before creating a new church deployment
#   - As part of monthly maintenance

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$REPO_ROOT"

echo "══════════════════════════════════════════════"
echo "Refreshing seed_database.json from source data"
echo "══════════════════════════════════════════════"
echo ""

# Run the update script
python3 Iris/Shepherds/Build/update_seed_database.py

echo ""
echo "══════════════════════════════════════════════"
echo "✅ Seed database refreshed successfully"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff New_Covenant/Data/seed_database.json"
echo "  2. If satisfied, run: bash Iris/Bezalel/Scripts/B-Build_Nations.sh"
echo "  3. Then commit: git add -A && git commit -m 'Update seed_database.json'"
echo "  4. Push: git push origin main"
echo "══════════════════════════════════════════════"

#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  Z-Deploy_Firestore_Rules.sh
#  Deploy Firestore security rules to all FlockOS Firebase projects.
#
#  Projects & rules files:
#    flockos-notify      → Deployment/Firestore/notify.rules
#    flockos-trinity     → Deployment/Firestore/tbc.rules
#    flockos-theforest   → Deployment/Firestore/theforest.rules
#    flockos-comms       → Deployment/Firestore/flockchat.rules
#    flockos-truth       → Deployment/Firestore/truth.rules
#
#  Usage:
#    bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh"          # all projects
#    bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --dry-run
#    bash "Iris/Bezalel/Scripts/Z-Deploy_Firestore_Rules.sh" --project flockos-notify
#
#  Requirements: node, google-auth-library (npm package in repo root)
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SECRETS_DIR="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Secrets/Flock"
RULES_DIR="$WORKSPACE_ROOT/Architechtural Docs/New Covenant/Deployment/Firestore"

DRY_RUN=false
TARGET_PROJECT=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --project) ;;
    *) [[ "$arg" != --* ]] && TARGET_PROJECT="$arg" ;;
  esac
done

# Handle --project <id> pattern
for i in "$@"; do
  if [[ "$i" == "--project" ]]; then
    shift; TARGET_PROJECT="${1:-}"; break
  fi
done

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  FlockOS — Firestore Rules Deploy"
$DRY_RUN && echo "  MODE: DRY RUN — no changes will be made"
echo "══════════════════════════════════════════════════════════════"
echo ""

# Build project list
declare -A PROJECTS
PROJECTS["flockos-notify"]="flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json|notify.rules"
PROJECTS["flockos-trinity"]="flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json|tbc.rules"
PROJECTS["flockos-theforest"]="flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json|theforest.rules"
PROJECTS["flockos-comms"]="flockos-comms-firebase-adminsdk-fbsvc-2eec2d6f2d.json|flockchat.rules"
PROJECTS["flockos-truth"]="flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json|truth.rules"

ORDER=(flockos-notify flockos-trinity flockos-theforest flockos-comms flockos-truth)

if [ -n "$TARGET_PROJECT" ] && [[ -z "${PROJECTS[$TARGET_PROJECT]+x}" ]]; then
  echo "  ✗ Unknown project: $TARGET_PROJECT"
  echo "    Valid values: ${!PROJECTS[*]}"
  exit 1
fi

if $DRY_RUN; then
  for proj in "${ORDER[@]}"; do
    [[ -n "$TARGET_PROJECT" && "$proj" != "$TARGET_PROJECT" ]] && continue
    IFS='|' read -r _sa _rules <<< "${PROJECTS[$proj]}"
    echo "  [dry-run] $proj  →  $_rules"
  done
  echo ""
  echo "Done (dry run — nothing deployed)."
  exit 0
fi

# ── Deploy via Node.js REST API ──────────────────────────────────────────────
node - << JSEOF
const { GoogleAuth } = require('google-auth-library');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const SECRETS  = ${BASH_REMATCH[*]} || process.env.SECRETS_DIR  || '';
const RULES_D  = process.env.RULES_DIR  || '';
const TARGET   = process.env.TARGET_PROJECT || '';

const SECRETS_DIR = "$SECRETS_DIR";
const RULES_DIR   = "$RULES_DIR";
const TARGET_PROJ = "$TARGET_PROJECT";

const projects = [
  { id: 'flockos-notify',    sa: 'flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json',    rules: 'notify.rules'    },
  { id: 'flockos-trinity',   sa: 'flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json',   rules: 'tbc.rules'       },
  { id: 'flockos-theforest', sa: 'flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json', rules: 'theforest.rules' },
  { id: 'flockos-comms',     sa: 'flockos-comms-firebase-adminsdk-fbsvc-2eec2d6f2d.json',     rules: 'flockchat.rules' },
  { id: 'flockos-truth',     sa: 'flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json',     rules: 'truth.rules'     },
].filter(p => !TARGET_PROJ || p.id === TARGET_PROJ);

function req(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request(url, {
      method,
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function deploy(project) {
  const rulesPath = path.join(RULES_DIR, project.rules);
  if (!fs.existsSync(rulesPath)) {
    console.error('  ✗ ' + project.id + ': rules file not found — ' + rulesPath);
    return false;
  }
  const content = fs.readFileSync(rulesPath, 'utf8');
  const auth    = new GoogleAuth({
    keyFile: path.join(SECRETS_DIR, project.sa),
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const token = await auth.getAccessToken();

  // 1. Create new ruleset
  const created = await req('POST',
    'https://firebaserules.googleapis.com/v1/projects/' + project.id + '/rulesets',
    token,
    { source: { files: [{ name: 'firestore.rules', content }] } }
  );
  if (created.status !== 200) {
    console.error('  ✗ ' + project.id + ': create ruleset failed (' + created.status + '): ' + created.body.error?.message);
    return false;
  }

  // 2. Point cloud.firestore release at new ruleset
  const patched = await req('PATCH',
    'https://firebaserules.googleapis.com/v1/projects/' + project.id + '/releases/cloud.firestore',
    token,
    { release: { name: 'projects/' + project.id + '/releases/cloud.firestore', rulesetName: created.body.name } }
  );
  if (patched.status !== 200) {
    console.error('  ✗ ' + project.id + ': release update failed (' + patched.status + '): ' + patched.body.error?.message);
    return false;
  }

  console.log('  ✓ ' + project.id + '  →  ' + project.rules + '  (ruleset: ' + created.body.name.split('/').pop() + ')');
  return true;
}

(async () => {
  let ok = 0, fail = 0;
  for (const p of projects) {
    (await deploy(p)) ? ok++ : fail++;
  }
  console.log('');
  if (fail === 0) {
    console.log('All ' + ok + ' project(s) updated successfully.');
  } else {
    console.log(ok + ' succeeded, ' + fail + ' failed. Check errors above.');
    process.exit(1);
  }
})();
JSEOF

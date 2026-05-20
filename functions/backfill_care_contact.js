/**
 * backfill_care_contact.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time backfill: for every open care case, find the most recent recorded
 * contact with that member (across touches, contactLog, and careInteractions)
 * and write that timestamp into lastContactAt + updatedAt if the case is stale.
 *
 * Run from the functions/ folder:
 *   node backfill_care_contact.js [--project <firebase-project-id>] [--dry-run]
 *
 * Uses Application Default Credentials (ADC).  If you need a service account:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 *   node backfill_care_contact.js --project my-church-project
 *
 * Flags:
 *   --project  <id>   Firebase project ID to target (required unless GCLOUD_PROJECT is set)
 *   --dry-run         Preview what would be updated — no writes to Firestore
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const admin = require('firebase-admin');

// ── Parse CLI flags ──────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const DRY    = args.includes('--dry-run');
const pIdx   = args.indexOf('--project');
const PROJECT = pIdx !== -1 ? args[pIdx + 1] : (process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG_PROJECT);

if (!PROJECT) {
  console.error('ERROR: Specify --project <firebase-project-id> or set GCLOUD_PROJECT env var.');
  process.exit(1);
}

if (DRY) console.log('DRY-RUN mode — no writes will be made.\n');

// ── Init Admin ───────────────────────────────────────────────────────────────
admin.initializeApp({ projectId: PROJECT });
const db = admin.firestore();

// Terminal statuses — skip these cases
const TERMINAL = new Set(['Resolved', 'Closed', 'Deleted']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Return epoch ms from a Firestore Timestamp, JS Date, or null. */
function toMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  const d = new Date(ts);
  return isNaN(d) ? 0 : d.getTime();
}

/**
 * Fetch the most recent contact timestamp for a given memberId by checking
 * three collections in parallel:
 *   • touches         — loggedAt
 *   • contactLog      — createdAt  (legacy)
 *   • careInteractions — createdAt (filtered to cases for this member)
 */
async function latestContactMs(memberId) {
  const [touchSnap, contactSnap, interactionSnap] = await Promise.all([
    db.collection('touches')
      .where('memberId', '==', memberId)
      .orderBy('loggedAt', 'desc')
      .limit(1)
      .get(),
    db.collection('contactLog')
      .where('memberId', '==', memberId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get(),
    db.collection('careInteractions')
      .where('caseId', '!=', '')   // all interactions; we'll filter by memberId next
      .orderBy('caseId')
      .orderBy('createdAt', 'desc')
      .limit(50)                   // broader sweep — will filter in-memory
      .get(),
  ]).catch(async () => {
    // If compound query fails (missing index), fall back to simpler queries
    const [t, c] = await Promise.all([
      db.collection('touches')
        .where('memberId', '==', memberId)
        .get(),
      db.collection('contactLog')
        .where('memberId', '==', memberId)
        .get(),
    ]);
    return [t, c, { docs: [] }];
  });

  let best = 0;

  touchSnap.docs.forEach(d => {
    best = Math.max(best, toMs(d.data().loggedAt));
  });
  contactSnap.docs.forEach(d => {
    best = Math.max(best, toMs(d.data().createdAt));
  });
  // Care interactions don't have memberId — match them via caseId later
  // (handled in main loop via per-case interaction query instead)

  return best;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Project : ${PROJECT}`);
  console.log('Fetching all open care cases…\n');

  const casesSnap = await db.collection('careCases').get();
  const openCases = casesSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => !TERMINAL.has(c.status));

  console.log(`Found ${casesSnap.size} total care cases, ${openCases.size || openCases.length} open.\n`);

  let updated = 0;
  let skipped = 0;

  for (const caseDoc of openCases) {
    const caseId   = caseDoc.id;
    const memberId = caseDoc.memberId;

    if (!memberId) {
      console.log(`  [SKIP] ${caseId} — no memberId`);
      skipped++;
      continue;
    }

    // Fetch most recent touch/contactLog for this member
    const memberContactMs = await latestContactMs(memberId);

    // Also fetch the most recent careInteraction for this case
    let interactionMs = 0;
    try {
      const ixSnap = await db.collection('careInteractions')
        .where('caseId', '==', caseId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();
      if (!ixSnap.empty) {
        interactionMs = toMs(ixSnap.docs[0].data().createdAt);
      }
    } catch (_) { /* index may not exist — skip */ }

    const bestContactMs = Math.max(memberContactMs, interactionMs);
    if (bestContactMs === 0) {
      console.log(`  [SKIP] ${caseId} (member: ${memberId}) — no contact history found`);
      skipped++;
      continue;
    }

    const currentUpdatedMs = toMs(caseDoc.updatedAt);
    const currentContactMs = toMs(caseDoc.lastContactAt);

    // Only write if we have newer data
    if (bestContactMs <= currentContactMs && bestContactMs <= currentUpdatedMs) {
      console.log(`  [OK]   ${caseId} — already up to date`);
      skipped++;
      continue;
    }

    const bestTs = admin.firestore.Timestamp.fromMillis(bestContactMs);
    const now    = admin.firestore.FieldValue.serverTimestamp();

    const patch = {
      lastContactAt:      bestTs,
      updatedAt:          now,
      updatedBy:          'backfill_care_contact.js',
    };

    // If updatedAt is older than bestContactMs, bring it up to match
    if (currentUpdatedMs < bestContactMs) patch.updatedAt = bestTs;

    if (DRY) {
      console.log(`  [DRY]  Would update ${caseId}: lastContactAt → ${new Date(bestContactMs).toISOString()}`);
    } else {
      await db.collection('careCases').doc(caseId).update(patch);
      console.log(`  [UPDATED] ${caseId}: lastContactAt → ${new Date(bestContactMs).toISOString()}`);
    }
    updated++;
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Done.  Updated: ${updated}  |  Skipped: ${skipped}`);
  if (DRY) console.log('(Dry run — no changes were written.)');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});

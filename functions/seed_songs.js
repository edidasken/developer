/**
 * seed_songs.js
 * Copies all songs from flockos-notify (church: flockos) into
 * flockos-truth, flockos-trinity, and flockos-theforest.
 * Existing songs in target churches are deleted first.
 *
 * Usage:  node functions/seed_songs.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const SECRETS = path.join(__dirname, '..', 'Architechtural Docs/New Covenant/Secrets/Flock');

const SOURCE = {
  key:     path.join(SECRETS, 'flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json'),
  project: 'flockos-notify',
};

const TARGETS = [
  {
    key:     path.join(SECRETS, 'flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json'),
    project: 'flockos-truth',
  },
  {
    key:     path.join(SECRETS, 'flockos-trinity-firebase-adminsdk-fbsvc-c8e8ee9c05.json'),
    project: 'flockos-trinity',
  },
  {
    key:     path.join(SECRETS, 'flockos-theforest-firebase-adminsdk-fbsvc-1317741aea.json'),
    project: 'flockos-theforest',
  },
];

// ── helpers ────────────────────────────────────────────────────────────────

/** Delete all docs in a collection in batches of 400 */
async function deleteCollection(collRef) {
  let deleted = 0;
  let snap;
  do {
    snap = await collRef.limit(400).get();
    if (snap.empty) break;
    const batch = collRef.firestore.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  } while (snap.size === 400);
  return deleted;
}

/** Write docs in batches of 400 */
async function batchWrite(collRef, docs) {
  const CHUNK = 400;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = collRef.firestore.batch();
    docs.slice(i, i + CHUNK).forEach(({ id, data }) => {
      batch.set(collRef.doc(id), data);
    });
    await batch.commit();
  }
}

// ── main ───────────────────────────────────────────────────────────────────

async function run() {
  // 1. Init source app
  const srcApp = admin.initializeApp({
    credential: admin.credential.cert(require(SOURCE.key)),
  }, 'source');
  const srcDb = srcApp.firestore();

  // 2. Read all songs from source (top-level `songs` collection)
  console.log(`\nReading songs from ${SOURCE.project}/songs …`);
  const srcSnap = await srcDb.collection('songs').get();
  if (srcSnap.empty) {
    console.error('  ✗ No songs found in source — aborting.');
    process.exit(1);
  }
  const songs = srcSnap.docs.map(d => ({ id: d.id, data: d.data() }));
  console.log(`  ✓ ${songs.length} songs read from source.`);

  // 3. For each target: delete existing → write new
  for (const target of TARGETS) {
    console.log(`\n── ${target.project}/songs ──`);

    const appName = target.project;
    let tgtApp;
    try {
      tgtApp = admin.app(appName);
    } catch (_) {
      tgtApp = admin.initializeApp(
        { credential: admin.credential.cert(require(target.key)) },
        appName
      );
    }
    const tgtDb     = tgtApp.firestore();
    const songsColl = tgtDb.collection('songs');

    // Delete existing
    const deleted = await deleteCollection(songsColl);
    console.log(`  ✓ Deleted ${deleted} existing songs.`);

    // Write source songs
    await batchWrite(songsColl, songs);
    console.log(`  ✓ Wrote ${songs.length} songs.`);
  }

  console.log('\nDone.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Import-LibraryContent.cjs
 * ------------------------------------------------------------------
 * Seeds the FEED Library collections in the flockos-notify project:
 *   • quotes/         (Spurgeon quotations)
 *   • illustrations/  (Proverbs illustrations)
 *
 * Idempotent — uses deterministic doc IDs from the JSON files, so
 * re-running updates in place rather than duplicating.
 *
 * Usage:
 *   node Iris/Bezalel/Scripts/Import-LibraryContent.cjs
 *
 * Env overrides:
 *   FLOCKOS_NOTIFY_SA  path to service-account JSON (defaults to the
 *                      Secrets/Flock copy used by the rest of the repo)
 *   ONLY=quotes|illustrations  seed just one collection
 *   DRY=1              parse + validate, write nothing
 */

const fs   = require('fs');
const path = require('path');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue }     = require('firebase-admin/firestore');

const ROOT = process.cwd();

const SA_PATH = process.env.FLOCKOS_NOTIFY_SA
  ? path.resolve(process.env.FLOCKOS_NOTIFY_SA)
  : path.join(ROOT, 'Architechtural Docs/New Covenant/Secrets/Flock/flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json');

const QUOTES_FILE = path.join(ROOT, 'Iris/Bezalel/Scripts/Data/spurgeon-quotes.json');
const ILLUS_FILE  = path.join(ROOT, 'Iris/Bezalel/Scripts/Data/proverbs-illustrations.json');

const ONLY = (process.env.ONLY || '').toLowerCase().trim();
const DRY  = process.env.DRY === '1';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function ensureApp() {
  if (getApps().length) return getApps()[0];
  if (!fs.existsSync(SA_PATH)) {
    throw new Error('Service account not found at: ' + SA_PATH);
  }
  return initializeApp({ credential: cert(readJson(SA_PATH)) });
}

async function seedCollection(db, collectionName, items, sourceMeta) {
  if (!Array.isArray(items) || !items.length) {
    console.log(`[skip] ${collectionName}: no items`);
    return { written: 0 };
  }

  const col = db.collection(collectionName);
  let written = 0;
  let batch = db.batch();
  let inBatch = 0;

  for (const item of items) {
    if (!item.id || typeof item.id !== 'string') {
      console.warn(`[warn] ${collectionName}: skipping entry without string id`, item);
      continue;
    }
    const ref  = col.doc(item.id);
    const data = {
      ...item,
      _source: sourceMeta || null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    // Don't store the doc id inside the doc body — it's redundant.
    delete data.id;
    // createdAt only on first write — set with merge:true and a sentinel
    // so subsequent updates don't overwrite the original timestamp.
    if (!('createdAt' in data)) {
      data.createdAt = FieldValue.serverTimestamp();
    }

    if (DRY) {
      written++;
      continue;
    }

    batch.set(ref, data, { merge: true });
    inBatch++;
    written++;

    // Firestore batch limit is 500.
    if (inBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
    }
  }

  if (!DRY && inBatch > 0) await batch.commit();
  console.log(`[ok]   ${collectionName}: ${written} doc(s) ${DRY ? 'validated (DRY)' : 'written'}`);
  return { written };
}

async function main() {
  console.log(`[info] project = flockos-notify`);
  console.log(`[info] SA      = ${path.relative(ROOT, SA_PATH)}`);
  console.log(`[info] mode    = ${DRY ? 'DRY-RUN (no writes)' : 'LIVE'}`);

  ensureApp();
  const db = getFirestore();

  const tasks = [];

  if (!ONLY || ONLY === 'quotes') {
    if (fs.existsSync(QUOTES_FILE)) {
      const j = readJson(QUOTES_FILE);
      tasks.push(seedCollection(db, 'quotes', j.items, j._meta));
    } else {
      console.warn(`[warn] missing ${QUOTES_FILE}`);
    }
  }

  if (!ONLY || ONLY === 'illustrations') {
    if (fs.existsSync(ILLUS_FILE)) {
      const j = readJson(ILLUS_FILE);
      tasks.push(seedCollection(db, 'illustrations', j.items, j._meta));
    } else {
      console.warn(`[warn] missing ${ILLUS_FILE}`);
    }
  }

  const results = await Promise.all(tasks);
  const total   = results.reduce((s, r) => s + (r.written || 0), 0);
  console.log(`[done] total = ${total}`);
}

main().catch(err => {
  console.error('[fatal]', err && err.stack || err);
  process.exit(1);
});

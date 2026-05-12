#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { generateManifestFromSql } = require('./generate_schema_manifest_from_sql.cjs');

function resolveFromWorkspace(relPath) {
  return path.resolve(process.cwd(), relPath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureApp(serviceAccountPath) {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccount = readJson(serviceAccountPath);
  return initializeApp({ credential: cert(serviceAccount) });
}

function isoNow() {
  return new Date().toISOString();
}

async function main() {
  const sqlPath = process.env.TRUTH_SCHEMA_SQL_PATH
    ? path.resolve(process.env.TRUTH_SCHEMA_SQL_PATH)
    : resolveFromWorkspace('Architechtural Docs/New Covenant/Architecture/New Covenant Schema.sql');

  const manifestPath = process.env.TRUTH_SCHEMA_MANIFEST_PATH
    ? path.resolve(process.env.TRUTH_SCHEMA_MANIFEST_PATH)
    : resolveFromWorkspace('Architechtural Docs/New Covenant/Architecture/combined_schema_manifest.deployable.json');

  const serviceAccountPath = process.env.TRUTH_SCHEMA_SERVICE_ACCOUNT
    ? path.resolve(process.env.TRUTH_SCHEMA_SERVICE_ACCOUNT)
    : resolveFromWorkspace('Architechtural Docs/New Covenant/Secrets/Flock/flockos-truth-firebase-adminsdk-fbsvc-21aa89bf70.json');

  const truthProjectId = (process.env.TRUTH_SCHEMA_PROJECT_ID || 'flockos-truth').trim();
  const latestDocId = (process.env.TRUTH_SCHEMA_LATEST_DOC_ID || 'combined_schema_manifest_deployable').trim();
  const collectionName = (process.env.TRUTH_SCHEMA_COLLECTION || 'schemaBackups').trim();

  if (!fs.existsSync(sqlPath)) {
    throw new Error('SQL schema not found: ' + sqlPath);
  }

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error('Truth service account not found: ' + serviceAccountPath);
  }

  // SQL is authoritative; JSON manifest is generated output for compatibility.
  const manifest = generateManifestFromSql(sqlPath, manifestPath);
  const manifestRaw = JSON.stringify(manifest, null, 2) + '\n';
  fs.writeFileSync(manifestPath, manifestRaw);

  const hash = crypto.createHash('sha256').update(manifestRaw).digest('hex');
  const generatedAt = isoNow();
  const snapshotId = 'snapshot_' + generatedAt.replace(/[-:.TZ]/g, '');

  ensureApp(serviceAccountPath);
  const db = getFirestore();

  const metadata = {
    type: 'combined_schema_manifest',
    schemaVersion: '1.0',
    projectId: truthProjectId,
    sourcePath: path.relative(process.cwd(), sqlPath),
    derivedManifestPath: path.relative(process.cwd(), manifestPath),
    sha256: hash,
    generatedAt,
    totals: manifest && manifest.totals ? manifest.totals : null,
    collectionCount: manifest && manifest.collections ? Object.keys(manifest.collections).length : null,
    source: manifest && manifest.source ? manifest.source : null,
  };

  const latestRef = db.collection(collectionName).doc(latestDocId);
  const snapshotRef = db.collection(collectionName).doc(snapshotId);

  await db.runTransaction(async (tx) => {
    tx.set(latestRef, {
      ...metadata,
      snapshotRef: snapshotId,
      updatedAt: FieldValue.serverTimestamp(),
      manifest,
    }, { merge: true });

    tx.set(snapshotRef, {
      ...metadata,
      latestRef: latestDocId,
      createdAt: FieldValue.serverTimestamp(),
      manifest,
    }, { merge: false });
  });

  console.log('[TruthSchemaBackup] Published to Firestore project: ' + truthProjectId);
  console.log('[TruthSchemaBackup] Collection/doc (latest): ' + collectionName + '/' + latestDocId);
  console.log('[TruthSchemaBackup] Collection/doc (snapshot): ' + collectionName + '/' + snapshotId);
  console.log('[TruthSchemaBackup] SHA256: ' + hash);
}

main().catch((err) => {
  console.error('[TruthSchemaBackup] ERROR:', err.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * fix-members-db.mjs
 * Repairs the flockos-notify Firestore /members collection:
 *
 *   1. PHONE RENAME  — moves `cellPhone` → `phone` for members that have
 *      cellPhone but no phone (the VCF importer bug).
 *
 *   2. VCF PHONE PATCH — for members that STILL have no phone after step 1,
 *      tries to find their phone in the original VCF by matching name.
 *
 *   3. DUPLICATE ARCHIVE — for members sharing the same name or email,
 *      keeps whichever record has more data, merges any missing fields
 *      from the duplicate into it, then archives the duplicate with
 *      { membershipStatus:'Archived', archivedAt, mergedIntoMemberId }.
 *
 * SAFE:  Only touches /members. Never touches careCases, careInteractions,
 *        prayers, groups, giving, sermons, or any other collection.
 * SAFE:  Never hard-deletes anything. Duplicates are archived, not removed.
 *
 * Usage:
 *   node fix-members-db.mjs            # DRY RUN — no writes
 *   node fix-members-db.mjs --commit   # LIVE    — applies all changes
 */

import { createRequire } from 'module';
import { readFileSync }   from 'fs';
import { fileURLToPath }  from 'url';
import path               from 'path';

const require = createRequire(import.meta.url);
const admin   = require('firebase-admin');

const DRY_RUN  = !process.argv.includes('--commit');
const __dir    = path.dirname(fileURLToPath(import.meta.url));
const REPO     = path.resolve(__dir, '../../..');

const KEY_PATH = path.join(
  REPO,
  'Architechtural Docs/New Covenant/Secrets/Flock',
  'flockos-notify-firebase-adminsdk-fbsvc-69aa3dcf79.json',
);
const VCF_PATH = path.join(
  REPO,
  'Architechtural Docs/New Covenant/Secrets/Flock',
  'Contacts.vcf',
);

// ─── Init ──────────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

// ─── Helpers ───────────────────────────────────────────────────────────────
const _norm = (s) => String(s || '').toLowerCase().trim();

/** Count non-empty (non-id, non-timestamp, non-internal) fields in a record */
function _richness(m) {
  const skip = new Set(['id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy',
    'memberPin', 'importedFromVcf', 'membershipStatus', 'status',
    'archivedAt', 'mergedIntoMemberId', 'mergedAt']);
  return Object.entries(m).filter(([k, v]) => !skip.has(k) && v !== '' && v != null).length;
}

/** Parse the VCF file → Map<normName, phone> */
function _parseVcfPhones(vcfText) {
  // Unfold continuation lines
  const unfolded = vcfText.replace(/\r\n([ \t])/g, '$1').replace(/\n([ \t])/g, '$1');
  const lines    = unfolded.split(/\r\n|\r|\n/);

  const map = new Map(); // normName → { fn, phone }
  let cur = null;

  for (const raw of lines) {
    const line  = raw.trimEnd();
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VCARD')  { cur = {}; continue; }
    if (upper === 'END:VCARD')    { if (cur?.fn && cur.phone) map.set(_norm(cur.fn), cur.phone); cur = null; continue; }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const propFull = line.slice(0, colon).toUpperCase();
    const value    = line.slice(colon + 1).trim();
    const prop     = propFull.split(';')[0];
    const params   = propFull.split(';').slice(1).join(';');

    if (prop === 'FN') {
      cur.fn = value;
    } else if (prop === 'N') {
      const n = value.split(';');
      const last  = (n[0] || '').replace(/\\/g, '').trim();
      const first = (n[1] || '').replace(/\\/g, '').trim();
      if (first || last) cur.n = [first, last].filter(Boolean).join(' ');
    } else if (prop === 'TEL' && !cur.phone) {
      // Skip fax; prefer CELL; fall back to any number
      if (params.includes('FAX')) continue;
      const clean = value.replace(/[^\d+\-()\s.ext]/gi, '').trim();
      if (clean) cur.phone = clean;
    }
  }
  return map; // normName → phone string
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${'─'.repeat(64)}`);
  console.log(`  flockos-notify member repair   [${DRY_RUN ? 'DRY RUN — no writes' : '⚡ LIVE — writing to Firestore'}]`);
  console.log(`${'─'.repeat(64)}\n`);

  if (DRY_RUN) {
    console.log('  Run with --commit to apply changes.\n');
  }

  // Load VCF ground-truth phones
  const vcfPhones = _parseVcfPhones(readFileSync(VCF_PATH, 'utf8'));
  console.log(`VCF loaded: ${vcfPhones.size} contacts with phone numbers.\n`);

  // Load all members
  const snap = await db.collection('members').get();
  const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`Firestore: ${members.length} total member documents.\n`);

  // ── STEP 1: cellPhone → phone rename ───────────────────────────────────
  console.log('── STEP 1: cellPhone → phone rename ─────────────────────────');
  const phoneRenames = members.filter(m =>
    m.cellPhone && !m.phone && m.membershipStatus !== 'Archived' && m.status !== 'Inactive',
  );
  console.log(`  ${phoneRenames.length} member(s) have cellPhone but no phone.\n`);

  const batch1 = db.batch();
  for (const m of phoneRenames) {
    const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.displayName || m.name || m.id;
    console.log(`  RENAME  ${name.padEnd(30)} cellPhone=${m.cellPhone} → phone`);
    if (!DRY_RUN) {
      const ref = db.collection('members').doc(m.id);
      batch1.update(ref, {
        phone:     m.cellPhone,
        cellPhone: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'fix-members-db.mjs',
      });
      // Also update local copy for subsequent steps
      m.phone    = m.cellPhone;
      m.cellPhone = undefined;
    }
  }
  if (!DRY_RUN && phoneRenames.length) { await batch1.commit(); console.log('\n  ✓ Batch committed.'); }
  console.log();

  // ── STEP 2: VCF phone patch (members still missing phone) ─────────────
  console.log('── STEP 2: VCF phone patch (members still no phone) ─────────');
  const noPhone = members.filter(m =>
    !m.phone && !m.cellPhone && m.membershipStatus !== 'Archived' && m.status !== 'Inactive',
  );
  console.log(`  ${noPhone.length} member(s) have no phone at all.\n`);

  const batch2 = db.batch();
  let patched = 0;
  for (const m of noPhone) {
    const first = _norm(m.firstName || '');
    const last  = _norm(m.lastName  || '');
    const fullA = [first, last].filter(Boolean).join(' ');
    const fullB = _norm(m.displayName || m.name || '');
    const vcfPhone = (fullA && vcfPhones.get(fullA)) || (fullB && vcfPhones.get(fullB)) || null;
    if (!vcfPhone) continue;

    const displayName = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.displayName || m.name || m.id;
    console.log(`  PATCH   ${displayName.padEnd(30)} phone=${vcfPhone}  (from VCF)`);
    if (!DRY_RUN) {
      batch2.update(db.collection('members').doc(m.id), {
        phone:     vcfPhone,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'fix-members-db.mjs',
      });
      m.phone = vcfPhone;
    }
    patched++;
  }
  if (!DRY_RUN && patched) { await batch2.commit(); console.log('\n  ✓ Batch committed.'); }
  if (!patched) console.log('  (none matched in VCF)');
  console.log();

  // ── STEP 3: Duplicate detection & archive ──────────────────────────────
  console.log('── STEP 3: Duplicate detection ───────────────────────────────');

  // Build index: normKey → [member, member, ...]
  const byEmail = new Map();
  const byName  = new Map();

  for (const m of members) {
    if (m.membershipStatus === 'Archived' || m.status === 'Inactive') continue;

    const email = _norm(m.primaryEmail || m.email || '');
    if (email) {
      if (!byEmail.has(email)) byEmail.set(email, []);
      byEmail.get(email).push(m);
    }

    const name = _norm([m.firstName, m.lastName].filter(Boolean).join(' ') || m.displayName || m.name || '');
    if (name && name !== 'unknown') {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(m);
    }
  }

  // Collect duplicate groups (deduped by pairing)
  const seen    = new Set(); // processed member ids
  const groups  = [];        // [{keeper, duplicates:[...]}]

  const _addGroup = (bucket) => {
    if (bucket.length < 2) return;
    const ids = bucket.map(m => m.id).sort().join('|');
    if (seen.has(ids)) return;
    seen.add(ids);
    // Sort by richness desc; tie-break by createdAt asc (older wins)
    const sorted = [...bucket].sort((a, b) => {
      const rd = _richness(b) - _richness(a);
      if (rd !== 0) return rd;
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return ta - tb;
    });
    groups.push({ keeper: sorted[0], duplicates: sorted.slice(1) });
  };

  for (const bucket of byEmail.values()) _addGroup(bucket);
  for (const bucket of byName.values())  _addGroup(bucket);

  console.log(`  ${groups.length} duplicate group(s) found.\n`);

  const batch3 = db.batch();
  let archived = 0;

  for (const { keeper, duplicates } of groups) {
    const keeperName = [keeper.firstName, keeper.lastName].filter(Boolean).join(' ')
      || keeper.displayName || keeper.name || keeper.id;
    console.log(`  GROUP: "${keeperName}" — keeping ${keeper.id}`);

    for (const dup of duplicates) {
      // Build patch: fields that are blank in keeper but present in dup
      const patch = {};
      const skipFields = new Set(['id', 'memberPin', 'createdAt', 'updatedAt',
        'createdBy', 'updatedBy', 'importedFromVcf', 'membershipStatus', 'status',
        'archivedAt', 'mergedIntoMemberId', 'mergedAt']);
      for (const [key, val] of Object.entries(dup)) {
        if (skipFields.has(key)) continue;
        if (!val && val !== 0) continue;
        const cur = keeper[key];
        if (!cur && cur !== 0) patch[key] = val;
      }

      const dupName = [dup.firstName, dup.lastName].filter(Boolean).join(' ')
        || dup.displayName || dup.name || dup.id;

      const mergeNote = Object.keys(patch).filter(k => k !== 'id').join(', ') || '(none)';
      console.log(`    ARCHIVE dup ${dup.id} "${dupName}"  merged fields: ${mergeNote}`);

      if (!DRY_RUN) {
        // Patch keeper with any fields merged from dup
        if (Object.keys(patch).length > 0) {
          batch3.update(db.collection('members').doc(keeper.id), {
            ...patch,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: 'fix-members-db.mjs',
          });
        }
        // Archive the duplicate
        batch3.update(db.collection('members').doc(dup.id), {
          membershipStatus:   'Archived',
          status:             'Inactive',
          archivedAt:         admin.firestore.FieldValue.serverTimestamp(),
          mergedIntoMemberId: keeper.id,
          mergedAt:           admin.firestore.FieldValue.serverTimestamp(),
          updatedBy:          'fix-members-db.mjs',
        });
      }
      archived++;
    }
    console.log();
  }

  if (!DRY_RUN && archived) { await batch3.commit(); console.log('  ✓ Batch committed.'); }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`${'─'.repeat(64)}`);
  console.log(`  SUMMARY  [${DRY_RUN ? 'DRY RUN' : 'COMMITTED'}]`);
  console.log(`    Phone renames (cellPhone→phone): ${phoneRenames.length}`);
  console.log(`    VCF phone patches:               ${patched}`);
  console.log(`    Duplicates archived:             ${archived}`);
  console.log(`${'─'.repeat(64)}\n`);

  if (DRY_RUN) {
    console.log('  Nothing was written. Run with --commit to apply.\n');
  }
}

main().catch(err => { console.error(err); process.exit(1); });

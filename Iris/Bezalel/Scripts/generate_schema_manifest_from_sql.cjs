#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function resolveFromWorkspace(relPath) {
  return path.resolve(process.cwd(), relPath);
}

function parseManifestMeta(sqlText) {
  const rx = /VALUES\s*\(\s*'combined_schema_manifest_deployable'\s*,\s*NOW\(\)\s*,\s*'([^']*)'\s*,\s*'([^']*)'\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\)/m;
  const m = sqlText.match(rx);
  if (!m) {
    return {
      source: {
        syncTabMap: 'Architechtural Docs/New Covenant/Architecture/B-Master Code.md',
        fieldReverseMap: 'Architechtural Docs/New Covenant/Architecture/B-Master Code.md',
      },
      totals: {
        collectionsInSyncMap: null,
        collectionsWithFieldMap: null,
        collectionsInCombined: null,
      },
    };
  }

  return {
    source: {
      syncTabMap: m[1],
      fieldReverseMap: m[2],
    },
    totals: {
      collectionsInSyncMap: Number(m[3]),
      collectionsWithFieldMap: Number(m[4]),
      collectionsInCombined: Number(m[5]),
    },
  };
}

function parseCollections(sqlText) {
  const lines = sqlText.split(/\r?\n/);
  const collections = {};

  let pendingCollection = null;
  let pendingSheetTab = null;
  let inTable = false;
  let currentCollection = null;
  let fields = [];

  for (const raw of lines) {
    const line = raw.trim();

    const collMatch = line.match(/^--\s*Firestore\s+collection:\s*(.+)$/i);
    if (collMatch) {
      pendingCollection = collMatch[1].trim();
      continue;
    }

    const tabMatch = line.match(/^--\s*Sheet\s+mirror:\s*(.+)$/i);
    if (tabMatch) {
      pendingSheetTab = tabMatch[1].trim();
      continue;
    }

    const createMatch = line.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"([^"]+)"\s*\($/i);
    if (createMatch) {
      inTable = true;
      currentCollection = pendingCollection || createMatch[1].trim();
      fields = [];
      continue;
    }

    if (inTable) {
      if (line === ');') {
        collections[currentCollection] = {
          sheetTab: pendingSheetTab || null,
          fields,
        };

        inTable = false;
        currentCollection = null;
        fields = [];
        pendingCollection = null;
        pendingSheetTab = null;
        continue;
      }

      const colMatch = line.match(/^"([^"]+)"\s+[A-Z][A-Z0-9_]*(?:\s+PRIMARY\s+KEY)?\s*,?$/i);
      if (colMatch) {
        const colName = colMatch[1].trim();
        if (!['id', 'created_at', 'updated_at', 'payload'].includes(colName)) {
          fields.push(colName);
        }
      }
    }
  }

  return collections;
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function generateManifestFromSql(sqlPath, previousManifestPath) {
  if (!fs.existsSync(sqlPath)) {
    throw new Error('SQL schema not found: ' + sqlPath);
  }

  const sqlText = fs.readFileSync(sqlPath, 'utf8');
  const parsedMeta = parseManifestMeta(sqlText);
  const collections = parseCollections(sqlText);
  const previous = previousManifestPath ? readJsonIfExists(previousManifestPath) : null;

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: parsedMeta.source,
    totals: {
      collectionsInSyncMap: parsedMeta.totals.collectionsInSyncMap,
      collectionsWithFieldMap: parsedMeta.totals.collectionsWithFieldMap,
      collectionsInCombined: Object.keys(collections).length,
    },
    collections,
  };

  if (previous && previous.compatibilityAliases) {
    manifest.compatibilityAliases = previous.compatibilityAliases;
  }
  if (previous && previous.deployNotes) {
    manifest.deployNotes = previous.deployNotes;
  }

  return manifest;
}

function main() {
  const sqlPath = process.env.TRUTH_SCHEMA_SQL_PATH
    ? path.resolve(process.env.TRUTH_SCHEMA_SQL_PATH)
    : resolveFromWorkspace('Architechtural Docs/New Covenant/Architecture/New Covenant Schema.sql');

  const outPath = process.env.TRUTH_SCHEMA_MANIFEST_PATH
    ? path.resolve(process.env.TRUTH_SCHEMA_MANIFEST_PATH)
    : resolveFromWorkspace('Architechtural Docs/New Covenant/Architecture/combined_schema_manifest.deployable.json');

  const manifest = generateManifestFromSql(sqlPath, outPath);
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');

  console.log('[SchemaFromSQL] Source SQL:', path.relative(process.cwd(), sqlPath));
  console.log('[SchemaFromSQL] Wrote manifest:', path.relative(process.cwd(), outPath));
  console.log('[SchemaFromSQL] Collections:', Object.keys(manifest.collections).length);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[SchemaFromSQL] ERROR:', err.message);
    process.exit(1);
  }
}

module.exports = {
  generateManifestFromSql,
};

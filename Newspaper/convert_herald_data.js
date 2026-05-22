#!/usr/bin/env node
/**
 * convert_herald_data.js
 *
 * Converts New_Covenant/Data source files (ES modules) into plain-JS globals
 * for use in the Flock Herald (Newspaper) sections.
 *
 * Output: Newspaper/Data/*.js  — each file exposes window.HERALD_DATA.KEY
 *
 * Run: node Newspaper/convert_herald_data.js  (from repo root)
 * Re-run whenever source data files are regenerated.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'New_Covenant', 'Data');
const DST  = path.join(__dirname, 'Data');

if (!fs.existsSync(DST)) fs.mkdirSync(DST);

// ── Strip ES-module wrapper ────────────────────────────────────────────────
function stripExport(src) {
  // Remove comment header block and "export default "
  let code = fs.readFileSync(path.join(SRC, src), 'utf8');
  code = code.replace(/^\/\/[^\n]*\n/gm, '').trim();     // strip // lines
  code = code.replace(/^export default\s+/m, '');        // strip export default
  if (!code.endsWith(';')) code += ';';
  return code;
}

// ── 1. devotionals — reindex as { "YYYY-MM-DD": entry } ───────────────────
(function () {
  const raw = stripExport('devotionals.js');
  const arr = eval(raw.replace(/;$/, ''));  // safe: local static file we own
  const keyed = {};
  arr.forEach(function (d) { if (d._id) keyed[d._id] = d; });
  const out = [
    '// Herald Data: Devotionals',
    '// Source: New_Covenant/Data/devotionals.js — ' + arr.length + ' records',
    '// Reindexed by _id (YYYY-MM-DD) for O(1) lookup.',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.devotionals = ' + JSON.stringify(keyed, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'devotionals.js'), out);
  console.log('✓ devotionals.js — ' + arr.length + ' records → keyed by date');
})();

// ── 2. one_year_bible — reindex as { dayNumber: entry } ───────────────────
(function () {
  const raw = stripExport('one_year_bible.js');
  const arr = eval(raw.replace(/;$/, ''));
  const keyed = {};
  arr.forEach(function (d) { keyed[d.day] = d; });
  const out = [
    '// Herald Data: One-Year Bible',
    '// Source: New_Covenant/Data/one_year_bible.js — ' + arr.length + ' days',
    '// Reindexed by day number (1–365) for O(1) lookup.',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.oneYearBible = ' + JSON.stringify(keyed, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'one_year_bible.js'), out);
  console.log('✓ one_year_bible.js — ' + arr.length + ' days → keyed by day number');
})();

// ── 3. teaching_plans — array as-is ───────────────────────────────────────
(function () {
  const raw = stripExport('teaching_plans.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Teaching Plans',
    '// Source: New_Covenant/Data/teaching_plans.js — ' + arr.length + ' records',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.teachingPlans = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'teaching_plans.js'), out);
  console.log('✓ teaching_plans.js — ' + arr.length + ' records');
})();

// ── 4. psalms — reindex byNumber as { number: entry } ────────────────────
(function () {
  const raw = stripExport('psalms.js');
  const obj = eval('(' + raw.replace(/;$/, '') + ')');
  const byNum = {};
  (obj.byNumber || []).forEach(function (p) { byNum[p.number] = p; });
  const out = [
    '// Herald Data: Psalms',
    '// Source: New_Covenant/Data/psalms.js',
    '// byNumber reindexed as { number: entry } for O(1) lookup.',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.psalms = ' + JSON.stringify({ byNumber: byNum, byTheme: obj.byTheme || {} }, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'psalms.js'), out);
  console.log('✓ psalms.js — ' + Object.keys(byNum).length + ' psalms indexed');
})();

// ── 5. reading_plans — as-is ───────────────────────────────────────────────
(function () {
  const raw = stripExport('reading-plans.js');
  const obj = eval('(' + raw.replace(/;$/, '') + ')');
  const out = [
    '// Herald Data: Reading Plans',
    '// Source: New_Covenant/Data/reading-plans.js',
    '// Plans: ' + Object.keys(obj).join(', '),
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.readingPlans = ' + JSON.stringify(obj, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'reading_plans.js'), out);
  console.log('✓ reading_plans.js — plans: ' + Object.keys(obj).join(', '));
})();

console.log('\n✅ Herald data bundle complete → Newspaper/Data/');

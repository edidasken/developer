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

// ── 6. genealogy — array as-is ────────────────────────────────────────────
(function () {
  const raw = stripExport('genealogy.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Genealogy',
    '// Source: New_Covenant/Data/genealogy.js — ' + arr.length + ' figures',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.genealogy = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'genealogy.js'), out);
  console.log('✓ genealogy.js — ' + arr.length + ' biblical figures');
})();

// ── 7. books-of-the-bible — array as-is ──────────────────────────────────
(function () {
  const raw = stripExport('books-of-the-bible.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Books of the Bible',
    '// Source: New_Covenant/Data/books-of-the-bible.js — ' + arr.length + ' books',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.booksOfBible = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'books_of_bible.js'), out);
  console.log('✓ books_of_bible.js — ' + arr.length + ' books');
})();

// ── 8. library — array as-is ──────────────────────────────────────────────
(function () {
  const raw = stripExport('library.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Library (Books of the Bible — genre/testament overview)',
    '// Source: New_Covenant/Data/library.js — ' + arr.length + ' books',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.library = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'library.js'), out);
  console.log('✓ library.js — ' + arr.length + ' books');
})();

// ── 9. theology — array as-is ─────────────────────────────────────────────
(function () {
  const raw = stripExport('theology.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Theology',
    '// Source: New_Covenant/Data/theology.js — ' + arr.length + ' doctrine sections',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.theology = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'theology.js'), out);
  console.log('✓ theology.js — ' + arr.length + ' doctrine sections');
})();

// ── 10. apologetics — array as-is ─────────────────────────────────────────
(function () {
  const raw = stripExport('apologetics.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Apologetics',
    '// Source: New_Covenant/Data/apologetics.js — ' + arr.length + ' Q&As',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.apologetics = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'apologetics.js'), out);
  console.log('✓ apologetics.js — ' + arr.length + ' Q&As');
})();

// ── 11. counseling — reindex by _id ───────────────────────────────────────
(function () {
  const raw = stripExport('counseling.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Counseling Topics',
    '// Source: New_Covenant/Data/counseling.js — ' + arr.length + ' topics',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.counseling = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'counseling.js'), out);
  console.log('✓ counseling.js — ' + arr.length + ' pastoral care topics');
})();

// ── 12. missions — array as-is ────────────────────────────────────────────
(function () {
  const raw = stripExport('missions.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Missions Registry',
    '// Source: New_Covenant/Data/missions.js — ' + arr.length + ' countries',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.missions = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'missions.js'), out);
  console.log('✓ missions.js — ' + arr.length + ' countries');
})();

// ── 13. prayercast — special (const not export default) ───────────────────
(function () {
  let code = fs.readFileSync(path.join(SRC, 'prayercast.js'), 'utf8');
  // Strip block comment header
  code = code.replace(/^\/\*[\s\S]*?\*\//m, '').trim();
  // Strip any "export function ..." declarations that follow the const array
  code = code.replace(/\nexport\s+function[\s\S]*/m, '').trim();
  // Strip "const <name> = " to get the array
  code = code.replace(/^const\s+\w+\s*=\s*/, '').trim().replace(/;$/, '');
  const arr = eval(code);
  const out = [
    '// Herald Data: Prayercast Video Library',
    '// Source: New_Covenant/Data/prayercast.js — ' + arr.length + ' nations',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.prayercast = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'prayercast.js'), out);
  console.log('✓ prayercast.js — ' + arr.length + ' nations with video embeds');
})();

// ── 14. heart — array as-is ───────────────────────────────────────────────
(function () {
  const raw = stripExport('heart.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Heart Check Questions',
    '// Source: New_Covenant/Data/heart.js — ' + arr.length + ' questions',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.heart = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'heart.js'), out);
  console.log('✓ heart.js — ' + arr.length + ' heart check questions');
})();

// ── 15. mirror — array as-is ──────────────────────────────────────────────
(function () {
  const raw = stripExport('mirror.js');
  const arr = eval(raw.replace(/;$/, ''));
  const out = [
    '// Herald Data: Shepherd\'s Mirror Questions',
    '// Source: New_Covenant/Data/mirror.js — ' + arr.length + ' questions',
    '// DO NOT EDIT — regenerate with: node Newspaper/convert_herald_data.js',
    'window.HERALD_DATA = window.HERALD_DATA || {};',
    'window.HERALD_DATA.mirror = ' + JSON.stringify(arr, null, 2) + ';',
  ].join('\n');
  fs.writeFileSync(path.join(DST, 'mirror.js'), out);
  console.log('✓ mirror.js — ' + arr.length + ' mirror questions');
})();

console.log('\n✅ Herald data bundle complete → Newspaper/Data/');

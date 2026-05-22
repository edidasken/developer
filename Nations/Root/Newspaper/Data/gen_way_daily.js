#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   gen_way_daily.js — Generates the_way_daily.js from the_way_daily.md
   ═══════════════════════════════════════════════════════════════════════════
   Run from the repo root:
     node Newspaper/Data/gen_way_daily.js

   Reads:  Newspaper/Data/the_way_daily.md
   Writes: Newspaper/Data/the_way_daily.js

   Markdown format expected:
     ## Module: the_gospel_reading
     **Title:** Reading Plans
     **Why:** ...single paragraph...
     **Helps:** ...single paragraph...
     ### Day 1
     The teaser text for day 1.
     ### Day 2
     ...
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs   = require('fs');
const path = require('path');

const SRC  = path.join(__dirname, 'the_way_daily.md');
const DEST = path.join(__dirname, 'the_way_daily.js');

const raw = fs.readFileSync(SRC, 'utf8');

/* ── Split into module sections ────────────────────────────────────── */
const moduleSections = raw.split(/^## Module:/m).slice(1); // drop preamble

const modules = {};

for (const section of moduleSections) {
  const lines = section.split('\n');

  /* Module key is the first line after "## Module:" */
  const modKey = lines[0].trim();

  /* Extract fields */
  const titleMatch = section.match(/\*\*Title:\*\*\s*(.+)/);
  const whyMatch   = section.match(/\*\*Why:\*\*\s*([\s\S]+?)(?=\n\*\*Helps:|###)/);
  const helpsMatch = section.match(/\*\*Helps:\*\*\s*([\s\S]+?)(?=\n###)/);

  const title = titleMatch ? titleMatch[1].trim() : modKey;
  const why   = whyMatch   ? whyMatch[1].replace(/\n/g, ' ').trim() : '';
  const helps = helpsMatch ? helpsMatch[1].replace(/\n/g, ' ').trim() : '';

  /* Extract day messages */
  const days = [];
  const dayBlocks = section.split(/^### Day \d+/m).slice(1);
  for (const block of dayBlocks) {
    /* First non-empty line after the header */
    const msg = block.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)[0] || '';
    if (msg) days.push(msg);
  }

  modules[modKey] = { title, why, helps, days };
}

/* ── Serialise to JS ───────────────────────────────────────────────── */
function jsStr(s) {
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

const lines = [
  '/* AUTO-GENERATED — edit the_way_daily.md then run gen_way_daily.js */',
  '/* eslint-disable */',
  'var THE_WAY_DAILY = {',
];

const keys = Object.keys(modules);
keys.forEach((key, ki) => {
  const m = modules[key];
  const comma = ki < keys.length - 1 ? ',' : '';
  lines.push(`  ${jsStr(key)}: {`);
  lines.push(`    title:  ${jsStr(m.title)},`);
  lines.push(`    why:    ${jsStr(m.why)},`);
  lines.push(`    helps:  ${jsStr(m.helps)},`);
  lines.push(`    days: [`);
  m.days.forEach((d, di) => {
    const dc = di < m.days.length - 1 ? ',' : '';
    lines.push(`      ${jsStr(d)}${dc}`);
  });
  lines.push(`    ]`);
  lines.push(`  }${comma}`);
});

lines.push('};');

fs.writeFileSync(DEST, lines.join('\n') + '\n', 'utf8');

console.log(`✓ Wrote ${DEST}`);
console.log(`  Modules: ${keys.length}`);
keys.forEach(k => console.log(`    ${k}: ${modules[k].days.length} days`));

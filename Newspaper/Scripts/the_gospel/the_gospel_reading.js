/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · READING — Bible reading plans + streak heatmap.
   "Blessed is the one who reads aloud the words of this prophecy." — Revelation 1:3
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, sectionHead } from './the_gospel_shared.js';

export const name        = 'the_gospel_reading';
export const title       = 'Reading Plans';
export const description = 'Daily reading plans with a personal streak — keep your hand to the plow without losing your place.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6.5A2.5 2.5 0 0 1 4.5 4H10v16H4.5A2.5 2.5 0 0 1 2 17.5z"/><path d="M22 6.5A2.5 2.5 0 0 0 19.5 4H14v16h5.5a2.5 2.5 0 0 0 2.5-2.5z"/></svg>`;
export const accent      = '#059669';

let _oyb = [];   // one_year_bible bundle, loaded once

const _PS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const PLANS = [
  { id: 'm-pro',     title: 'Proverbs in a Month',        days: 31,  category: 'Wisdom',      color: '#b45309',
    description: 'A chapter of Proverbs for every day of the month.',
    svg: `<svg ${_PS}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>` },
  { id: 'gospels-90',title: 'Gospels in 90 Days',         days: 90,  category: 'Gospels',     color: '#1d4ed8',
    description: 'Walk through Matthew, Mark, Luke, and John in three months.',
    svg: `<svg ${_PS}><line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="9" x2="20" y2="9"/></svg>` },
  { id: 'psalms-150',title: 'Psalms in 150 Days',         days: 150, category: 'Psalms',      color: '#059669',
    description: 'A psalm a day for the seasons of the heart.',
    svg: `<svg ${_PS}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>` },
  { id: 'b-year',    title: 'The Bible in a Year',        days: 365, category: 'Whole Bible', color: '#7c3aed',
    description: 'A balanced OT/NT/Psalms reading every day for a full year.',
    svg: `<svg ${_PS}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>` },
  { id: 'nt-90',     title: 'New Testament in 90 Days',   days: 90,  category: 'NT',          color: '#4f46e5',
    description: 'A focused walk through the apostolic witness.',
    svg: `<svg ${_PS}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>` },
];

const STORAGE = 'tw_reading_progress';

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="reading">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-tabs" data-bind="tabs">
        <button class="grow-tab is-active" data-tab="reading">Reading</button>
        <button class="grow-tab" data-tab="plans">Plans</button>
      </div>

      <div data-bind="tab-reading">
        <div class="grow-oyb-today" data-bind="oyb-today"></div>
        <div class="grow-oyb-list" data-bind="oyb-list"></div>
      </div>

      <div data-bind="tab-plans" style="display:none">
        ${sectionHead('Your reading streak')}
        <div class="grow-streak" data-bind="streak"></div>
        ${sectionHead('Choose a plan')}
        <div class="grow-grid grow-grid--reading" data-bind="plans"></div>
        ${sectionHead('Today')}
        <div class="grow-today" data-bind="today"></div>
      </div>
    </section>
  `;
}

export async function mount(root) {
  // Load one-year-bible bundle once
  if (!_oyb.length) {
    try {
      const mod = await import('../../Data/one_year_bible.js');
      _oyb = mod.default || [];
    } catch (e) {
      console.error('[gospel/reading] one_year_bible bundle failed:', e);
    }
  }

  // Tab switching
  root.querySelectorAll('.grow-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('.grow-tab').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const tab = btn.getAttribute('data-tab');
      root.querySelector('[data-bind="tab-reading"]').style.display = tab === 'reading' ? '' : 'none';
      root.querySelector('[data-bind="tab-plans"]').style.display   = tab === 'plans'   ? '' : 'none';
    });
  });

  // ── Reading tab ──────────────────────────────────────────────────────
  _paintOYB(root);

  // ── Plans tab ────────────────────────────────────────────────────────
  const planEl   = root.querySelector('[data-bind="plans"]');
  const streakEl = root.querySelector('[data-bind="streak"]');
  const todayEl  = root.querySelector('[data-bind="today"]');
  const progress = _load();
  planEl.innerHTML   = PLANS.map((p) => _planCard(p, progress[p.id])).join('');
  streakEl.innerHTML = _renderStreak(progress);
  todayEl.innerHTML  = _renderToday(progress);

  planEl.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle');
      const p  = _load();
      p[id] = p[id] || { days: {}, started: new Date().toISOString() };
      const k = new Date().toISOString().slice(0, 10);
      p[id].days[k] = !p[id].days[k];
      _save(p);
      planEl.innerHTML   = PLANS.map((pl) => _planCard(pl, p[pl.id])).join('');
      streakEl.innerHTML = _renderStreak(p);
      todayEl.innerHTML  = _renderToday(p);
      planEl.querySelectorAll('[data-toggle]').forEach((b2) => {
        b2.addEventListener('click', () => {}); // re-bind handled by outer listener
      });
    });
  });

  return () => {};
}

// ── Bible.com URL builder (ESV version 59) ───────────────────────────────
const _BC = {
  'genesis':'GEN','exodus':'EXO','leviticus':'LEV','numbers':'NUM','deuteronomy':'DEU',
  'joshua':'JOS','judges':'JDG','ruth':'RUT',
  '1 samuel':'1SA','2 samuel':'2SA','1 kings':'1KI','2 kings':'2KI',
  '1 chronicles':'1CH','2 chronicles':'2CH','ezra':'EZR','nehemiah':'NEH','esther':'EST',
  'job':'JOB','psalm':'PSA','psalms':'PSA','proverbs':'PRO','ecclesiastes':'ECC',
  'song of solomon':'SNG','song of songs':'SNG','isaiah':'ISA','jeremiah':'JER',
  'lamentations':'LAM','ezekiel':'EZK','daniel':'DAN','hosea':'HOS','joel':'JOL',
  'amos':'AMO','obadiah':'OBA','jonah':'JON','micah':'MIC','nahum':'NAM',
  'habakkuk':'HAB','zephaniah':'ZEP','haggai':'HAG','zechariah':'ZEC','malachi':'MAL',
  'matthew':'MAT','mark':'MRK','luke':'LUK','john':'JHN','acts':'ACT','romans':'ROM',
  '1 corinthians':'1CO','2 corinthians':'2CO','galatians':'GAL','ephesians':'EPH',
  'philippians':'PHP','colossians':'COL','1 thessalonians':'1TH','2 thessalonians':'2TH',
  '1 timothy':'1TI','2 timothy':'2TI','titus':'TIT','philemon':'PHM','hebrews':'HEB',
  'james':'JAS','1 peter':'1PE','2 peter':'2PE','1 john':'1JN','2 john':'2JN',
  '3 john':'3JN','jude':'JUD','revelation':'REV',
};

function _oybUrl(ref) {
  const s = ref.toLowerCase().replace(/[\u2013\u2014-]/g, '-').trim();
  const m = s.match(/^((?:[1-3]\s+)?)([a-z]+(?:\s+[a-z]+)*)\s+(\d+)/);
  if (!m) return null;
  const bookKey = ((m[1] || '').trim() + ' ' + m[2].trim()).replace(/^\s/, '').trim();
  const chapter = m[3];
  const code = _BC[bookKey] || _BC[m[2].trim()];
  if (!code) return null;
  return `https://www.bible.com/bible/59/${code}.${chapter}.1.ESV`;
}

// ── Stream SVG icons ──────────────────────────────────────────────────────
const _S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const _OYB_ICONS = {
  ot: `<svg ${_S}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  nt: `<svg ${_S}><line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="9" x2="20" y2="9"/></svg>`,
  ps: `<svg ${_S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
  pr: `<svg ${_S}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 1 7 7c0 2.6-1.4 4.8-3.5 6.1L15 17H9l-.5-1.9C6.4 13.8 5 11.6 5 9a7 7 0 0 1 7-7z"/></svg>`,
};

// ── One Year Bible rendering ──────────────────────────────────────────────
function _todayDayNumber() {
  const now  = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now - start) / 86400000) + 1; // 1-based day of year
}

function _paintOYB(root) {
  const todayEl = root.querySelector('[data-bind="oyb-today"]');
  const listEl  = root.querySelector('[data-bind="oyb-list"]');
  if (!_oyb.length) {
    todayEl.innerHTML = `<p class="grow-muted">Reading plan not loaded.</p>`;
    return;
  }
  const dayNum = _todayDayNumber();
  const entry  = _oyb.find((e) => e.day === dayNum) || _oyb[0];

  todayEl.innerHTML = _oybTodayCard(entry);
  listEl.innerHTML  = _oybFullList();

  // Expand/collapse full list
  const toggleBtn = root.querySelector('[data-oyb-toggle]');
  const fullList  = root.querySelector('[data-oyb-full]');
  if (toggleBtn && fullList) {
    toggleBtn.addEventListener('click', () => {
      const open = fullList.style.display !== 'none';
      fullList.style.display = open ? 'none' : '';
      toggleBtn.textContent  = open ? 'See all 365 days ▼' : 'Collapse ▲';
    });
  }
}

function _oybTodayCard(e) {
  const pct  = Math.round((e.day / 365) * 100);
  const streams = [
    { key: 'ot', label: 'Old Testament', val: e.ot, color: '#b45309' },
    { key: 'nt', label: 'New Testament', val: e.nt, color: '#1d4ed8' },
    { key: 'ps', label: 'Psalms',        val: e.ps, color: '#059669' },
    { key: 'pr', label: 'Proverbs',      val: e.pr, color: '#7c3aed' },
  ].filter((s) => s.val);

  const cards = streams.map((s) => {
    const url = _oybUrl(s.val);
    const tag  = url ? 'a' : 'div';
    const attrs = url ? ` href="${url}" target="_blank" rel="noopener noreferrer"` : '';
    return `<${tag} class="oyb-stream-card" style="--sc:${s.color}"${attrs}>
      <span class="oyb-stream-icon" aria-hidden="true">${_OYB_ICONS[s.key]}</span>
      <span class="oyb-stream-body">
        <span class="oyb-stream-label">${s.label}</span>
        <span class="oyb-stream-ref">${esc(s.val)}</span>
      </span>
      ${url ? '<span class="oyb-stream-arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><path d="M7 17L17 7"/><path d="M7 7h10v10"/></svg></span>' : ''}
    </${tag}>`;
  }).join('');

  return /* html */`
    <div class="oyb-day-banner">
      <div class="oyb-day-info">
        <span class="oyb-day-pill">Day ${e.day}</span>
        <span class="oyb-day-of">of 365</span>
        <span class="oyb-day-date">${esc(e.date)}</span>
      </div>
      <div class="oyb-progress-track" title="${pct}% through the year">
        <div class="oyb-progress-fill" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="oyb-stream-list">${cards}</div>
    <div style="text-align:center; margin: 14px 0 2px;">
      <button class="grow-btn grow-btn--ghost" data-oyb-toggle style="font-size:13px; padding:8px 20px;">See all 365 days ▼</button>
    </div>
  `;
}

function _oybFullList() {
  if (!_oyb.length) return '';
  const rows = _oyb.map((e) => `
    <tr class="grow-oyb-row">
      <td class="grow-oyb-col-day">${e.day}</td>
      <td class="grow-oyb-col-date">${esc(e.date)}</td>
      <td class="grow-oyb-col-pass">${esc(e.ot)}</td>
      <td class="grow-oyb-col-pass">${esc(e.nt)}</td>
      <td class="grow-oyb-col-pass">${esc(e.ps)}</td>
      <td class="grow-oyb-col-pass">${esc(e.pr)}</td>
    </tr>
  `).join('');
  return /* html */`
    <div data-oyb-full style="display:none; overflow-x:auto; margin-top:8px;">
      <table class="grow-oyb-table">
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>Old Testament</th><th>New Testament</th><th>Psalm</th><th>Proverbs</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function _load() { try { return JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch (_) { return {}; } }
function _save(p) { try { localStorage.setItem(STORAGE, JSON.stringify(p)); } catch (_) {} }

function _planCard(p, prog) {
  const done = prog ? Object.values(prog.days || {}).filter(Boolean).length : 0;
  const pct  = Math.min(100, Math.round((done / p.days) * 100));
  const c    = p.color || accent;
  return /* html */`
    <article class="grow-plan-card" data-id="${esc(p.id)}" style="--pc:${c}">
      <div class="grow-plan-card-head">
        <span class="grow-plan-icon" aria-hidden="true">${p.svg || ''}</span>
        <div class="grow-plan-head-body">
          <span class="grow-plan-cat-pill">${esc(p.category)} · ${p.days}d</span>
          <h3 class="grow-plan-title">${esc(p.title)}</h3>
        </div>
      </div>
      <p class="grow-plan-desc">${esc(p.description)}</p>
      <div class="grow-plan-card-foot">
        <div class="grow-plan-prog">
          <div class="grow-plan-prog-track"><div class="grow-plan-prog-fill" style="width:${pct}%"></div></div>
          <span class="grow-plan-done">${done} / ${p.days} days</span>
        </div>
        <button class="grow-plan-mark" data-toggle="${esc(p.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>
          Mark today
        </button>
      </div>
    </article>
  `;
}

function _renderStreak(progress) {
  // 12-week heatmap (84 cells) — count any plan checked on the day.
  const cells = [];
  const today = new Date();
  let totalDays = 0;
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    let count = 0;
    for (const pid in progress) {
      if (progress[pid] && progress[pid].days && progress[pid].days[k]) count++;
    }
    if (count > 0) totalDays++;
    const lvl = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    cells.push(`<i class="grow-heat grow-heat--${lvl}" title="${k}: ${count} read"></i>`);
  }
  const label = totalDays === 0
    ? 'No days read in the last 12 weeks'
    : `${totalDays} day${totalDays !== 1 ? 's' : ''} read in the last 12 weeks`;
  return `<div class="grow-streak-wrap">
    <div class="grow-streak-label">${label}</div>
    <div class="grow-heat-grid">${cells.join('')}</div>
  </div>`;
}

function _renderToday(progress) {
  const k = new Date().toISOString().slice(0, 10);
  const today = PLANS.filter((p) => progress[p.id] && progress[p.id].days && progress[p.id].days[k]);
  if (!today.length) return `<p class="grow-muted">No reading checked off yet today.</p>`;
  return `<p class="grow-muted">✓ Today: ${today.map((p) => esc(p.title)).join(', ')}</p>`;
}

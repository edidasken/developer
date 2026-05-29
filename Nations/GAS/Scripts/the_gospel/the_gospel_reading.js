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

const PLANS = [
  { id: 'm-pro',     title: 'Proverbs in a Month',        days: 31,  category: 'Wisdom',     description: 'A chapter of Proverbs for every day of the month.' },
  { id: 'gospels-90',title: 'Gospels in 90 Days',         days: 90,  category: 'Gospels',    description: 'Walk through Matthew, Mark, Luke, and John in three months.' },
  { id: 'psalms-150',title: 'Psalms in 150 Days',         days: 150, category: 'Psalms',     description: 'A psalm a day for the seasons of the heart.' },
  { id: 'b-year',    title: 'The Bible in a Year',        days: 365, category: 'Whole Bible', description: 'A balanced OT/NT/Psalms reading every day for a full year.' },
  { id: 'nt-90',     title: 'New Testament in 90 Days',   days: 90,  category: 'NT',         description: 'A focused walk through the apostolic witness.' },
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

// ── One Year Bible rendering ──────────────────────────────────────────────
function _todayDayNumber() {
  const now  = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / 86400000) + 1; // 1-based day of year
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
  const streams = [
    { label: 'Old Testament', val: e.ot, color: '#c2410c', icon: '📜' },
    { label: 'New Testament', val: e.nt, color: '#1d4ed8', icon: '✝️' },
    { label: 'Psalms',        val: e.ps, color: '#059669', icon: '🎶' },
    { label: 'Proverbs',      val: e.pr, color: '#d97706', icon: '💡' },
  ].filter((s) => s.val);

  return /* html */`
    <div class="grow-oyb-hero">
      <div class="grow-oyb-hero-left">
        <div class="grow-oyb-hero-label">Today</div>
        <div class="grow-oyb-hero-day">Day ${e.day}</div>
        <div class="grow-oyb-hero-date">${esc(e.date)}</div>
      </div>
      <div class="grow-oyb-hero-streams">
        ${streams.map((s) => `
          <div class="grow-oyb-hero-stream">
            <span class="grow-oyb-hero-stream-label" style="--stream-color:${s.color}">${s.label}</span>
            <span class="grow-oyb-hero-stream-val">${esc(s.val)}</span>
          </div>
        `).join('')}
      </div>
    </div>
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
  const r    = 28; // circle radius
  const circ = 2 * Math.PI * r;
  const dash = circ - (pct / 100) * circ;
  return /* html */`
    <article class="grow-plan-card" data-id="${esc(p.id)}">
      <div class="grow-plan-card-top">
        <div class="grow-plan-ring">
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="${r}" fill="none" stroke="var(--border,rgba(255,255,255,.1))" stroke-width="6"/>
            <circle cx="36" cy="36" r="${r}" fill="none" stroke="${accent}" stroke-width="6"
              stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${dash.toFixed(1)}"
              stroke-linecap="round" transform="rotate(-90 36 36)"/>
          </svg>
          <span class="grow-plan-ring-pct">${pct}%</span>
        </div>
        <div class="grow-plan-info">
          <div class="grow-plan-cat">${esc(p.category)} · ${p.days} days</div>
          <h3 class="grow-plan-title">${esc(p.title)}</h3>
          <p class="grow-plan-desc">${esc(p.description)}</p>
        </div>
      </div>
      <div class="grow-plan-card-foot">
        <span class="grow-plan-done">${done} / ${p.days} days</span>
        <button class="grow-btn grow-btn--ghost" data-toggle="${esc(p.id)}" style="font-size:12px; padding:6px 14px;">✓ Mark today</button>
      </div>
    </article>
  `;
}

function _renderStreak(progress) {
  // 12-week heatmap (84 cells) — count any plan checked on the day.
  const cells = [];
  const today = new Date();
  for (let i = 83; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    let count = 0;
    for (const pid in progress) {
      if (progress[pid] && progress[pid].days && progress[pid].days[k]) count++;
    }
    const lvl = count === 0 ? 0 : count === 1 ? 1 : count === 2 ? 2 : 3;
    cells.push(`<i class="grow-heat grow-heat--${lvl}" title="${k}: ${count} read"></i>`);
  }
  return `<div class="grow-heat-grid">${cells.join('')}</div>`;
}

function _renderToday(progress) {
  const k = new Date().toISOString().slice(0, 10);
  const today = PLANS.filter((p) => progress[p.id] && progress[p.id].days && progress[p.id].days[k]);
  if (!today.length) return `<p class="grow-muted">No reading checked off yet today.</p>`;
  return `<p class="grow-muted">✓ Today: ${today.map((p) => esc(p.title)).join(', ')}</p>`;
}

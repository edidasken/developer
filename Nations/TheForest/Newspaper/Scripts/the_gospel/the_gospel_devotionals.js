/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · DEVOTIONALS — Daily devotions to feed the soul.
   "Man shall not live by bread alone, but by every word from God." — Matthew 4:4
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards } from './the_gospel_shared.js';

export const name        = 'the_gospel_devotionals';
export const title       = 'Devotionals';
export const description = 'Daily devotions — a passage of scripture, a reflection, a prayer. Feed the soul before the rush.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
export const accent      = '#b45309';

let _state = { rows: [], nations: [], expanded: new Set() };

/* ─── SVG Icons ───────────────────────────────────────────────────────────── */
const I = {
  book:     `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h5a2 2 0 0 1 2 2v9a1.5 1.5 0 0 0-1.5-1.5H2z"/><path d="M14 3H9a2 2 0 0 0-2 2v9a1.5 1.5 0 0 1 1.5-1.5H14z"/></svg>`,
  bulb:     `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5a4 4 0 0 1 2 7.4V11H6V8.9A4 4 0 0 1 8 1.5z"/><path d="M6.5 12h3m-2.5 1.5h2"/></svg>`,
  question: `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M6.5 6a1.7 1.7 0 0 1 3.2.8c0 1-1.5 1.5-1.7 2.5"/><circle cx="8" cy="12" r=".5" fill="currentColor" stroke="none"/></svg>`,
  pray:     `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 13.5C5.5 9.5 2.5 8 2.5 5a3 3 0 0 1 6 0"/><path d="M10.5 13.5C10.5 9.5 13.5 8 13.5 5a3 3 0 0 0-6 0"/><line x1="8" y1="5" x2="8" y2="13.5"/></svg>`,
  globe:    `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><line x1="2" y1="8" x2="14" y2="8"/><path d="M8 2a9 9 0 0 1 2.5 6A9 9 0 0 1 8 14 9 9 0 0 1 5.5 8 9 9 0 0 1 8 2z"/></svg>`,
  cross:    `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="1.5" x2="8" y2="14.5"/><line x1="2.5" y1="5.5" x2="13.5" y2="5.5"/></svg>`,
  window:   `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>`,
  calendar: `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="1.5" y="3" width="13" height="11.5" rx="1.5"/><line x1="1.5" y1="6.5" x2="14.5" y2="6.5"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg>`,
  tag:      `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2h5.5L14 8.5l-5.5 5.5L2 7.5V2z"/><circle cx="5" cy="5" r="1" fill="currentColor" stroke="none"/></svg>`,
  people:   `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2.2"/><path d="M1.5 14c0-2.5 2-4.2 4.5-4.2S10.5 11.5 10.5 14"/><circle cx="12" cy="5.5" r="1.8"/><path d="M14.5 14c0-2-1.4-3.4-2.7-3.6"/></svg>`,
  shield:   `<svg class="dv-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5 L14 4 L14 9C14 12.5 8 14.5 8 14.5C8 14.5 2 12.5 2 9L2 4Z"/></svg>`,
  star:     `<svg class="dv-ico" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5l1.7 3.5 3.8.55-2.75 2.68.65 3.78L8 10.27l-3.4 1.78.65-3.78L2.5 5.55 6.3 5z"/></svg>`,
};

/* ─── Theme → color map ───────────────────────────────────────────────────── */
const _THEME_COLORS = {
  boundaries:'#7c3aed', holiness:'#7c3aed',     pride:'#7c3aed',
  consequences:'#dc2626', urgency:'#dc2626',     bondage:'#dc2626',
  truth:'#2563eb', direction:'#2563eb',          character:'#2563eb', honesty:'#2563eb',
  fidelity:'#db2777', appreciation:'#db2777',
  diligence:'#d97706', sloth:'#d97706',          responsibility:'#d97706', foresight:'#d97706',
  peace:'#0891b2', resolution:'#0891b2',
  focus:'#059669', accountability:'#059669',     perspective:'#059669',
  'self-worth':'#8b5cf6', impulse:'#f59e0b',     habit:'#8b5cf6',
};
function _themeColor(theme) {
  return _THEME_COLORS[(theme || '').toLowerCase()] || '#b45309';
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function _todayISO() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function _dayOfYear() {
  const now = new Date();
  return Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 86400000);
}
function _readableDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('en-US',
      { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  } catch { return iso; }
}
function _shortDate(iso) {
  if (!iso) return { day:'--', month:'' };
  try {
    const d = new Date(iso + 'T12:00:00');
    return { day: d.getDate(), month: d.toLocaleDateString('en-US', { month:'short' }) };
  } catch { return { day: iso.slice(8,10), month:'' }; }
}
function _accessClass(level) {
  if (!level) return 'dv-badge--partial';
  const l = level.toLowerCase();
  if (l === 'open')                          return 'dv-badge--open';
  if (l === 'limited' || l === 'partial')    return 'dv-badge--limited';
  if (l.includes('hostile') || l === 'none') return 'dv-badge--hostile';
  return 'dv-badge--partial';
}
function _fmtPop(val) {
  if (!val) return '';
  const n = +val;
  if (isNaN(n)) return String(val);
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(0) + 'K';
  return String(n);
}
function _pct(val) {
  if (val == null || isNaN(+val)) return null;
  return (+val).toFixed(1) + '%';
}

/* ─── Render ──────────────────────────────────────────────────────────────── */
export function render() {
  return /* html */`
    <section class="grow-page" data-grow="devotionals">
      <style>
        /* ── Icons ── */
        .dv-ico { width:13px; height:13px; flex-shrink:0; display:inline-block; vertical-align:middle; }
        /* ── Today hero card ── */
        .dv-today { background:var(--surface-raised,#fff); border-radius:18px; border:1.5px solid rgba(180,83,9,.2); border-top:4px solid #b45309; padding:22px 22px 20px; margin:0 0 28px; box-shadow:0 3px 22px rgba(180,83,9,.1); }
        .dv-today-head { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
        .dv-today-dateline { display:inline-flex; align-items:center; gap:5px; font:600 0.78rem var(--font-ui); color:#b45309; letter-spacing:.04em; }
        .dv-today-dateline .dv-ico { color:#b45309; }
        .dv-theme-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 11px; border-radius:20px; font:700 0.65rem var(--font-ui); letter-spacing:.07em; text-transform:uppercase; border:1.5px solid currentColor; opacity:.85; }
        .dv-today-title { font:800 1.5rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 20px; line-height:1.22; }
        /* ── Section blocks ── */
        .dv-block { margin-bottom:16px; }
        .dv-block-head { display:flex; align-items:center; gap:6px; font:700 0.64rem var(--font-ui); letter-spacing:.14em; text-transform:uppercase; margin-bottom:9px; }
        /* ── Scripture ── */
        .dv-scripture-block { border-left:3px solid #b45309; padding:14px 18px; background:linear-gradient(90deg,rgba(180,83,9,.05),rgba(180,83,9,.01)); border-radius:0 10px 10px 0; }
        .dv-scripture-block .dv-block-head { color:#b45309; }
        .dv-scripture-block .dv-block-head .dv-ico { color:#b45309; }
        .dv-scripture-text { font:italic 1.04rem/1.72 Georgia,"Times New Roman",serif; color:var(--ink,#1a1d2e); margin:0; }
        /* ── Reflection ── */
        .dv-reflection-block .dv-block-head { color:#6366f1; }
        .dv-reflection-block .dv-block-head .dv-ico { color:#6366f1; }
        .dv-reflection-text { font:0.94rem/1.78 var(--font-body,sans-serif); color:var(--ink,#1a1d2e); margin:0; }
        /* ── Reflect question ── */
        .dv-question-block { background:rgba(99,102,241,.06); border:1.5px solid rgba(99,102,241,.18); border-radius:12px; padding:14px 16px; }
        .dv-question-block .dv-block-head { color:#6366f1; }
        .dv-question-block .dv-block-head .dv-ico { color:#6366f1; }
        .dv-question-text { font:italic 0.93rem/1.65 Georgia,"Times New Roman",serif; color:var(--ink,#1a1d2e); margin:0; }
        /* ── Prayer ── */
        .dv-prayer-block { background:linear-gradient(135deg,rgba(5,150,105,.07),rgba(5,150,105,.02)); border-left:3px solid #059669; border-radius:0 12px 12px 0; padding:14px 18px; }
        .dv-prayer-block .dv-block-head { color:#059669; }
        .dv-prayer-block .dv-block-head .dv-ico { color:#059669; }
        .dv-prayer-text { font:0.91rem/1.7 var(--font-ui); color:var(--ink,#1a1d2e); margin:0; }
        /* ── Mission of the Day ── */
        .dv-mission { background:linear-gradient(135deg,rgba(8,145,178,.06),rgba(8,145,178,.01)); border:1.5px solid rgba(8,145,178,.22); border-radius:16px; padding:18px 20px; margin:0 0 28px; }
        .dv-mission-head { display:flex; align-items:center; gap:6px; font:700 0.64rem var(--font-ui); letter-spacing:.14em; text-transform:uppercase; color:#0891b2; margin-bottom:14px; border-bottom:1px solid rgba(8,145,178,.15); padding-bottom:10px; }
        .dv-mission-head .dv-ico { color:#0891b2; }
        .dv-mission-body { display:flex; align-items:flex-start; gap:14px; }
        .dv-mission-flag { font-size:2.6rem; line-height:1; flex-shrink:0; }
        .dv-mission-info { flex:1; min-width:0; }
        .dv-mission-name { font:700 1.08rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 2px; }
        .dv-mission-region { font:0.74rem var(--font-ui); color:var(--ink-muted,#7a7f96); margin:0 0 10px; }
        .dv-mission-stats { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px; }
        .dv-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 9px; border-radius:12px; font:600 0.68rem var(--font-ui); letter-spacing:.03em; }
        .dv-badge--open    { background:#d1fae5; color:#065f46; }
        .dv-badge--partial { background:#fef3c7; color:#92400e; }
        .dv-badge--limited { background:#fee2e2; color:#991b1b; }
        .dv-badge--hostile { background:#1f2937; color:#f9fafb; }
        .dv-stat-pill { background:var(--surface,#f4f5f9); border-radius:20px; padding:2px 9px; font:0.68rem var(--font-ui); color:var(--ink-sub,#4a4f68); display:inline-flex; align-items:center; gap:3px; }
        .dv-window-tag { background:rgba(99,102,241,.1); color:#4338ca; border-radius:20px; padding:2px 9px; font:600 0.68rem var(--font-ui); display:inline-flex; align-items:center; gap:3px; }
        .dv-mission-prayer { font:italic 0.85rem/1.65 Georgia,"Times New Roman",serif; color:var(--ink,#1a1d2e); border-left:2px solid rgba(8,145,178,.35); padding:6px 12px; margin:0; }
        .dv-gratitude { display:flex; align-items:flex-start; gap:6px; font:0.78rem/1.5 var(--font-ui); color:#0891b2; margin-top:10px; padding:10px 12px; background:rgba(8,145,178,.07); border-radius:8px; }
        .dv-gratitude .dv-ico { color:#0891b2; flex-shrink:0; margin-top:1px; }
        /* ── Feed ── */
        .dv-feed { display:flex; flex-direction:column; gap:7px; }
        .dv-feed-card { background:var(--surface-raised,#fff); border-radius:12px; border:1.5px solid var(--line,#e5e7ef); overflow:hidden; transition:border-color .15s,box-shadow .15s; }
        .dv-feed-card:hover:not(.is-today) { border-color:rgba(180,83,9,.4); }
        .dv-feed-card.is-today { border-color:rgba(180,83,9,.5); background:#fffbf5; }
        .dv-feed-card.is-open { border-color:#b45309; box-shadow:0 2px 14px rgba(180,83,9,.1); }
        .dv-feed-summary { display:grid; grid-template-columns:58px 1fr 30px; align-items:stretch; background:none; border:none; cursor:pointer; width:100%; text-align:left; padding:0; }
        .dv-feed-date-col { padding:12px 8px; text-align:center; border-right:1px solid var(--line,#e5e7ef); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; flex-shrink:0; }
        .dv-feed-day { font:800 1.25rem var(--font-ui); color:var(--ink,#1a1d2e); line-height:1; }
        .dv-feed-month { font:0.57rem var(--font-ui); color:var(--ink-muted,#7a7f96); text-transform:uppercase; letter-spacing:.07em; }
        .dv-feed-card.is-today .dv-feed-day,
        .dv-feed-card.is-today .dv-feed-month { color:#b45309; }
        .dv-feed-card.is-today .dv-feed-date-col { background:rgba(180,83,9,.07); border-right-color:rgba(180,83,9,.2); }
        .dv-feed-content { padding:11px 13px; display:flex; flex-direction:column; justify-content:center; min-width:0; }
        .dv-feed-meta { display:flex; align-items:center; gap:6px; margin-bottom:3px; flex-wrap:wrap; }
        .dv-today-label { background:#b45309; color:#fff; border-radius:8px; padding:1px 7px; font:700 0.57rem var(--font-ui); letter-spacing:.05em; text-transform:uppercase; }
        .dv-feed-title { font:600 0.91rem var(--font-ui); color:var(--ink,#1a1d2e); margin:0 0 3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dv-feed-verse { font:0.76rem Georgia,"Times New Roman",serif; color:var(--ink-sub,#4a4f68); margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dv-feed-chevron-col { display:flex; align-items:center; justify-content:center; padding:0 10px; color:var(--ink-muted,#7a7f96); }
        .dv-feed-chevron-col svg { transition:transform .2s; }
        .dv-feed-card.is-open .dv-feed-chevron-col svg { transform:rotate(180deg); }
        /* ── Expanded body ── */
        .dv-feed-body { border-top:1px solid var(--line,#e5e7ef); padding:18px 20px 16px; background:var(--surface,#f9fafb); display:none; }
        .dv-feed-card.is-open .dv-feed-body { display:block; }
        .dv-feed-body .dv-block { margin-bottom:13px; }
        .dv-feed-body .dv-scripture-text { font-size:0.94rem; }
        .dv-feed-body .dv-reflection-text { font-size:0.88rem; }
        .dv-feed-body .dv-question-text { font-size:0.88rem; }
        .dv-feed-body .dv-prayer-text { font-size:0.88rem; }
      </style>
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>
      <div data-bind="root">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  return () => {};
}

/* ─── Data load ───────────────────────────────────────────────────────────── */
async function _load(root) {
  const view = root.querySelector('[data-bind="root"]');
  try {
    const [devoMod, missionsMod] = await Promise.all([
      import('../../Data/devotionals.js'),
      import('../../Data/missions.js').catch(() => ({ default: [] })),
    ]);
    _state.rows = (devoMod.default || []).slice().sort((a, b) => {
      const da = a.date || a.Date || '';
      const db = b.date || b.Date || '';
      return da.localeCompare(db); // ascending: earliest → latest
    });
    _state.nations = (missionsMod.default || [])
      .slice()
      .sort((a, b) => (a.countryName || '').localeCompare(b.countryName || ''));
  } catch (e) {
    console.error('[gospel/devotionals] load failed:', e);
    view.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load devotionals', body: String(e) });
    return;
  }
  if (!_state.rows.length) {
    view.innerHTML = emptyState({ icon: '🌅', title: 'No devotionals yet', body: 'Ask your shepherd to publish devotionals.' });
    return;
  }
  _paint(view);
}

/* ─── Paint ───────────────────────────────────────────────────────────────── */
function _paint(view) {
  const today = _todayISO();
  const d30 = new Date(); d30.setDate(d30.getDate() + 30);
  const p = n => String(n).padStart(2, '0');
  const future30 = `${d30.getFullYear()}-${p(d30.getMonth()+1)}-${p(d30.getDate())}`;

  // Today's devotional: exact match or most recent on/before today
  const todayDevo = _state.rows.find(d => (d.date || d.Date || '') === today)
    || [..._state.rows].reverse().find(d => (d.date || d.Date || '') <= today)
    || _state.rows[0];

  // Feed: today through next 30 days
  const feed = _state.rows.filter(d => {
    const dt = d.date || d.Date || '';
    return dt >= today && dt <= future30;
  });

  // Nation of the day
  const nation = _state.nations.length
    ? _state.nations[_dayOfYear() % _state.nations.length]
    : null;

  view.innerHTML = /* html */`
    <div class="grow-section-head">
      <span class="grow-section-title">Today's Devotion</span>
    </div>
    ${_todayCard(todayDevo)}
    ${nation ? _missionOfDay(nation) : ''}
    <div class="grow-section-head" style="margin-top:4px">
      <span class="grow-section-title">30-Day Devotional Plan</span>
    </div>
    <div class="dv-feed">
      ${feed.map(d => _feedCard(d, (d.date || d.Date || '') === today)).join('')}
    </div>
  `;

  // Wire accordion
  view.querySelectorAll('.dv-feed-card').forEach(card => {
    card.querySelector('.dv-feed-summary').addEventListener('click', () => {
      const id = card.dataset.id;
      if (_state.expanded.has(id)) {
        _state.expanded.delete(id);
        card.classList.remove('is-open');
      } else {
        _state.expanded.add(id);
        card.classList.add('is-open');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });
}

/* ─── Today hero card ─────────────────────────────────────────────────────── */
function _todayCard(d) {
  if (!d) return `<div style="padding:20px;color:var(--ink-muted)">No devotional for today yet.</div>`;
  const date       = _readableDate(d.date || d.Date);
  const theme      = d.theme || d.Theme || '';
  const ttl        = d.title || d.Title || "Today's Devotional";
  const scripture  = d.scripture || d.Scripture || '';
  const reflection = d.reflection || d.Reflection || '';
  const question   = d.question || d.Question || '';
  const prayer     = d.prayer || d.Prayer || '';
  const themeColor = _themeColor(theme);

  return /* html */`
    <div class="dv-today">
      <div class="dv-today-head">
        <span class="dv-today-dateline">${I.calendar} ${esc(date)}</span>
        ${theme ? `<span class="dv-theme-chip" style="color:${themeColor}">${I.tag} ${esc(theme)}</span>` : ''}
      </div>
      <h2 class="dv-today-title">${esc(ttl)}</h2>

      ${scripture ? /* html */`
        <div class="dv-block dv-scripture-block">
          <div class="dv-block-head">${I.book} Scripture</div>
          <p class="dv-scripture-text">"${esc(scripture)}"</p>
        </div>` : ''}

      ${reflection ? /* html */`
        <div class="dv-block dv-reflection-block">
          <div class="dv-block-head">${I.bulb} Reflection</div>
          <p class="dv-reflection-text">${esc(reflection)}</p>
        </div>` : ''}

      ${question ? /* html */`
        <div class="dv-block dv-question-block">
          <div class="dv-block-head">${I.question} Reflect</div>
          <p class="dv-question-text">${esc(question)}</p>
        </div>` : ''}

      ${prayer ? /* html */`
        <div class="dv-block dv-prayer-block" style="margin-bottom:0">
          <div class="dv-block-head">${I.pray} Prayer</div>
          <p class="dv-prayer-text">${esc(prayer)}</p>
        </div>` : ''}
    </div>
  `;
}

/* ─── Mission of the Day ──────────────────────────────────────────────────── */
function _missionOfDay(n) {
  const prayer    = (n.owPrayerChallenges || [])[0] || '';
  const evPct     = _pct(n.evangelicalPercent);
  const unreached = n.unreachedGroups   != null ? n.unreachedGroups   : null;
  const total     = n.totalPeopleGroups != null ? n.totalPeopleGroups : null;
  const perLabel  = n.persecutionLabel  || n.persecutionLevel || '';

  const gratitudeParts = [];
  if (unreached != null && total != null)
    gratitudeParts.push(`${unreached} of ${total} people groups in ${esc(n.countryName)} are still unreached`);
  else if (unreached != null)
    gratitudeParts.push(`${unreached} unreached people groups remain in ${esc(n.countryName)}`);
  if (n.population)  gratitudeParts.push(`a nation of ${_fmtPop(n.population)} souls`);
  if (evPct)         gratitudeParts.push(`only ${evPct} Evangelical`);
  const gratitudeText = gratitudeParts.length
    ? gratitudeParts.join(' — ') + '. We have so much to be grateful for.'
    : '';

  return /* html */`
    <div class="dv-mission">
      <div class="dv-mission-head">${I.globe} Mission of the Day — Pray for the World</div>
      <div class="dv-mission-body">
        <span class="dv-mission-flag">${n.icon || '🌍'}</span>
        <div class="dv-mission-info">
          <div class="dv-mission-name">${esc(n.countryName)}</div>
          <div class="dv-mission-region">${esc(n.region || '')}</div>
          <div class="dv-mission-stats">
            ${n.gospelAccess   ? `<span class="dv-badge ${_accessClass(n.gospelAccess)}">${esc(n.gospelAccess)} Access</span>` : ''}
            ${n.tenFortyWindow ? `<span class="dv-window-tag">${I.window} 10/40 Window</span>` : ''}
            ${evPct            ? `<span class="dv-stat-pill">${I.cross} ${evPct} Evangelical</span>` : ''}
            ${unreached != null ? `<span class="dv-stat-pill">${I.people} ${unreached}${total ? '/'+total : ''} Unreached Groups</span>` : ''}
            ${perLabel         ? `<span class="dv-stat-pill" style="background:rgba(220,38,38,.07);color:#991b1b">${I.shield} ${esc(perLabel)}</span>` : ''}
          </div>
          ${prayer ? `<blockquote class="dv-mission-prayer">${esc(prayer)}</blockquote>` : ''}
          ${gratitudeText ? `<div class="dv-gratitude">${I.star} ${gratitudeText}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/* ─── Feed card ───────────────────────────────────────────────────────────── */
function _feedCard(d, isToday) {
  const id         = String(d._id || d.date || Math.random());
  const date       = d.date || d.Date || '';
  const { day, month } = _shortDate(date);
  const theme      = d.theme || d.Theme || '';
  const ttl        = d.title || d.Title || 'Devotional';
  const scripture  = d.scripture || d.Scripture || '';
  const reflection = d.reflection || d.Reflection || '';
  const question   = d.question || d.Question || '';
  const prayer     = d.prayer || d.Prayer || '';
  const themeColor = _themeColor(theme);
  // Today's card starts open
  const isOpen     = isToday || _state.expanded.has(id);
  if (isOpen) _state.expanded.add(id);

  return /* html */`
    <div class="dv-feed-card${isToday ? ' is-today' : ''}${isOpen ? ' is-open' : ''}" data-id="${esc(id)}">
      <button class="dv-feed-summary" type="button" aria-expanded="${isOpen}">
        <div class="dv-feed-date-col">
          <span class="dv-feed-day">${day}</span>
          <span class="dv-feed-month">${esc(month)}</span>
        </div>
        <div class="dv-feed-content">
          <div class="dv-feed-meta">
            ${isToday ? '<span class="dv-today-label">Today</span>' : ''}
            ${theme ? `<span class="dv-theme-chip" style="color:${themeColor};font-size:.58rem;padding:1px 8px">${esc(theme)}</span>` : ''}
          </div>
          <div class="dv-feed-title">${esc(ttl)}</div>
          ${scripture ? `<p class="dv-feed-verse">${esc(snip(scripture, 90))}</p>` : ''}
        </div>
        <div class="dv-feed-chevron-col">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
        </div>
      </button>
      <div class="dv-feed-body">
        ${scripture ? /* html */`
          <div class="dv-block dv-scripture-block">
            <div class="dv-block-head">${I.book} Scripture</div>
            <p class="dv-scripture-text">"${esc(scripture)}"</p>
          </div>` : ''}
        ${reflection ? /* html */`
          <div class="dv-block dv-reflection-block">
            <div class="dv-block-head">${I.bulb} Reflection</div>
            <p class="dv-reflection-text">${esc(reflection)}</p>
          </div>` : ''}
        ${question ? /* html */`
          <div class="dv-block dv-question-block">
            <div class="dv-block-head">${I.question} Reflect</div>
            <p class="dv-question-text">${esc(question)}</p>
          </div>` : ''}
        ${prayer ? /* html */`
          <div class="dv-block dv-prayer-block" style="margin-bottom:0">
            <div class="dv-block-head">${I.pray} Prayer</div>
            <p class="dv-prayer-text">${esc(prayer)}</p>
          </div>` : ''}
      </div>
    </div>
  `;
}

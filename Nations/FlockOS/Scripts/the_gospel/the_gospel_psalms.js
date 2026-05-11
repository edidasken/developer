/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · PSALMS — Browse all 150 psalms by theme or number.
   "I will sing to the LORD as long as I live." — Psalm 104:33
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc } from './the_gospel_shared.js';

export const name        = 'the_gospel_psalms';
export const title       = 'Psalms';
export const description = 'Browse all 150 psalms by theme or numeric order — praise, lament, trust, wisdom, and more.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
export const accent      = '#7c3aed';

const THEME_COLORS = {
  'Praise': '#f59e0b', 'Lament': '#6b7280', 'Thanksgiving': '#10b981',
  'Trust': '#3b82f6', 'Messianic': '#8b5cf6', 'Wisdom': '#84cc16',
  'Imprecatory': '#ef4444', 'Royal': '#f97316', 'Pilgrimage': '#06b6d4',
  'Creation': '#22c55e', 'Penitential': '#ec4899',
};

function _themeColor(t) {
  for (const k in THEME_COLORS) { if (t.indexOf(k) !== -1) return THEME_COLORS[k]; }
  return '#6366f1';
}

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="psalms">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search psalms…" type="search">
        <div class="grow-filters">
          <button class="grow-filter is-active" data-v="theme">By Theme</button>
          <button class="grow-filter" data-v="number">By Number</button>
        </div>
      </div>

      <div class="grow-list" data-bind="grid">
        <div style="padding:40px;text-align:center;color:var(--ink-muted);">Loading psalms…</div>
      </div>
    </section>
  `;
}

export function mount(root) {
  const gridEl = root.querySelector('[data-bind="grid"]');
  const qEl    = root.querySelector('[data-q]');
  let _view    = 'theme';
  let _q       = '';
  let _data    = null;

  function _paint() {
    if (!_data) return;
    const { byNumber, byTheme } = _data;
    const q = _q.toLowerCase();

    let html = '';
    if (_view === 'theme') {
      byTheme.forEach(section => {
        const color      = _themeColor(section.theme);
        const searchText = (section.theme + ' ' + (section.intro || '') + ' ' +
          section.psalms.map(p => p.number + ' ' + p.title).join(' ')).toLowerCase();
        if (q && searchText.indexOf(q) === -1) return;
        html += `<details style="margin-bottom:8px;border:1px solid var(--line);border-radius:8px;overflow:hidden;">`;
        html += `<summary style="padding:12px 16px;background:var(--bg-raised);cursor:pointer;
font-weight:700;font-size:0.88rem;border-left:4px solid ${color};display:flex;align-items:center;gap:8px;">
${esc(section.theme)} <span style="font-size:0.75rem;color:var(--ink-muted);font-weight:400;">(&times;${section.psalms.length})</span></summary>`;
        html += `<div style="padding:14px 16px;">`;
        if (section.intro) {
          html += `<div style="background:var(--bg-raised);border-radius:6px;padding:8px 12px;
margin-bottom:12px;font-size:0.8rem;font-style:italic;color:var(--ink-muted);">${esc(section.intro)}</div>`;
        }
        html += `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">`;
        section.psalms.forEach(p => {
          html += `<span style="display:inline-block;padding:3px 10px;border-radius:12px;
background:${color}22;border:1px solid ${color}55;font-size:0.78rem;font-weight:600;color:var(--ink);"
title="${esc(p.title)}">¶ ${esc(p.display)}</span>`;
        });
        html += `</div>`;
        section.psalms.forEach(p => {
          html += `<div style="padding:6px 0;border-top:1px solid var(--line);display:flex;gap:8px;align-items:baseline;">
<span style="font-weight:700;font-size:0.8rem;min-width:40px;color:${color};">¶ ${esc(p.display)}</span>
<span style="font-size:0.82rem;color:var(--ink-muted);">${esc(p.title)}</span></div>`;
        });
        html += `</div></details>`;
      });
    } else {
      byNumber.forEach(p => {
        const searchText = (p.number + ' ' + p.display + ' ' + p.types.join(' ') + ' ' + p.title).toLowerCase();
        if (q && searchText.indexOf(q) === -1) return;
        const typeHtml = p.types.map(t => {
          const c = _themeColor(t);
          return `<span style="font-size:0.72rem;padding:2px 7px;border-radius:10px;
background:${c}22;border:1px solid ${c}55;color:var(--ink);white-space:nowrap;">${esc(t)}</span>`;
        }).join('');
        html += `<div style="padding:10px 14px;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;">
<span style="font-weight:700;font-size:0.85rem;min-width:70px;color:${accent};">Psalm ${esc(p.display)}</span>
<span style="font-size:0.85rem;flex:1;">${esc(p.title)}</span>
${typeHtml ? `<span style="display:flex;gap:4px;flex-wrap:wrap;">${typeHtml}</span>` : ''}
</div>`;
      });
    }

    if (!html) {
      html = `<div style="padding:40px;text-align:center;color:var(--ink-muted);">No psalms matched your search.</div>`;
    }
    gridEl.innerHTML = html;
  }

  // Filter buttons
  root.querySelectorAll('[data-v]').forEach(btn => {
    btn.addEventListener('click', () => {
      root.querySelectorAll('[data-v]').forEach(x => x.classList.remove('is-active'));
      btn.classList.add('is-active');
      _view = btn.dataset.v;
      _paint();
    });
  });

  // Search
  qEl.addEventListener('input', () => { _q = qEl.value.trim(); _paint(); });

  // Load data bundle
  import('../../Data/psalms.js').then(mod => {
    _data = mod.default || {};
    _paint();
  }).catch(() => {
    gridEl.innerHTML = `<div style="padding:40px;text-align:center;color:var(--ink-muted);">Psalms data could not be loaded.</div>`;
  });

  return () => {};
}

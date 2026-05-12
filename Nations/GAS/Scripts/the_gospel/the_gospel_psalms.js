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
          <button class="grow-filter" data-v="theme">By Theme</button>
          <button class="grow-filter is-active" data-v="number">By Number</button>
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
  let _view    = 'number';
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
        html += `<div class="grow-psalm-section" style="--psalm-color:${color}">`;
        html += `<button class="grow-psalm-head" type="button" onclick="(function(btn){var sec=btn.closest('.grow-psalm-section');var open=sec.classList.toggle('is-open');sec.querySelector('.grow-psalm-body').hidden=!open;})(this)">`;
        html += `<span class="grow-psalm-label"><span class="grow-psalm-theme">${esc(section.theme)}</span><span class="grow-psalm-count">${section.psalms.length} psalm${section.psalms.length !== 1 ? 's' : ''}</span></span>`;
        html += `<svg class="grow-psalm-chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>`;
        html += `</button>`;
        html += `<div class="grow-psalm-body" hidden>`;
        if (section.intro) html += `<p class="grow-psalm-intro">${esc(section.intro)}</p>`;
        html += `<div class="grow-psalm-chips">`;
        section.psalms.forEach(p => {
          html += `<span class="grow-psalm-chip" title="${esc(p.title)}">¶ ${esc(p.display)}</span>`;
        });
        html += `</div><div class="grow-psalm-rows">`;
        section.psalms.forEach(p => {
          html += `<div class="grow-psalm-row"><span class="grow-psalm-num">¶ ${esc(p.display)}</span><span class="grow-psalm-title">${esc(p.title)}</span></div>`;
        });
        html += `</div></div></div>`;
      });
    } else {
      html += `<div class="grow-psalm-number-list">`;
      byNumber.forEach(p => {
        const searchText = (p.number + ' ' + p.display + ' ' + p.types.join(' ') + ' ' + p.title).toLowerCase();
        if (q && searchText.indexOf(q) === -1) return;
        const typeHtml = p.types.map(t => {
          return `<span class="grow-psalm-type" style="--type-color:${_themeColor(t)}">${esc(t)}</span>`;
        }).join('');
        const bibleUrl = `https://www.bible.com/bible/59/PSA.${p.number}.ESV`;
        html += `<div class="grow-psalm-row grow-psalm-row--num" style="--psalm-color:${_themeColor(p.types[0] || '')}">`;
        html += `<a class="grow-psalm-num grow-psalm-num--link" href="${bibleUrl}" target="_blank" rel="noopener noreferrer" title="Read Psalm ${esc(p.display)} on Bible.com (ESV)">Psalm ${esc(p.display)}</a>`;
        html += `<span class="grow-psalm-title grow-psalm-title--num">${esc(p.title)}</span>`;
        if (typeHtml) html += `<div class="grow-psalm-types">${typeHtml}</div>`;
        html += `</div>`;
      });
      html += `</div>`;
    }

    if (!html || html === '<div class="grow-psalm-number-list"></div>') {
      html = `<p class="grow-muted" style="padding:30px;text-align:center;">No psalms matched your search.</p>`;
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
    gridEl.innerHTML = `<p class="grow-muted" style="padding:30px;text-align:center;">Psalms data could not be loaded.</p>`;
  });

  return () => {};
}

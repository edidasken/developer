/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · SERMONS — Church sermons marked as Preached.
   "Faith comes from hearing, and hearing through the word of Christ." — Romans 10:17
   ══════════════════════════════════════════════════════════════════════════════ */

import {
  esc, snip, emptyState, loadingCards, chip,
} from './the_gospel_shared.js';

export const name        = 'the_gospel_sermons';
export const title       = 'Sermons';
export const description = 'Messages preached from the pulpit — search by series, preacher, or scripture.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
export const accent      = '#7c3aed';

let _sermons = [];

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="sermons">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <input type="search" class="grow-search" data-bind="search" placeholder="🔍 Search sermons, series, scripture…" />
      <div class="grow-grid grow-grid--sermons" data-bind="grid">${loadingCards(6)}</div>
    </section>
  `;
}

export function mount(root) {
  _load(root);
  const search = root.querySelector('[data-bind="search"]');
  if (search) {
    search.addEventListener('input', () => {
      const q = search.value.toLowerCase().trim();
      root.querySelectorAll('.sermon-card').forEach((el) => {
        const hay = (el.dataset.search || '').toLowerCase();
        el.style.display = !q || hay.includes(q) ? '' : 'none';
      });
    });
  }
  return () => {};
}

async function _load(root) {
  const grid = root.querySelector('[data-bind="grid"]');
  _sermons = [];

  try {
    // UpperRoom is available in the authenticated FlockOS context
    if (typeof UpperRoom !== 'undefined' && typeof UpperRoom.listSermons === 'function') {
      const res = await UpperRoom.listSermons({ status: 'Preached', limit: 100 });
      _sermons = Array.isArray(res) ? res : (res && res.rows ? res.rows : []);
    }
  } catch (e) {
    console.error('[gospel/sermons] UpperRoom load failed:', e);
  }

  if (!_sermons.length) {
    grid.innerHTML = emptyState({ icon: '📖', title: 'No sermons preached yet', body: 'Sermons will appear here once they are marked as Preached in the church management system.' });
    return;
  }

  grid.innerHTML = _sermons.map(_card).join('');
}

function _card(s) {
  const title    = esc(s.title || 'Untitled Sermon');
  const rawDate  = s.deliveredDate || s.date;
  const date     = rawDate ? new Date(rawDate.seconds ? rawDate.seconds * 1000 : rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const preacher = esc(s.preacher || s.speaker || '');
  const series   = esc(s.seriesName || s.series || '');
  const scripture = esc(s.scripture || s.scriptureRef || '');
  const summary  = esc(snip(s.notes || '', 160));
  const searchText = [title, preacher, series, scripture, summary].join(' ').toLowerCase();

  return /* html */`
    <article class="grow-card sermon-card" data-search="${searchText}" style="--grow-accent:${accent};">
      <div class="grow-card-body" style="padding:16px;">
        <div class="grow-card-tags" style="margin-bottom:8px;">
          ${date ? chip(date, 'neutral') : ''}
          ${series ? chip(series, 'topic') : ''}
        </div>
        <h3 class="grow-card-title" style="font-size:1rem;margin-bottom:4px;">${title}</h3>
        ${preacher ? `<p style="font-size:.8rem;color:var(--ink-muted);margin:0 0 6px;">${preacher}</p>` : ''}
        ${scripture ? `<p style="font-size:.78rem;color:var(--accent);font-weight:600;margin:0 0 8px;">${scripture}</p>` : ''}
        ${summary ? `<p class="grow-card-desc">${summary}</p>` : ''}
      </div>
    </article>
  `;
}

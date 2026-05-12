/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · LIBRARY — A guided tour of the 66 books.
   "All Scripture is breathed out by God." — 2 Timothy 3:16
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, sectionHead, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_library';
export const title       = 'The Word';
export const description = 'A guided tour of the 66 books — author, summary, theology, and how each book points to Christ.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V6a2 2 0 0 1 2-2h13v15"/><path d="M6 17h13"/><path d="M6 21h13a2 2 0 0 0 0-4H6a2 2 0 0 0 0 4z"/></svg>`;
export const accent      = '#9333ea';

let _state = { rows: [], selected: null, test: 'all', q: '' };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="library">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search a book…" type="search">
        <div class="grow-filters">
          <button class="grow-filter is-active" data-t="all">All 66</button>
          <button class="grow-filter" data-t="ot">Old Testament</button>
          <button class="grow-filter" data-t="nt">New Testament</button>
        </div>
      </div>

      <div class="grow-split grow-split--lib">
        <aside class="grow-split-aside">
          <div class="grow-book-list" data-bind="list"></div>
        </aside>
        <article class="grow-split-main" data-bind="detail">
          <p class="grow-muted">Pick a book to read its summary, key theology, and where it leads in the story of redemption.</p>
        </article>
      </div>
    </section>
  `;
}

export function mount(root) {
  const qEl = root.querySelector('[data-q]');
  qEl.addEventListener('input', () => { _state.q = qEl.value.trim().toLowerCase(); _paint(root); });
  root.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => {
    root.querySelectorAll('[data-t]').forEach((x) => x.classList.remove('is-active'));
    b.classList.add('is-active');
    _state.test = b.dataset.t;
    _paint(root);
  }));
  _load(root);
  return () => {};
}

async function _load(root) {
  try {
    const mod = await import('../../Data/books-of-the-bible.js');
    _state.rows = (mod.default || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  } catch (e) {
    console.error('[gospel/library] static bundle failed:', e);
    _state.rows = [];
  }
  _paint(root);
}

function _filtered() {
  return _state.rows.filter((b) => {
    if (_state.test !== 'all') {
      const t = (b.testament || '').toLowerCase();
      if (_state.test === 'ot' && !t.startsWith('old')) return false;
      if (_state.test === 'nt' && !t.startsWith('new')) return false;
    }
    if (_state.q) {
      const hay = (b.bookName + ' ' + b.summary + ' ' + b.genre + ' ' + (b.themes || '') + ' ' + (b.author || '')).toLowerCase();
      if (!hay.includes(_state.q)) return false;
    }
    return true;
  });
}

function _shortGenre(g) {
  if (!g) return '';
  const m = g.match(/\(([^)]+)\)/);
  return (m ? m[1] : g).replace(/^The /, '');
}

function _paint(root) {
  const list = _filtered();
  const listEl = root.querySelector('[data-bind="list"]');
  if (!list.length) { listEl.innerHTML = emptyState({ icon: '📖', title: 'No matches' }); return; }
  listEl.innerHTML = list.map((b) => `
    <button class="grow-book-row ${_state.selected === b.bookName ? 'is-active' : ''}" data-b="${esc(b.bookName)}">
      <span class="grow-book-name">${esc(b.bookName)}</span>
      <span class="grow-book-genre">${esc(_shortGenre(b.genre))}</span>
    </button>
  `).join('');
  listEl.querySelectorAll('[data-b]').forEach((btn) => btn.addEventListener('click', () => {
    _state.selected = btn.getAttribute('data-b');
    _paint(root); _paintDetail(root);
  }));
  _paintDetail(root);
}

function _paintDetail(root) {
  const det = root.querySelector('[data-bind="detail"]');
  if (!_state.selected) return;
  const b = _state.rows.find((x) => x.bookName === _state.selected);
  if (!b) return;
  const genre = _shortGenre(b.genre);
  det.innerHTML = /* html */`
    <h2 class="grow-detail-title">${esc(b.bookName)}</h2>
    <div class="grow-lex-meta">
      ${b.testament ? chip(b.testament + ' Testament', 'level') : ''}
      ${genre       ? chip(genre, 'topic') : ''}
      ${b.author    ? `<span class="grow-chip grow-chip--ref">\u270F\uFE0F ${esc(b.author)}</span>` : ''}
    </div>
    ${b.timePeriod  ? `<p class="grow-detail-meta">\uD83D\uDD50 ${esc(b.timePeriod)}</p>` : ''}
    ${b.keyVerse    ? `<blockquote class="grow-detail-quote">${esc(b.keyVerse)}</blockquote>` : ''}
    ${b.summary     ? `<h4 class="grow-detail-h4">Summary</h4><p class="grow-detail-body">${esc(b.summary)}</p>` : ''}
    ${b.themes      ? `<h4 class="grow-detail-h4">Themes</h4><p class="grow-detail-body">${esc(b.themes)}</p>` : ''}
    ${b.christInBook? `<h4 class="grow-detail-h4">Christ in This Book</h4><p class="grow-detail-body">${esc(b.christInBook)}</p>` : ''}
    ${b.application ? `<h4 class="grow-detail-h4">Application</h4><p class="grow-detail-body">${esc(b.application)}</p>` : ''}
  `;
}

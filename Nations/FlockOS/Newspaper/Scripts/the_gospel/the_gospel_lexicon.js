/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · LEXICON — Greek & Hebrew word study.
   "Your word is a lamp to my feet and a light to my path." — Psalm 119:105
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, chip } from './the_gospel_shared.js';
import GREEK from '../../Data/strongs-greek.js';
import HEBREW from '../../Data/strongs-hebrew.js';

export const name        = 'the_gospel_lexicon';
export const title       = 'Lexicon';
export const description = 'Greek & Hebrew word study — meaning, transliteration, Strong\'s number, and where the word appears.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 4v13a3 3 0 0 0 3 3"/><path d="M9 8h6"/></svg>`;
export const accent      = '#0891b2';

let _state = { rows: [], q: '', test: 'all', selectedId: null };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="lexicon">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search English, Original, Strong's…" type="search">
        <div class="grow-filters">
          <button class="grow-filter is-active" data-t="all">All</button>
          <button class="grow-filter" data-t="ot">Hebrew · OT</button>
          <button class="grow-filter" data-t="nt">Greek · NT</button>
        </div>
      </div>

      <div class="grow-split grow-split--lex">
        <aside class="grow-split-aside">
          <div class="grow-lex-list" data-bind="list">${loadingCards(8)}</div>
        </aside>
        <article class="grow-split-main" data-bind="detail">
          <p class="grow-muted">Pick a word from the list to see its meaning, transliteration, and verse appearances.</p>
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

function _load(root) {
  const mapped = [];
  for (const [id, e] of Object.entries(GREEK)) {
    mapped.push({
      id,
      'Strong\'s': id,
      English:        (e.kjv_def   || '').split(',')[0].trim(),
      KJVRenderings:  e.kjv_def   || '',
      Original:       e.lemma      || '',
      Transliteration: e.translit  || '',
      Pronunciation:  '',
      Testament:      'New Testament',
      Definition:     e.strongs_def ? e.strongs_def.trim() : '',
      Etymology:      e.derivation  || '',
      Verses: '', Theme: ''
    });
  }
  for (const [id, e] of Object.entries(HEBREW)) {
    mapped.push({
      id,
      'Strong\'s': id,
      English:        (e.kjv_def   || '').split(',')[0].trim(),
      KJVRenderings:  e.kjv_def   || '',
      Original:       e.lemma      || '',
      Transliteration: e.xlit     || '',
      Pronunciation:  e.pron      || '',
      Testament:      'Old Testament',
      Definition:     e.strongs_def ? e.strongs_def.trim() : '',
      Etymology:      e.derivation  || '',
      Verses: '', Theme: ''
    });
  }
  _state.rows = mapped;
  _paint(root);
}

const PAGE_SIZE = 150;
function _paint(root) {
  const list = _filtered();
  const listEl = root.querySelector('[data-bind="list"]');
  if (!list.length) { listEl.innerHTML = emptyState({ icon: '🔎', title: 'No matches', body: 'Try another search term or testament filter.' }); return; }
  const page = list.slice(0, PAGE_SIZE);
  const overflow = list.length > PAGE_SIZE ? `<p class="grow-muted" style="padding:.5rem 1rem;font-size:.8rem">Showing ${PAGE_SIZE} of ${list.length} — type to narrow results.</p>` : '';
  listEl.innerHTML = page.map((w, i) => {
    const isG = (w.Testament || '').toLowerCase().includes('new');
    const lc  = isG ? '#0891b2' : '#7c3aed';
    const act = String(_state.selectedId) === String(w.id || i) ? 'is-active' : '';
    return `<button class="grow-lex-row ${act}" data-w="${esc(String(w.id || i))}">
      <span class="grow-lex-dot" style="background:${lc}" aria-hidden="true"></span>
      <span class="grow-lex-en">${esc(w.English || w.english || '')}</span>
      <span class="grow-lex-orig" dir="auto">${esc(w.Original || w.original || '')}</span>
    </button>`;
  }).join('') + overflow;
  listEl.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => {
    _state.selectedId = b.dataset.w;
    _paintDetail(root);
    listEl.querySelectorAll('[data-w]').forEach((x) => x.classList.toggle('is-active', x.dataset.w === _state.selectedId));
  }));
  _paintDetail(root);
}

function _paintDetail(root) {
  const det = root.querySelector('[data-bind="detail"]');
  if (_state.selectedId == null) return;
  const list = _filtered();
  const w = list.find((x, i) => String(x.id || i) === String(_state.selectedId));
  if (!w) return;

  const testament = w.Testament || '';
  const isGreek   = testament.toLowerCase().includes('new') || testament.toLowerCase().includes('greek');
  const lang      = isGreek ? 'Greek · NT' : 'Hebrew · OT';
  const lc        = isGreek ? '#0891b2' : '#7c3aed';
  const _PS       = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';

  // Language icon: cross for Greek/NT, flame for Hebrew/OT
  const langSvg = isGreek
    ? `<svg ${_PS}><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0 0 4h5v5a2 2 0 0 0 4 0v-5h5a2 2 0 0 0 0-4h-5V4a2 2 0 0 0-2-2z"/></svg>`
    : `<svg ${_PS}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;

  const kjvRaw   = (w.KJVRenderings || '').split(',').map((s) => s.trim()).filter(Boolean);
  const kjvChips = kjvRaw.map((r) => `<span class="grow-lex-kjv-chip">${esc(r)}</span>`).join('');

  det.innerHTML = /* html */`
    <div class="grow-lex-detail-wrap" style="--lex-color:${lc}">

      <div class="grow-lex-lang-row">
        <span class="grow-lex-lang-badge">${langSvg}<span>${esc(lang)}</span></span>
        ${w["Strong's"] ? `<span class="grow-lex-strongs-badge">${esc(w["Strong's"])}</span>` : ''}
        ${w.Theme       ? `<span class="grow-lex-theme-badge">${esc(w.Theme)}</span>` : ''}
      </div>

      <div class="grow-lex-word-display">
        ${w.Original ? `<div class="grow-lex-big-word" dir="auto" lang="${isGreek ? 'el' : 'he'}">${esc(w.Original)}</div>` : ''}
        <div class="grow-lex-word-en-block">
          <h2 class="grow-lex-english">${esc(w.English || w.english || '')}</h2>
          ${w.Transliteration ? `<p class="grow-lex-transliteration">/${esc(w.Transliteration)}/</p>` : ''}
          ${w.Pronunciation   ? `<p class="grow-lex-pronunciation">${esc(w.Pronunciation)}</p>` : ''}
        </div>
      </div>

      ${w.Definition ? `
      <div class="grow-lex-block">
        <div class="grow-lex-block-label">
          <svg ${_PS}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          Definition
        </div>
        <p class="grow-lex-block-body">${esc(w.Definition)}</p>
      </div>` : ''}

      ${w.Etymology ? `
      <div class="grow-lex-block">
        <div class="grow-lex-block-label">
          <svg ${_PS}><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" y1="9" x2="6" y2="21"/></svg>
          Etymology
        </div>
        <p class="grow-lex-block-body grow-lex-block-body--muted">${esc(w.Etymology)}</p>
      </div>` : ''}

      ${kjvChips ? `
      <div class="grow-lex-block">
        <div class="grow-lex-block-label">
          <svg ${_PS}><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          KJV Renderings
        </div>
        <div class="grow-lex-kjv-chips">${kjvChips}</div>
      </div>` : ''}

      ${w.Verses ? `
      <div class="grow-lex-block">
        <div class="grow-lex-block-label">
          <svg ${_PS}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          Verse Appearances
        </div>
        <p class="grow-lex-block-body grow-lex-block-body--muted">${esc(w.Verses)}</p>
      </div>` : ''}

    </div>
  `;
}

function _filtered() {
  return _state.rows.filter((w) => {
    if (_state.test !== 'all') {
      const t = (w.Testament || '').toLowerCase();
      if (_state.test === 'ot' && !t.includes('old') && !t.includes('hebrew')) return false;
      if (_state.test === 'nt' && !t.includes('new') && !t.includes('greek'))  return false;
    }
    if (_state.q) {
      const hay = ((w.English || '') + ' ' + (w.Original || '') + ' ' + (w.Transliteration || '') + ' ' + (w["Strong's"] || '')).toLowerCase();
      if (!hay.includes(_state.q)) return false;
    }
    return true;
  });
}

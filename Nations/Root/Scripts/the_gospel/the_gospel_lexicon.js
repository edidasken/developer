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
  listEl.innerHTML = page.map((w, i) => `
    <button class="grow-lex-row ${_state.selectedId === (w.id || i) ? 'is-active' : ''}" data-w="${esc(String(w.id || i))}">
      <span class="grow-lex-en">${esc(w.English || w.english || '')}</span>
      <span class="grow-lex-orig">${esc(w.Original || w.original || '')}</span>
    </button>
  `).join('') + overflow;
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
  const isGreek  = testament.toLowerCase().includes('new') || testament.toLowerCase().includes('greek');
  const lang     = isGreek ? 'Greek' : 'Hebrew';
  const langColor = isGreek ? '#0891b2' : '#7c3aed';
  const kjvChips = (w.KJVRenderings || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((r) => `<span class="grow-lex-kjv-chip">${esc(r)}</span>`)
    .join('');

  det.innerHTML = /* html */`
    <div class="grow-lex-hero" style="--lex-color:${langColor}">
      ${w.Original ? `<div class="grow-lex-big-word">${esc(w.Original)}</div>` : ''}
      <div class="grow-lex-hero-text">
        <h2 class="grow-lex-english">${esc(w.English || w.english || '')}</h2>
        ${w.Transliteration ? `<p class="grow-lex-transliteration">/${esc(w.Transliteration)}/</p>` : ''}
        ${w.Pronunciation   ? `<p class="grow-lex-pronunciation">Pronounced: <em>${esc(w.Pronunciation)}</em></p>` : ''}
      </div>
    </div>
    <div class="grow-lex-meta">
      ${w["Strong's"] ? chip("Strong's " + w["Strong's"], 'neutral') : ''}
      ${w.Testament   ? chip(lang, 'level') : ''}
      ${w.Theme       ? chip(w.Theme, 'topic') : ''}
    </div>
    ${w.Definition ? `<h4 class="grow-detail-h4">Definition</h4><p class="grow-detail-body">${esc(w.Definition)}</p>` : ''}
    ${w.Etymology  ? `<h4 class="grow-detail-h4">Etymology</h4><p class="grow-detail-body grow-detail-body--muted">${esc(w.Etymology)}</p>` : ''}
    ${kjvChips     ? `<h4 class="grow-detail-h4">KJV Renderings</h4><div class="grow-lex-kjv-chips">${kjvChips}</div>` : ''}
    ${w.Verses     ? `<h4 class="grow-detail-h4">Verse appearances</h4><p class="grow-detail-body">${esc(w.Verses)}</p>` : ''}
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

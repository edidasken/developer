/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · JOURNAL — A private place to write what God is teaching you.
   "I will remember the deeds of the Lord; yes, I will remember your wonders
    of old." — Psalm 77:11
   ══════════════════════════════════════════════════════════════════════════════ */

import { ur, rows, esc, snip, fmtDate, timeAgo, emptyState, backendOffline, loadingCards, sectionHead } from './the_gospel_shared.js';

export const name        = 'the_gospel_journal';
export const title       = 'Journal';
export const description = 'A private place to write what God is teaching you — your prayers, reflections, and breakthroughs.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
export const accent      = '#0d9488';

let _state = { rows: [], composing: false };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="journal">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
        <button class="grow-btn" data-new>+ New entry</button>
      </header>

      <div class="grow-compose" data-bind="compose" hidden></div>
      <div class="grow-list" data-bind="list">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  root.querySelector('[data-new]').addEventListener('click', () => _openCompose(root));
  _load(root);
  return () => {};
}

async function _load(root) {
  const list = root.querySelector('[data-bind="list"]');
  const U = ur();
  if (!U) { list.innerHTML = backendOffline('Journal not loaded.'); return; }
  try {
    const res = await U.listJournal({ limit: 100 });
    _state.rows = rows(res).sort((a, b) => _ts(b) - _ts(a));
    if (!_state.rows.length) { list.innerHTML = emptyState({ icon: '🕊️', title: 'Your journal is empty', body: 'Tap + New entry to begin.' }); return; }
    list.innerHTML = _state.rows.map(_card).join('');
  } catch (e) {
    console.error('[gospel/journal] load:', e);
    list.innerHTML = emptyState({ icon: '⚠️', title: 'Could not load journal', body: e.message || String(e) });
  }
}

function _ts(e) { const t = e.createdAt || e.date || 0; return typeof t === 'number' ? t : new Date(t).getTime(); }

function _card(e) {
  return /* html */`
    <article class="grow-journal">
      <header class="grow-journal-hd">
        <h3 class="grow-journal-title">${esc(e.title || 'Untitled entry')}</h3>
        <time class="grow-muted">${esc(timeAgo(e.createdAt || e.date) || fmtDate(e.createdAt || e.date))}</time>
      </header>
      ${e.scripture ? `<p class="grow-journal-scripture">${esc(e.scripture)}</p>` : ''}
      <p class="grow-journal-body">${esc(snip(e.body || e.content || '', 1200))}</p>
    </article>
  `;
}

function _openCompose(root) {
  const c = root.querySelector('[data-bind="compose"]');
  c.hidden = false;
  c.innerHTML = /* html */`
    <div class="grow-compose-card">
      ${sectionHead('New entry')}
      <input class="grow-input" data-c-title placeholder="Title (optional)">
      <input class="grow-input" data-c-scripture placeholder="Scripture (e.g. John 1:14)">
      <textarea class="grow-textarea" data-c-body rows="6" placeholder="What is God showing you?"></textarea>
      <div class="grow-compose-foot">
        <button class="grow-btn grow-btn--ghost" data-c-cancel>Cancel</button>
        <button class="grow-btn" data-c-save>Save entry</button>
      </div>
    </div>
  `;
  c.querySelector('[data-c-cancel]').addEventListener('click', () => { c.hidden = true; c.innerHTML = ''; });
  c.querySelector('[data-c-save]').addEventListener('click', async () => {
    const U = ur(); if (!U || typeof U.createJournal !== 'function') return;
    const payload = {
      title:     c.querySelector('[data-c-title]').value.trim(),
      scripture: c.querySelector('[data-c-scripture]').value.trim(),
      body:      c.querySelector('[data-c-body]').value.trim(),
    };
    if (!payload.body) return;
    try {
      await U.createJournal(payload);
      c.hidden = true; c.innerHTML = '';
      _load(root);
    } catch (e) {
      console.error('[gospel/journal] save:', e);
      alert('Could not save: ' + (e.message || e));
    }
  });
}

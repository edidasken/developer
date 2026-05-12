/* ══════════════════════════════════════════════════════════════════════════════
   THE GOSPEL · APOLOGETICS — Reasons for the hope that is in you.
   "Always be prepared to give an answer to everyone who asks you to give the
    reason for the hope that you have." — 1 Peter 3:15
   ══════════════════════════════════════════════════════════════════════════════ */

import { esc, snip, emptyState, loadingCards, chip } from './the_gospel_shared.js';

export const name        = 'the_gospel_apologetics';
export const title       = 'Apologetics';
export const description = 'Common objections to the faith — answered with scripture, reason, and a steady tone.';
export const icon        = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7l9 3 9-3"/><path d="M3 17l9-3 9 3"/></svg>`;
export const accent      = '#475569';

let _state = { rows: [], q: '' };

export function render() {
  return /* html */`
    <section class="grow-page" data-grow="apologetics">
      <header class="grow-hero" style="--grow-accent:${accent}">
        <div class="grow-hero-icon">${icon}</div>
        <div class="grow-hero-text">
          <h1 class="grow-hero-title">${title}</h1>
          <p class="grow-hero-sub">${esc(description)}</p>
        </div>
      </header>

      <div class="grow-toolbar">
        <input class="grow-search" data-q placeholder="Search questions…" type="search">
      </div>

      <div class="grow-apo-list" data-bind="list">${loadingCards(3)}</div>
    </section>
  `;
}

export function mount(root) {
  const qEl = root.querySelector('[data-q]');
  qEl.addEventListener('input', () => { _state.q = qEl.value.trim().toLowerCase(); _paint(root); });
  _load(root);
  return () => {};
}

async function _load(root) {
  try {
    const mod = await import('../../Data/apologetics.js');
    // Sort by sortOrder ascending — this is the canonical 1–N sequence
    _state.rows = (mod.default || []).slice().sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  } catch (e) {
    console.error('[gospel/apologetics] static bundle failed:', e);
  }
  _paint(root);
}

function _paint(root) {
  const list = root.querySelector('[data-bind="list"]');
  const q = _state.q;
  const rows = q
    ? _state.rows.filter((r) => ((r.questionTitle || '') + ' ' + (r.answerContent || '') + ' ' + (r.categoryTitle || '')).toLowerCase().includes(q))
    : _state.rows;

  if (!rows.length) {
    list.innerHTML = emptyState({ icon: '⚖️', title: q ? 'No matches' : 'No apologetics yet' });
    return;
  }

  // Group by category, preserving sort order
  const catMap = new Map();
  rows.forEach((r) => {
    const cat = r.categoryTitle || 'General';
    if (!catMap.has(cat)) catMap.set(cat, { color: r.categoryColor || '#475569', intro: r.categoryIntro || '', items: [] });
    catMap.get(cat).items.push(r);
  });

  list.innerHTML = [...catMap.entries()].map(([cat, { color, intro, items }]) => /* html */`
    <div class="grow-apo-section" style="--apo-color:${esc(color)}">
      <div class="grow-apo-section-head">
        <h3 class="grow-apo-section-title">${esc(cat)}</h3>
        ${intro ? `<p class="grow-apo-section-intro">${esc(intro)}</p>` : ''}
        <span class="grow-apo-section-count">${items.length} question${items.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="grow-apo-cards">
        ${items.map((r, i) => _item(r, i)).join('')}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.grow-apo-card').forEach((card) => {
    card.querySelector('.grow-apo-q').addEventListener('click', () => {
      const open = card.classList.toggle('is-open');
      card.querySelector('.grow-apo-body').hidden = !open;
    });
  });
}

function _item(q, idx) {
  const num        = q.sortOrder || (idx + 1);
  const qtitle     = (q.questionTitle || q.question || '').replace(/^\d+\.\s*/, '');
  const shortLabel = (q.shortTitle || q['Short Title'] || '').replace(/^\d+\.\s*/, '');
  const answer = q.answerContent || '';
  const quote  = q.quoteText || '';
  const ref    = q.referenceText || '';
  const refUrl = q.referenceUrl || '';
  return /* html */`
    <div class="grow-apo-card">
      <button class="grow-apo-q" type="button">
        <span class="grow-apo-num">${num}</span>
        <span class="grow-apo-qtext">${esc(qtitle)}</span>
        <svg class="grow-apo-chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
      </button>
      <div class="grow-apo-body" hidden>
        ${shortLabel && shortLabel !== qtitle ? `<p class="grow-apo-topic">${esc(shortLabel)}</p>` : ''}
        ${answer ? `<p class="grow-apo-answer">${esc(answer)}</p>` : ''}
        ${quote ? `<blockquote class="grow-apo-quote"><p>${esc(quote)}</p>${ref ? `<cite>${refUrl ? `<a href="${esc(refUrl)}" target="_blank" rel="noopener">${esc(ref)}</a>` : esc(ref)}</cite>` : ''}</blockquote>` : ''}
      </div>
    </div>
  `;
}

